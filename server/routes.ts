import type { Express } from "express";
import { createServer, type Server } from "http";
import { requireAuth } from "./auth";
import { registerRadarAutoSnapshotRoute, registerRadarRoutes } from "./routes/radar";
import { registerHealthRoutes } from "./routes/health";
import { registerAdminRoutes } from "./routes/admin";
import { registerExerciseRoutes } from "./routes/exercises";
import { registerEntryRoutes } from "./routes/entries";
import { registerStatsRoutes } from "./routes/stats";
import { registerSettingsRoutes } from "./routes/settings";
import { registerCsvImportRoutes } from "./routes/csv-import";
import { registerPublicRoutes } from "./routes/public";
import { trainingRouter } from "./routes/training";

// 路由依領域拆在 server/routes/*.ts，這裡只負責「註冊順序」與「哪些前綴要登入」。
// /api/auth/* 由 auth.ts 的 setupGoogleAuth 處理（公開路由）；其餘 /api/* 都需要登入，
// 例外是 /api/public/*（各自用密鑰驗證）與下面的雷達圖排程入口。
export async function registerRoutes(app: Express): Promise<Server> {
  // 必須在 requireAuth 之前：排程用 x-snapshot-secret 驗證，不帶登入 session
  registerRadarAutoSnapshotRoute(app);

  app.use("/api/entries", requireAuth);
  app.use("/api/exercises", requireAuth);
  app.use("/api/stats", requireAuth);
  app.use("/api/settings", requireAuth);
  app.use("/api/import", requireAuth);
  app.use("/api/training", requireAuth, trainingRouter);

  registerHealthRoutes(app);
  registerAdminRoutes(app);
  registerRadarRoutes(app);
  registerExerciseRoutes(app);
  registerEntryRoutes(app);
  registerStatsRoutes(app);
  registerSettingsRoutes(app);
  registerCsvImportRoutes(app);
  registerPublicRoutes(app);

  return createServer(app);
}
