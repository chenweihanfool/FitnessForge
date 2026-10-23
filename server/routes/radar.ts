import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth } from "../auth";
import { computeMuscleCompositeScore } from "@shared/muscleGroupStats";

// 週雷達圖快照的排程入口：用 x-snapshot-secret 驗證、不需登入，所以必須在 requireAuth
// 中間件之前註冊（見 routes.ts）。
export function registerRadarAutoSnapshotRoute(app: Express) {
  // Auto-snapshot endpoint — must be registered BEFORE requireAuth middleware
  // so the x-snapshot-secret check can run without login.
  app.post("/api/stats/radar-snapshot/auto", async (req, res) => {
    const secret = process.env.SNAPSHOT_SECRET;
    if (!secret || req.headers["x-snapshot-secret"] !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const MUSCLE_NAMES = ['胸', '背', '腿', '肩', '二头肌', '核心', '臀', '三头肌', '有氧'] as const;
      const AVG_FIELD: Record<string, string> = {
        '胸': 'chestAvg', '背': 'backAvg', '腿': 'legsAvg', '肩': 'shouldersAvg',
        '二头肌': 'armsAvg', '核心': 'coreAvg', '臀': 'glutesAvg', '三头肌': 'fullBodyAvg',
        '有氧': 'aerobicAvg',
      };

      const [weeklyStats, averages] = await Promise.all([
        storage.getMuscleGroupWeeklyStats(),
        storage.getMuscleGroupAverages(),
      ]);

      if (!weeklyStats?.weekStart) {
        return res.status(200).json({ skipped: true, reason: "no data for current week" });
      }

      const scores: Record<string, number> = {};
      const weakMuscles: string[] = [];

      for (const name of MUSCLE_NAMES) {
        const g = weeklyStats.muscleGroups.find(m => m.muscleGroup === name);
        const sets = g?.totalSets ?? 0;
        const volume = g?.totalVolume ?? 0;
        const avgKey = AVG_FIELD[name];
        const avgVolume = avgKey ? ((averages as any)?.[avgKey] ?? 0) : 0;

        const { composite } = computeMuscleCompositeScore(name, sets, volume, avgVolume);

        scores[name] = composite;
        if (avgVolume > 0 && composite < 80) weakMuscles.push(name);
      }

      const weakSorted = weakMuscles
        .sort((a, b) => scores[a] - scores[b])
        .slice(0, 3);

      const snap = await storage.upsertRadarSnapshot(
        weeklyStats.weekStart,
        JSON.stringify(scores),
        JSON.stringify(weakSorted),
      );
      console.log(`[auto-snapshot] 已儲存 ${weeklyStats.weekStart} 雷達圖快照`);
      res.json({ success: true, weekStart: snap.weekStart, scores, recommendations: weakSorted });
    } catch (err) {
      console.error("[auto-snapshot] error:", err);
      res.status(500).json({ error: "Failed to compute or save snapshot" });
    }
  });
}

export function registerRadarRoutes(app: Express) {
  // ==================== 雷達圖快照 API ====================

  app.post("/api/stats/radar-snapshot", requireAuth, async (req, res) => {
    const { weekStart, scores, recommendations } = req.body;
    if (!weekStart || !scores) return res.status(400).json({ error: "weekStart and scores required" });
    try {
      const snap = await storage.upsertRadarSnapshot(weekStart, JSON.stringify(scores), JSON.stringify(recommendations || []));
      res.json(snap);
    } catch (err) {
      res.status(500).json({ error: "Failed to save radar snapshot" });
    }
  });

  app.get("/api/stats/radar-snapshot", requireAuth, async (req, res) => {
    const { weekStart } = req.query;
    if (!weekStart) return res.status(400).json({ error: "weekStart required" });
    try {
      const snap = await storage.getRadarSnapshot(weekStart as string);
      res.json(snap ?? null);
    } catch (err) {
      res.status(500).json({ error: "Failed to get radar snapshot" });
    }
  });

  app.get("/api/stats/radar-snapshots", requireAuth, async (_req, res) => {
    try {
      const snaps = await storage.getAllRadarSnapshots();
      res.json(snaps);
    } catch (err) {
      res.status(500).json({ error: "Failed to get radar snapshots" });
    }
  });
}
