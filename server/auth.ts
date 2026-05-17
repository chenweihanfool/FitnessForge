/**
 * Replit Auth — OpenID Connect (openid-client v6, PKCE)
 *
 * Flow:
 *  1. GET /api/auth/login    → redirect to Replit OIDC authorize
 *  2. GET /api/auth/callback → exchange code, upsert user, set session
 *  3. GET /api/auth/me       → return session user (or 401)
 *  4. POST /api/auth/logout  → destroy session
 *
 * Access control:
 *  - REPLIT_ADMIN_USERNAME env → that user gets admin on first login
 *  - First-ever login → admin (bootstrap)
 *  - All others must be on the whitelist (added by admin)
 */

import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import {
  discovery,
  randomState,
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  buildAuthorizationUrl,
  authorizationCodeGrant,
  fetchUserInfo,
  type Configuration,
} from "openid-client";
import { storage } from "./storage";

// ── Session types ─────────────────────────────────────────────────────────────

declare module "express-session" {
  interface SessionData {
    oauthState: string;
    codeVerifier: string;
    replitUserId: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        replitUserId: string;
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
  const clientId = process.env.REPL_ID;
  if (!clientId) throw new Error("REPL_ID is not set — are you running on Replit?");
  _oidcConfig = await discovery(new URL("https://replit.com/oidc"), clientId);
  return _oidcConfig;
}

function getCallbackUrl(): string {
  const domain = (process.env.REPLIT_DOMAINS ?? "").split(",")[0]?.trim();
  if (domain) return `https://${domain}/api/auth/callback`;
  const port = process.env.PORT ?? "5000";
  return `http://localhost:${port}/api/auth/callback`;
}

// ── Session middleware ────────────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function createSession() {
  return session({
    secret: process.env.SESSION_SECRET ?? "fitness-forge-dev-secret",
    resave: false,
    saveUninitialized: false,
    // MemoryStore — no DB table needed, works across single-instance Replit deploy
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: THIRTY_DAYS_MS,
      sameSite: "lax",
    },
  });
}

// ── Auth guard middleware ─────────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const replitUserId = req.session.replitUserId;
  if (!replitUserId) return res.status(401).json({ error: "未登入" });

  try {
    const user = await storage.getUserByReplitId(replitUserId);
    if (!user) return res.status(401).json({ error: "帳號不存在" });

    if (user.role !== "admin") {
      const allowed = await storage.isWhitelisted(user.username);
      if (!allowed) {
        return res.status(403).json({ error: "此帳號尚未獲得授權", username: user.username });
      }
    }

    req.user = {
      replitUserId: user.replitUserId,
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

export async function setupReplitAuth(app: Express) {
  // Step 1 — redirect to Replit OIDC
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
      res.redirect("/?error=replit_auth_unavailable");
    }
  });

  // Step 2 — OIDC callback
  app.get("/api/auth/callback", async (req, res) => {
    try {
      const config = await getOIDCConfig();
      const { oauthState, codeVerifier } = req.session;

      if (!oauthState || !codeVerifier) return res.redirect("/?error=invalid_state");

      const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
      const host = req.headers["x-forwarded-host"] ?? req.headers.host;
      const currentUrl = new URL(`${proto}://${host}${req.originalUrl}`);

      const tokens = await authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: oauthState,
      });

      const claims = tokens.claims();
      if (!claims) throw new Error("No claims in token response");
      const replitUserId = String(claims.sub);

      let username = replitUserId;
      let profileImage: string | null = null;
      try {
        const info = await fetchUserInfo(config, tokens.access_token!, claims.sub!) as any;
        username = String(info.username ?? info.preferred_username ?? info.name ?? replitUserId);
        profileImage = info.profile_image ?? info.picture ?? null;
      } catch { /* non-fatal */ }

      // Upsert user (first-ever login → admin; REPLIT_ADMIN_USERNAME → admin)
      const adminUsername = process.env.REPLIT_ADMIN_USERNAME ?? "";
      let user = await storage.getUserByReplitId(replitUserId);

      if (!user) {
        user = await storage.upsertUser({ replitUserId, username, profileImage });
        // Promote to admin if designated or first user
        if (user.role === "admin" || (adminUsername && username === adminUsername)) {
          await storage.setUserAdmin(replitUserId);
          user = (await storage.getUserByReplitId(replitUserId))!;
        }
      } else {
        // Update profile info on each login
        await storage.upsertUser({ replitUserId, username, profileImage });
        user = (await storage.getUserByReplitId(replitUserId))!;
      }

      // Access control: admin always in; others need whitelist
      if (user.role !== "admin") {
        const allowed = await storage.isWhitelisted(username);
        if (!allowed) {
          console.log(`[auth] 拒絕未授權用戶: ${username} (${replitUserId})`);
          req.session.destroy(() => {});
          return res.redirect("/?error=access_denied");
        }
      }

      req.session.replitUserId = replitUserId;
      delete req.session.oauthState;
      delete req.session.codeVerifier;

      res.redirect("/");
    } catch (err) {
      console.error("[auth] callback error:", err);
      res.redirect("/?error=auth_failed");
    }
  });

  // Step 3 — current user
  app.get("/api/auth/me", async (req, res) => {
    const replitUserId = req.session.replitUserId;
    if (!replitUserId) return res.status(401).json({ user: null });

    try {
      const user = await storage.getUserByReplitId(replitUserId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ user: null });
      }
      const isWhitelisted = user.role === "admin" || await storage.isWhitelisted(user.username);
      res.json({
        user: {
          replitUserId: user.replitUserId,
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

  console.log("[auth] Replit OIDC 路由已掛載");
}
