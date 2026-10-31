import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../auth";

export function registerAdminRoutes(app: Express) {
  // ==================== 管理員 API ====================

  app.get("/api/admin/whitelist", requireAuth, requireAdmin, async (req, res) => {
    try {
      const list = await storage.getWhitelist();
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: "Failed to get whitelist" });
    }
  });

  app.post("/api/admin/whitelist", requireAuth, requireAdmin, async (req, res) => {
    const { username, note } = req.body;
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "username 必填" });
    }
    try {
      const entry = await storage.addToWhitelist(username.trim(), req.user!.username, note);
      res.status(201).json(entry);
    } catch (err) {
      res.status(500).json({ error: "Failed to add to whitelist" });
    }
  });

  app.delete("/api/admin/whitelist/:username", requireAuth, requireAdmin, async (req, res) => {
    try {
      const ok = await storage.removeFromWhitelist(req.params.username);
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Failed to remove from whitelist" });
    }
  });

  // 迁移历史肌群统计数据
  app.post("/api/admin/migrate-muscle-stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await storage.migrateHistoricalMuscleStats();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("遷移肌群統計失敗:", error);
      res.status(500).json({ error: "遷移肌群統計失敗" });
    }
  });

  app.post("/api/admin/recalculate-baselines", requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await storage.recalculateAllBaselines();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("重新計算基線值失敗:", error);
      res.status(500).json({ error: "重新計算基線值失敗" });
    }
  });

  // 批次匯入運動項目參數（JSON）——body 是 { exercises: [...] } 陣列，每筆
  // 用 name 比對既有運動，找得到就整份覆蓋更新、找不到就新建。只調整
  // exercises 表本身，不會自動觸發歷史 baselineValue 重算——想套用到既有
  // 記錄請在匯入成功後另外呼叫 /api/admin/recalculate-baselines。
  app.post("/api/admin/exercises/import", requireAuth, requireAdmin, async (req, res) => {
    try {
      const items = req.body?.exercises;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "請求格式錯誤，需要 { exercises: [...] }" });
      }
      const result = await storage.importExercises(items);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("匯入運動項目失敗:", error);
      res.status(500).json({ error: "匯入運動項目失敗" });
    }
  });

  app.post("/api/admin/convert-exercise-unit", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { exerciseName, newUnit, valueMultiplier } = req.body;
      if (!exerciseName || !newUnit || !valueMultiplier) {
        return res.status(400).json({ error: "Missing exerciseName, newUnit, or valueMultiplier" });
      }
      const result = await storage.convertExerciseUnit(exerciseName, newUnit, valueMultiplier);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("轉換運動單位失敗:", error);
      res.status(500).json({ error: "轉換運動單位失敗" });
    }
  });
}
