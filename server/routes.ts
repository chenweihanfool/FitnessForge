import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExerciseSchema, insertWorkoutEntrySchema, type PlanDayItem } from "@shared/schema";
import multer from "multer";
import Papa from "papaparse";
import { requireAuth, requireAdmin } from "./auth";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== 受保護 API 中間件 ====================
  // /api/auth/* 由 auth.ts 的 setupGoogleAuth 處理（公開路由）
  // 其餘 /api/* 都需要登入

  // Auto-snapshot endpoint — must be registered BEFORE requireAuth middleware
  // so the x-snapshot-secret check can run without login.
  app.post("/api/stats/radar-snapshot/auto", async (req, res) => {
    const secret = process.env.SNAPSHOT_SECRET;
    if (!secret || req.headers["x-snapshot-secret"] !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const SETS_MAINTENANCE = 4;
      const MUSCLE_NAMES = ['胸', '背', '腿', '肩', '二头肌', '核心', '臀', '三头肌'] as const;
      const AVG_FIELD: Record<string, string> = {
        '胸': 'chestAvg', '背': 'backAvg', '腿': 'legsAvg', '肩': 'shouldersAvg',
        '二头肌': 'armsAvg', '核心': 'coreAvg', '臀': 'glutesAvg', '三头肌': 'armsAvg',
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

        const setsPct = Math.min(Math.round((sets / SETS_MAINTENANCE) * 100), 150);
        const volumePct = avgVolume > 0 ? Math.min(Math.round((volume / avgVolume) * 100), 150) : null;
        const composite = volumePct !== null
          ? Math.round(0.4 * setsPct + 0.6 * volumePct)
          : setsPct;

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

  app.use("/api/entries", requireAuth);
  app.use("/api/exercises", requireAuth);
  app.use("/api/stats", requireAuth);
  app.use("/api/settings", requireAuth);
  app.use("/api/plan", requireAuth);
  app.use("/api/import", requireAuth);

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

  // ==================== 运动类型 API ====================
  
  // 获取所有运动类型
  app.get("/api/exercises", async (req, res) => {
    try {
      const exercises = await storage.getExercises();
      res.json(exercises);
    } catch (error) {
      res.status(500).json({ error: "获取运动列表失败" });
    }
  });

  // 获取单个运动类型
  app.get("/api/exercises/:id", async (req, res) => {
    try {
      const exercise = await storage.getExercise(req.params.id);
      if (!exercise) {
        return res.status(404).json({ error: "运动类型不存在" });
      }
      res.json(exercise);
    } catch (error) {
      res.status(500).json({ error: "获取运动失败" });
    }
  });

  // 创建运动类型
  app.post("/api/exercises", async (req, res) => {
    try {
      const validatedData = insertExerciseSchema.parse(req.body);
      const exercise = await storage.createExercise(validatedData);
      res.status(201).json(exercise);
    } catch (error) {
      console.error("创建运动失败:", error);
      res.status(400).json({ error: "创建运动失败，请检查输入数据", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // 更新运动类型
  app.patch("/api/exercises/:id", async (req, res) => {
    try {
      const validatedData = insertExerciseSchema.parse(req.body);
      const exercise = await storage.updateExercise(req.params.id, validatedData);
      if (!exercise) {
        return res.status(404).json({ error: "运动类型不存在" });
      }
      res.json(exercise);
    } catch (error) {
      res.status(400).json({ error: "更新运动失败" });
    }
  });

  // 获取运动项目的记录数量
  app.get("/api/exercises/:id/entry-count", async (req, res) => {
    try {
      const entries = await storage.getWorkoutEntries();
      const count = entries.filter(e => e.exerciseId === req.params.id).length;
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "获取记录数量失败" });
    }
  });

  // 删除运动类型
  app.delete("/api/exercises/:id", async (req, res) => {
    try {
      const success = await storage.deleteExercise(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "运动类型不存在" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "删除运动失败" });
    }
  });

  // ==================== 运动记录 API ====================

  // 获取所有运动记录
  app.get("/api/entries", async (req, res) => {
    try {
      const entries = await storage.getWorkoutEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "获取记录列表失败" });
    }
  });

  app.get("/api/entries/current-week-steps", async (req, res) => {
    try {
      const allExercises = await storage.getExercises();
      const stepsExercise = allExercises.find(e => e.name === '每周平均步数');
      if (!stepsExercise) {
        return res.json(null);
      }

      const TAIPEI_OFFSET = 8 * 60 * 60 * 1000;
      const now = new Date();
      const taipeiTimestamp = now.getTime() + TAIPEI_OFFSET;
      const taipeiDate = new Date(taipeiTimestamp);
      const taipeiDay = taipeiDate.getUTCDay();
      const diffToMonday = taipeiDay === 0 ? 6 : taipeiDay - 1;
      const mondayTaipei = new Date(Date.UTC(
        taipeiDate.getUTCFullYear(), taipeiDate.getUTCMonth(), taipeiDate.getUTCDate() - diffToMonday, 0, 0, 0, 0
      ));
      const weekStart = new Date(mondayTaipei.getTime() - TAIPEI_OFFSET);
      const sundayTaipei = new Date(Date.UTC(
        taipeiDate.getUTCFullYear(), taipeiDate.getUTCMonth(), taipeiDate.getUTCDate() - diffToMonday + 6, 23, 59, 59, 999
      ));
      const weekEnd = new Date(sundayTaipei.getTime() - TAIPEI_OFFSET);

      const entries = await storage.getWorkoutEntries();
      const stepsEntries = entries.filter(e => {
        if (e.exerciseId !== stepsExercise.id) return false;
        const d = new Date(e.date);
        return d >= weekStart && d <= weekEnd;
      });

      if (stepsEntries.length === 0) {
        return res.json(null);
      }

      // 手動輸入永遠優先於系統自動同步值；本週若無手動記錄才採用自動值
      const manualEntries = stepsEntries.filter(e => e.source !== "auto");
      const candidates = manualEntries.length > 0 ? manualEntries : stepsEntries;
      const mostRecent = candidates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      res.json({
        id: mostRecent.id,
        exerciseId: stepsExercise.id,
        value: mostRecent.value,
        dailyAverage: Math.round(mostRecent.value / 7),
        date: mostRecent.date,
        source: mostRecent.source ?? "manual",
        sourceDays: mostRecent.sourceDays ?? null,
      });
    } catch (error) {
      console.error("获取本周步数失败:", error);
      res.status(500).json({ error: "获取本周步数失败" });
    }
  });

  // 获取单个运动记录
  app.get("/api/entries/:id", async (req, res) => {
    try {
      const entry = await storage.getWorkoutEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "记录不存在" });
      }
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "获取记录失败" });
    }
  });

  // 创建运动记录
  app.post("/api/entries", async (req, res) => {
    try {
      const validatedData = insertWorkoutEntrySchema.parse(req.body);
      const entry = await storage.createWorkoutEntry(validatedData);
      res.status(201).json(entry);
    } catch (error) {
      console.error("创建记录失败:", error);
      res.status(400).json({ error: "创建记录失败，请检查输入数据", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // 更新运动记录
  const handleUpdateEntry = async (req: any, res: any) => {
    try {
      const validatedData = insertWorkoutEntrySchema.parse(req.body);
      const entry = await storage.updateWorkoutEntry(req.params.id, validatedData);
      if (!entry) {
        return res.status(404).json({ error: "记录不存在" });
      }
      res.json(entry);
    } catch (error) {
      console.error("更新记录失败:", error);
      res.status(400).json({ error: "更新记录失败，请检查输入数据", details: error instanceof Error ? error.message : String(error) });
    }
  };
  app.patch("/api/entries/:id", handleUpdateEntry);
  app.put("/api/entries/:id", handleUpdateEntry);

  // 删除运动记录
  app.delete("/api/entries/:id", async (req, res) => {
    try {
      const success = await storage.deleteWorkoutEntry(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "记录不存在" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "删除记录失败" });
    }
  });

  // ==================== 统计和分析 API ====================

  // 获取当前周统计和排名
  app.get("/api/stats/ranking", async (req, res) => {
    try {
      const rankingData = await storage.getRankingData();
      res.json(rankingData);
    } catch (error) {
      res.status(500).json({ error: "获取排名数据失败" });
    }
  });

  // 获取排名详情（前后2名）
  app.get("/api/stats/ranking-detail", async (req, res) => {
    try {
      const metric = req.query.metric as string;
      if (!metric || !['total', 'strength', 'cardio', 'activity'].includes(metric)) {
        return res.status(400).json({ error: "无效的metric参数，必须是total、strength、cardio或activity之一" });
      }
      const detail = await storage.getRankingDetail(metric as 'total' | 'strength' | 'cardio' | 'activity');
      res.json(detail);
    } catch (error) {
      res.status(500).json({ error: "获取排名详情失败" });
    }
  });

  // 获取所有周趋势数据
  app.get("/api/stats/trends", async (req, res) => {
    try {
      const trends = await storage.getAllWeeklyStats();
      res.json(trends);
    } catch (error) {
      res.status(500).json({ error: "获取趋势数据失败" });
    }
  });

  // 获取本周详细统计
  app.get("/api/stats/current-week-details", async (req, res) => {
    try {
      const details = await storage.getCurrentWeekDetails();
      res.json(details);
    } catch (error) {
      res.status(500).json({ error: "获取本周详细数据失败" });
    }
  });

  // 获取本周分类统计
  app.get("/api/stats/category-breakdown", async (req, res) => {
    try {
      const rankingData = await storage.getRankingData();
      const weekStart = new Date(rankingData.currentWeek.weekStart);
      const weekEnd = new Date(rankingData.currentWeek.weekEnd);
      const weeklyStats = await storage.getWeeklyStats(weekStart, weekEnd);
      
      const rawSum = weeklyStats.strengthValue + weeklyStats.cardioValue + weeklyStats.activityValue;
      const breakdown = [
        {
          category: "力量",
          value: weeklyStats.strengthValue,
          percentage: rawSum > 0 
            ? (weeklyStats.strengthValue / rawSum) * 100 
            : 0,
        },
        {
          category: "有氧",
          value: weeklyStats.cardioValue,
          percentage: rawSum > 0 
            ? (weeklyStats.cardioValue / rawSum) * 100 
            : 0,
        },
        {
          category: "活动量",
          value: weeklyStats.activityValue,
          percentage: rawSum > 0 
            ? (weeklyStats.activityValue / rawSum) * 100 
            : 0,
        },
      ]
        .filter(item => item.value > 0) // 只返回有值的分类
        .sort((a, b) => b.value - a.value); // 按基准值降序排序
      
      res.json(breakdown);
    } catch (error) {
      res.status(500).json({ error: "获取分类统计失败" });
    }
  });

  // 获取特定运动类型的周平均值
  app.get("/api/stats/exercise-average/:exerciseId", async (req, res) => {
    try {
      const average = await storage.getExerciseWeeklyAverage(req.params.exerciseId);
      res.json({ average });
    } catch (error) {
      res.status(500).json({ error: "获取运动周平均值失败" });
    }
