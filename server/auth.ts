/**
 * Google OAuth (OIDC) login, replacing the previous Replit Auth integration
 * (migrated 2026-07 when moving off Replit hosting -- see pf-cwh's migration
 * for the same architecture, this file mirrors it).
 *
 * Flow:
 *  1. GET /api/auth/login   → redirect to Google's OIDC authorize endpoint (PKCE)
 *  2. GET /api/auth/callback → exchange code, upsert/claim user, set session
 *  3. GET /api/auth/me      → return current session user
 *  4. POST /api/auth/logout → destroy session
 *
 * Access control (unchanged from the Replit version):
 *  - ADMIN_GOOGLE_EMAIL env → that account gets admin on first login
 *  - First-ever login (no rows in `users` yet) → admin (bootstrap)
 *  - All others must be on the `whitelist` table (added by admin)
 *
 * Migration note: rows created under the old Replit Auth still have
 * replitUserId populated and googleUserId/googleEmail null. On first Google
 * login for a *known* legacy account (matched by pre-set googleEmail, or by
 * username already being that Gmail address -- Replit itself authenticated
 * via Google, so several usernames already are the person's email) we claim
 * that row instead of creating a new one, preserving role/createdAt. See
 * storage.ts's claimLegacyUserByEmail().
 */

import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import {
  discovery,
  randomState,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  buildAuthorizationUrl,
  authorizationCodeGrant,
  type Configuration,
} from "openid-client";
import { storage } from "./storage";

// ── Session types ─────────────────────────────────────────────────────────────

declare module "express-session" {
  interface SessionData {
    oauthState: string;
    codeVerifier: string;
    googleUserId: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        googleUserId: string;
        username: string;
        role: "admin" | "user";
        profileImage: string | null;
      };
    }
  }
}

// ── OIDC client singleton ─────────────────────────────────────────────────────

let _oidcConfig: Configuration | null = null;

async function getOIDCConfig(): Promise<Configuration> {
  if (_oidcConfig) return _oidcConfig;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET environment variables are not set.");
  }
  _oidcConfig = await discovery(new URL("https://accounts.google.com"), clientId, {
    client_secret: clientSecret,
  });
  return _oidcConfig;
}

function getPublicBaseUrl(): string {
  const url = process.env.PUBLIC_BASE_URL;
  if (url) return url.replace(/\/$/, "");
  const port = process.env.PORT ?? "5000";
  return `http://localhost:${port}`;
}

function getCallbackUrl(): string {
  return `${getPublicBaseUrl()}/api/auth/callback`;
}

// Prefixes an app-relative path with BASE_PATH for browser-facing redirects.
// The stripping middleware in server/index.ts removes this prefix from
// *incoming* request paths before any route (including this file's) ever
// sees them, so a bare res.redirect("/") here would send the browser to the
// literal domain root -- which belongs to a *different* app when this one is
// deployed under a subpath (this domain hosts tasktracker at "/" and pf-cwh
// at "/pf"; this app owns its own subpath too).
function appPath(path: string): string {
  const basePath = process.env.BASE_PATH || "";
  return `${basePath}${path}`;
}

// ── Session middleware ────────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function createSession() {
  const PgSession = connectPgSimple(session);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  return session({
    secret: process.env.SESSION_SECRET ?? "fitness-forge-dev-secret",
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
      ttl: THIRTY_DAYS_MS / 1000,
      pruneSessionInterval: 60 * 60,
    }),
    cookie: {
      // Deliberately NOT `NODE_ENV === "production"` -- see pf-cwh's
      // project_pf_cwh_migration memory for the full writeup. In short:
      // express-session only sets Set-Cookie when it believes the request is
      // HTTPS (via req.secure, which depends on Apache forwarding
      // X-Forwarded-Proto). This domain's Apache vhost doesn't forward that
      // header, so `secure: true` causes Set-Cookie to be silently dropped.
      // Flip back once Apache adds `RequestHeader set X-Forwarded-Proto
      // "https"` (mod_headers). Low real-world risk meanwhile: the app is
      // only bound to 127.0.0.1 and only reachable via Apache's HTTPS proxy.
      secure: false,
      httpOnly: true,
      maxAge: THIRTY_DAYS_MS,
      sameSite: "lax",
      // Scoped to BASE_PATH so this app's session cookie doesn't get sent on
      // every request to the other apps sharing this domain.
      path: process.env.BASE_PATH || "/",
    },
  });
}

// ── Auth guard middleware ─────────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const googleUserId = req.session.googleUserId;
  if (!googleUserId) return res.status(401).json({ error: "未登入" });

  try {
    const user = await storage.getUserByGoogleId(googleUserId);
    if (!user) return res.status(401).json({ error: "帳號不存在" });

    if (user.role !== "admin") {
      const allowed = await storage.isWhitelisted(user.googleEmail ?? user.username);
      if (!allowed) {
        return res.status(403).json({ error: "此帳號尚未獲得授權", username: user.username });
      }
    }

    req.user = {
      googleUserId: user.googleUserId!,
      username: user.username,
      role: user.role as "admin" | "user",
      profileImage: user.profileImage,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "未登入" });
  if (req.user.role !== "admin") return res.status(403).json({ error: "需要管理員權限" });
  next();
}

