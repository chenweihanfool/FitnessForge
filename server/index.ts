import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createSession, setupGoogleAuth } from "./auth";

const app = express();

// Trust the reverse proxy in front of this app (Apache) so session cookies
// work correctly in production
app.set("trust proxy", 1);

// This app is deployed under a URL subpath (BASE_PATH, e.g. "/fitness")
// rather than domain root, since it shares its self-hosted domain with
// other apps. Apache forwards the full incoming path unstripped (no
// ProxyPass path rewriting), so every route below would otherwise need to
// be defined under that prefix. Instead, strip it here, once, so every
// route/middleware below can stay written exactly as if the app were
// served from root -- client/src/lib/basePath.ts is what makes the
// *browser* aware of the real prefix for asset URLs, routing, and its own
// fetch() calls.
const BASE_PATH = process.env.BASE_PATH || "";
if (BASE_PATH) {
  app.use((req, _res, next) => {
    if (req.url === BASE_PATH || req.url.startsWith(BASE_PATH + "/")) {
      req.url = req.url.slice(BASE_PATH.length) || "/";
    }
    next();
  });
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Session middleware (must come before auth routes)
app.use(createSession());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Mount Google Auth routes before other routes
  await setupGoogleAuth(app);

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
