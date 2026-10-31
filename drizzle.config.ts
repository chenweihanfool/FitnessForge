import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // 排除 connect-pg-simple 自管的 session 表，避免 Drizzle 誤刪。
  // weekly_plans 是已移除的「訓練計畫」功能留下的舊表：schema 已不再定義，
  // 但資料先保留在資料庫裡（可回滾），也避免 db:push 把它當成「要刪的表」
  // 跳出互動確認而卡住部署。確定不需要之後，手動 DROP TABLE 即可。
  // radar_snapshots（已移除的雷達快照功能）同樣處理。
  tablesFilter: ["!session", "!weekly_plans", "!radar_snapshots"],
});