// ── Auth routes ───────────────────────────────────────────────────────────────

export async function setupGoogleAuth(app: Express) {
  // Step 1 — redirect to Google OIDC
  app.get("/api/auth/login", async (req, res) => {
    try {
      const config = await getOIDCConfig();
      const state = randomState();
      const codeVerifier = randomPKCECodeVerifier();
      const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

      req.session.oauthState = state;
      req.session.codeVerifier = codeVerifier;

      const authUrl = buildAuthorizationUrl(config, {
        redirect_uri: getCallbackUrl(),
        scope: "openid profile email",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      res.redirect(authUrl.href);
    } catch (err) {
      console.error("[auth] login error:", err);
      res.redirect(appPath("/?error=google_auth_unavailable"));
    }
  });

  // Step 2 — OIDC callback
  app.get("/api/auth/callback", async (req, res) => {
    try {
      const config = await getOIDCConfig();
      const { oauthState, codeVerifier } = req.session;

      if (!oauthState || !codeVerifier) return res.redirect(appPath("/?error=invalid_state"));

      // Build the callback URL openid-client needs (it derives the
      // redirect_uri it sends to the token endpoint by stripping the query
      // string off this URL). That derived value MUST byte-for-byte match
      // what Google has registered for this OAuth client and what /login
      // sent when building the authorization URL. Reconstructing
      // origin+path from request headers is fragile behind this Apache
      // config (doesn't forward X-Forwarded-Host), so reuse the same
      // static PUBLIC_BASE_URL-derived URL here instead -- see pf-cwh's
      // project_pf_cwh_migration memory for the redirect_uri_mismatch this
      // caused there.
      const currentUrl = new URL(getCallbackUrl());
      currentUrl.search = req.originalUrl.split("?")[1] ?? "";

      const tokens = await authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: oauthState,
      });

      const claims = tokens.claims();
      if (!claims) throw new Error("No claims in token response");
      const googleUserId = String(claims.sub);
      const email = String(claims.email ?? "");
      const displayName = String(claims.name ?? email ?? googleUserId);
      const profileImage = (claims.picture as string | undefined) ?? null;

      const adminEmail = (process.env.ADMIN_GOOGLE_EMAIL ?? "").toLowerCase();

      // 1. Already linked to this Google identity?
      let user = await storage.getUserByGoogleId(googleUserId);

      // 2. Claim a pre-existing (pre-registered, or legacy Replit-era) row
      if (!user && email) {
        user = (await storage.claimLegacyUserByEmail(email, googleUserId)) ?? undefined as any;
      }

      if (!user) {
        const isDesignatedAdmin = adminEmail && email.toLowerCase() === adminEmail;
        const anyUsersExist = await storage.hasAnyUsers();

        if (isDesignatedAdmin || !anyUsersExist) {
          user = await storage.upsertGoogleUser({
            googleUserId,
            googleEmail: email,
            username: displayName || email || googleUserId,
            profileImage,
            role: "admin",
          });
          console.log(`[auth] 建立管理員帳號: ${email}`);
        } else {
          console.log(`[auth] 拒絕未知使用者 — googleUserId: ${googleUserId}, email: ${email}, displayName: ${displayName}`);
          return res.redirect(appPath("/?error=access_denied"));
        }
      } else {
        // Existing user logging back in — refresh profile info, keep role.
        user = await storage.upsertGoogleUser({
          googleUserId,
          googleEmail: email,
          username: user.username,
          profileImage,
          role: user.role as "admin" | "user",
        });
      }

      // Access control: admin always in; others need whitelist
      if (user.role !== "admin") {
        const allowed = await storage.isWhitelisted(user.googleEmail ?? user.username);
        if (!allowed) {
          console.log(`[auth] 拒絕未授權用戶: ${user.username} (${googleUserId})`);
          req.session.destroy(() => {});
          return res.redirect(appPath("/?error=access_denied"));
        }
      }

      req.session.googleUserId = googleUserId;
      delete req.session.oauthState;
      delete req.session.codeVerifier;

      res.redirect(appPath("/"));
    } catch (err) {
      console.error("[auth] callback error:", err);
      res.redirect(appPath("/?error=auth_failed"));
    }
  });

  // Step 3 — current user
  app.get("/api/auth/me", async (req, res) => {
    const googleUserId = req.session.googleUserId;
    if (!googleUserId) return res.status(401).json({ user: null });

    try {
      const user = await storage.getUserByGoogleId(googleUserId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ user: null });
      }
      const isWhitelisted = user.role === "admin" || (await storage.isWhitelisted(user.googleEmail ?? user.username));
      res.json({
        user: {
          googleUserId: user.googleUserId,
          username: user.username,
          role: user.role,
          profileImage: user.profileImage,
        },
        isWhitelisted,
      });
    } catch {
      res.status(500).json({ user: null });
    }
  });

  // Step 4 — logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  console.log("[auth] Google OAuth 路由已掛載");
}
