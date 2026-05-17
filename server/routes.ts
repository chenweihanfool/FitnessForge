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
  // /api/auth/* 由 auth.ts 的 setupReplitAuth 處理（公開路由）
  // 其餘 /api/* 都需要登入
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

  // Auto-snapshot endpoint — called by GitHub Actions, protected by SNAPSHOT_SECRET header
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

      const mostRecent = stepsEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      res.json({
        id: mostRecent.id,
        exerciseId: stepsExercise.id,
        value: mostRecent.value,
        dailyAverage: Math.round(mostRecent.value / 7),
        date: mostRecent.date,
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
  });

  // 获取本周各运动类型进度和推荐
  app.get("/api/stats/weekly-progress", async (req, res) => {
    try {
      const progress = await storage.getWeeklyProgress();
      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: "获取本周进度失败" });
    }
  });

  // 获取本周每日贡献度热点图数据
  app.get("/api/stats/daily-contributions", async (req, res) => {
    try {
      const contributions = await storage.getDailyContributions();
      res.json(contributions);
    } catch (error) {
      res.status(500).json({ error: "获取每日贡献度失败" });
    }
  });

  // 获取指定日期的锻炼记录
  app.get("/api/stats/entries-by-date", async (req, res) => {
    try {
      const { date } = req.query;
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ error: "缺少日期参数" });
      }
      const entries = await storage.getEntriesByDate(date);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "获取当日锻炼记录失败" });
    }
  });

  // 获取指定周的详细数据
  app.get("/api/stats/week-details", async (req, res) => {
    try {
      const { weekStart } = req.query;
      
      if (!weekStart || typeof weekStart !== 'string') {
        return res.status(400).json({ error: "缺少weekStart参数" });
      }

      // 验证日期格式
      const date = new Date(weekStart);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: "weekStart日期格式无效" });
      }

      const details = await storage.getWeekDetails(weekStart);
      res.json(details);
    } catch (error) {
      console.error("获取周详细数据失败:", error);
      res.status(500).json({ error: "获取周详细数据失败" });
    }
  });

  // 获取生涯全览数据
  app.get("/api/stats/career-overview", async (req, res) => {
    try {
      const overview = await storage.getCareerOverview();
      res.json(overview);
    } catch (error) {
      console.error("获取生涯全览失败:", error);
      res.status(500).json({ error: "获取生涯全览失败" });
    }
  });

  // 获取本周各肌群训练统计
  app.get("/api/stats/muscle-group-weekly", async (req, res) => {
    try {
      const stats = await storage.getMuscleGroupWeeklyStats();
      res.json(stats);
    } catch (error) {
      console.error("获取肌群周统计失败:", error);
      res.status(500).json({ error: "获取肌群周统计失败" });
    }
  });

  // 获取肌群历史统计数据
  app.get("/api/stats/muscle-group-history", async (req, res) => {
    try {
      const history = await storage.getWeeklyMuscleStatsHistory();
      res.json(history);
    } catch (error) {
      console.error("获取肌群历史统计失败:", error);
      res.status(500).json({ error: "获取肌群历史统计失败" });
    }
  });

  // 获取肌群平均值统计
  app.get("/api/stats/muscle-group-averages", async (req, res) => {
    try {
      const averages = await storage.getMuscleGroupAverages();
      res.json(averages);
    } catch (error) {
      console.error("获取肌群平均值失败:", error);
      res.status(500).json({ error: "获取肌群平均值失败" });
    }
  });

  // 迁移历史肌群统计数据
  app.post("/api/admin/migrate-muscle-stats", async (req, res) => {
    try {
      const result = await storage.migrateHistoricalMuscleStats();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("迁移肌群统计失败:", error);
      res.status(500).json({ error: "迁移肌群统计失败" });
    }
  });

  app.post("/api/admin/recalculate-baselines", async (req, res) => {
    try {
      const result = await storage.recalculateAllBaselines();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("重新计算基线值失败:", error);
      res.status(500).json({ error: "重新计算基线值失败" });
    }
  });

  app.post("/api/admin/convert-exercise-unit", async (req, res) => {
    try {
      const { exerciseName, newUnit, valueMultiplier } = req.body;
      if (!exerciseName || !newUnit || !valueMultiplier) {
        return res.status(400).json({ error: "Missing exerciseName, newUnit, or valueMultiplier" });
      }
      const result = await storage.convertExerciseUnit(exerciseName, newUnit, valueMultiplier);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("转换运动单位失败:", error);
      res.status(500).json({ error: "转换运动单位失败" });
    }
  });

  // ==================== 用户设置 API ====================

  const DEFAULT_PLAN_CUSTOM_RULES = `週一到週四是上班日，強度保持中低：安排較短或較輕的訓練（有氧、核心），週一到週四中可有 1-2 天休息，但不要全部跳過。週五到週日是假日，可安排較高容量與較重的力量訓練，但不要把所有項目都集中在這三天。整體強度應自然地朝週末逐漸提升。`;

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllUserSettings();
      res.json({
        strengthWeight: parseFloat(settings['strengthWeight'] ?? '50'),
        cardioWeight: parseFloat(settings['cardioWeight'] ?? '30'),
        activityWeight: parseFloat(settings['activityWeight'] ?? '20'),
        planCustomRules: settings['planCustomRules'] ?? DEFAULT_PLAN_CUSTOM_RULES,
      });
    } catch (error) {
      console.error("获取设置失败:", error);
      res.status(500).json({ error: "获取设置失败" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { strengthWeight, cardioWeight, activityWeight } = req.body;
      const s = Number(strengthWeight);
      const c = Number(cardioWeight);
      const a = Number(activityWeight);
      if (isNaN(s) || isNaN(c) || isNaN(a) || s < 0 || c < 0 || a < 0) {
        return res.status(400).json({ error: "权重必须是非负数" });
      }
      const total = s + c + a;
      if (Math.abs(total - 100) > 0.01) {
        return res.status(400).json({ error: "权重总和必须为100" });
      }
      await storage.setUserSetting('strengthWeight', String(s));
      await storage.setUserSetting('cardioWeight', String(c));
      await storage.setUserSetting('activityWeight', String(a));
      res.json({ success: true, strengthWeight: s, cardioWeight: c, activityWeight: a });
    } catch (error) {
      console.error("保存设置失败:", error);
      res.status(500).json({ error: "保存设置失败" });
    }
  });

  app.post("/api/settings/plan-rules", async (req, res) => {
    try {
      const { planCustomRules } = req.body;
      if (typeof planCustomRules !== 'string') {
        return res.status(400).json({ error: "planCustomRules 必须是字串" });
      }
      await storage.setUserSetting('planCustomRules', planCustomRules.trim() || DEFAULT_PLAN_CUSTOM_RULES);
      res.json({ success: true, planCustomRules: planCustomRules.trim() || DEFAULT_PLAN_CUSTOM_RULES });
    } catch (error) {
      console.error("保存計畫規則失敗:", error);
      res.status(500).json({ error: "保存計畫規則失敗" });
    }
  });

  // ==================== 训练计划 API ====================

  const getCurrentWeekStart = (): string => {
    const TAIPEI_OFFSET = 8 * 60 * 60 * 1000;
    const now = new Date();
    const taipeiTimestamp = now.getTime() + TAIPEI_OFFSET;
    const taipeiDate = new Date(taipeiTimestamp);
    const taipeiDay = taipeiDate.getUTCDay();
    const diffToMonday = taipeiDay === 0 ? 6 : taipeiDay - 1;
    const mondayTaipei = new Date(Date.UTC(
      taipeiDate.getUTCFullYear(), taipeiDate.getUTCMonth(), taipeiDate.getUTCDate() - diffToMonday, 0, 0, 0, 0
    ));
    const weekStartUTC = new Date(mondayTaipei.getTime() - TAIPEI_OFFSET);
    return weekStartUTC.toISOString();
  };

  app.get("/api/plan/current", async (req, res) => {
    try {
      const weekStart = getCurrentWeekStart();
      const plan = await storage.getWeeklyPlan(weekStart);
      if (!plan) {
        return res.json(null);
      }
      res.json(plan);
    } catch (error) {
      console.error("获取训练计划失败:", error);
      res.status(500).json({ error: "获取训练计划失败" });
    }
  });

  app.get("/api/plan/recommend-mode", async (req, res) => {
    try {
      const ROLLING_WEEKS = 8;
      const allStats = await storage.getAllWeeklyStats();
      if (allStats.length < 4) {
        return res.json({ recommendation: 'normal', reason: '歷史週數不足，建議先按正常週累積數據。', matchedCondition: 4, recent4Avg: 0, rollingAvg: 0, rollingWeeks: 0, aboveAvgCount: 0, lastWeekTotal: 0, diffPct: 0 });
      }

      const currentWeekStart = getCurrentWeekStart();
      const completed = allStats
        .filter(w => w.weekStart !== currentWeekStart)
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

      if (completed.length < 4) {
        return res.json({ recommendation: 'normal', reason: '完成週數不足，建議按正常週訓練。', matchedCondition: 4, recent4Avg: 0, rollingAvg: 0, rollingWeeks: 0, aboveAvgCount: 0, lastWeekTotal: 0, diffPct: 0 });
      }

      const rollingWindow = completed.slice(-ROLLING_WEEKS);
      const rollingAvg = rollingWindow.reduce((s, w) => s + w.totalBaselineValue, 0) / rollingWindow.length;
      const recent4 = completed.slice(-4);
      const recent4Avg = recent4.reduce((s, w) => s + w.totalBaselineValue, 0) / 4;
      const lastWeek = completed[completed.length - 1];
      const aboveAvgCount = recent4.filter(w => w.totalBaselineValue > rollingAvg).length;

      let recommendation: 'recovery' | 'normal';
      let reason: string;
      let matchedCondition: number;

      const diffPct = Math.round((recent4Avg / rollingAvg - 1) * 100);
      const c1Met = recent4Avg > rollingAvg * 1.12;
      const c2Met = aboveAvgCount >= 3 && lastWeek.totalBaselineValue > rollingAvg * 1.1;
      const c3Met = recent4Avg < rollingAvg * 0.85;

      if (c1Met) {
        matchedCondition = 1;
        recommendation = 'recovery';
        reason = `近4週均分（${recent4Avg.toFixed(0)}）高於近${rollingWindow.length}週滾動均值（${rollingAvg.toFixed(0)}）約 ${diffPct}%，建議安排恢復週讓身體適應。`;
      } else if (c2Met) {
        matchedCondition = 2;
        recommendation = 'recovery';
        reason = `近4週中有 ${aboveAvgCount} 週超過滾動均值，且上週表現特別突出（${lastWeek.totalBaselineValue.toFixed(0)}），適合安排恢復週。`;
      } else if (c3Met) {
        matchedCondition = 3;
        recommendation = 'normal';
        reason = `近4週均分（${recent4Avg.toFixed(0)}）低於滾動均值（${rollingAvg.toFixed(0)}），建議正常週維持訓練量。`;
      } else {
        matchedCondition = 4;
        recommendation = 'normal';
        reason = `近期訓練量穩定（均分 ${recent4Avg.toFixed(0)}，滾動均值 ${rollingAvg.toFixed(0)}），建議維持正常週節奏。`;
      }

      res.json({
        recommendation,
        reason,
        matchedCondition,
        recent4Avg: Math.round(recent4Avg),
        rollingAvg: Math.round(rollingAvg),
        rollingWeeks: rollingWindow.length,
        aboveAvgCount,
        lastWeekTotal: Math.round(lastWeek.totalBaselineValue),
        diffPct,
      });
    } catch (error) {
      console.error("取得週建議失敗:", error);
      res.status(500).json({ error: "取得建議失敗" });
    }
  });

  app.post("/api/plan/generate", async (req, res) => {
    try {
      const { mode, userRequest } = req.body;
      if (!mode || !['recovery', 'normal'].includes(mode)) {
        return res.status(400).json({ error: "模式必须是 recovery 或 normal" });
      }

      const ROLLING_WEEKS = 8;
      const MIN_ROLLING_WEEKS = 4;
      const [allExercises, allEntries, genSettings] = await Promise.all([
        storage.getExercises(),
        storage.getWorkoutEntries(),
        storage.getAllUserSettings(),
      ]);

      const rollingTotalStats = await storage.getRollingTotalStats(ROLLING_WEEKS);
      if (!rollingTotalStats || rollingTotalStats.weekCount < MIN_ROLLING_WEEKS) {
        return res.status(400).json({ error: `需要至少 ${MIN_ROLLING_WEEKS} 週完成的訓練數據才能生成計畫。目前有 ${rollingTotalStats?.weekCount ?? 0} 週數據。` });
      }

      const currentWeekStartDate = new Date(getCurrentWeekStart());
      const rollingCutoff = new Date(currentWeekStartDate);
      rollingCutoff.setDate(rollingCutoff.getDate() - ROLLING_WEEKS * 7);

      const entryMap = new Map<string, { values: number[]; sets: number[]; baselines: number[] }>();
      const weeklyBaselineMap = new Map<string, Map<string, number>>();
      const exerciseCatMapGen = new Map(allExercises.map(ex => [ex.id, ex]));
      const weeklyWeightedCats = new Map<string, { s: number; c: number; a: number }>();
      for (const entry of allEntries) {
        const entryDate = new Date(entry.date);
        if (entryDate < rollingCutoff || entryDate >= currentWeekStartDate) continue;
        if (!entryMap.has(entry.exerciseId)) entryMap.set(entry.exerciseId, { values: [], sets: [], baselines: [] });
        const rec = entryMap.get(entry.exerciseId)!;
        if (entry.value > 0) rec.values.push(entry.value);
        if (entry.sets != null && entry.sets > 0) rec.sets.push(entry.sets);
        if (entry.baselineValue != null && entry.baselineValue > 0) rec.baselines.push(entry.baselineValue);

        const day = entryDate.getUTCDay();
        const diff = day === 0 ? -6 : 1 - day;
        const weekStart = new Date(entryDate);
        weekStart.setUTCDate(weekStart.getUTCDate() + diff);
        const weekKey = weekStart.toISOString().substring(0, 10);
        if (!weeklyBaselineMap.has(entry.exerciseId)) weeklyBaselineMap.set(entry.exerciseId, new Map());
        const wm = weeklyBaselineMap.get(entry.exerciseId)!;
        wm.set(weekKey, (wm.get(weekKey) ?? 0) + (entry.baselineValue ?? 0));

        if (!weeklyWeightedCats.has(weekKey)) weeklyWeightedCats.set(weekKey, { s: 0, c: 0, a: 0 });
        const wcat = weeklyWeightedCats.get(weekKey)!;
        const exCat = exerciseCatMapGen.get(entry.exerciseId);
        const baseline = entry.baselineValue ?? 0;
        const splitRatio = (exCat as Record<string, unknown>)?.splitRatio as number ?? 0;
        const splitCat = (exCat as Record<string, unknown>)?.splitCategory as string | null ?? null;
        const addCat = (cat: string | null, val: number) => {
          if (cat === '力量') wcat.s += val;
          else if (cat === '有氧') wcat.c += val;
          else if (cat === '活动量') wcat.a += val;
          else wcat.s += val;
        };
        addCat(exCat?.category ?? null, baseline * (1 - splitRatio));
        if (splitRatio > 0 && splitCat) addCat(splitCat, baseline * splitRatio);
      }

      const genSW = parseFloat(genSettings['strengthWeight'] ?? '50') / 100;
      const genCW = parseFloat(genSettings['cardioWeight'] ?? '30') / 100;
      const genAW = parseFloat(genSettings['activityWeight'] ?? '20') / 100;
      const weeklyWeightedSum = Array.from(weeklyWeightedCats.values())
        .reduce((s, wk) => s + (wk.s * genSW + wk.c * genCW + wk.a * genAW), 0);
      const rollingWeightedAvg = ROLLING_WEEKS > 0 ? weeklyWeightedSum / ROLLING_WEEKS : 0;

      const median = (arr: number[]) => {
        if (!arr.length) return null;
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
      };
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      const muscleKeys: Array<[string, string]> = [
        ['muscleChest', '胸'], ['muscleBack', '背'], ['muscleLegs', '腿'],
        ['muscleShoulders', '肩'], ['muscleArms', '二頭/三頭'],
        ['muscleCore', '核心'], ['muscleGlutes', '臀'], ['muscleFullBody', '全身'],
      ];

      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const targetMultiplier = mode === 'recovery' ? 0.75 : 1.05;

      const exerciseDataRaw = allExercises
        .filter(e => e.name !== '每周平均步数')
        .map(e => {
          const hist = entryMap.get(e.id);
          if (!hist || hist.values.length === 0 || hist.sets.length === 0 || hist.baselines.length === 0) return null;

          const medianValue = Math.max(1, Math.round(median(hist.values)!));
          const medianSets = Math.max(1, Math.round(median(hist.sets)!));
          const perSessionBaseline = median(hist.baselines)!;

          const weeklyVals = Array.from((weeklyBaselineMap.get(e.id) ?? new Map()).values());
          const weeklyContrib = avg(weeklyVals);

          if (weeklyContrib <= 0 || perSessionBaseline <= 0) return null;

          const rawSessions = (weeklyContrib * targetMultiplier) / perSessionBaseline;
          const sessionsPerWeek = Math.min(3, Math.max(1, Math.round(rawSessions)));

          const muscleHits = muscleKeys
            .filter(([key]) => ((e as Record<string, unknown>)[key] as number ?? 0) > 0)
            .map(([key, label]) => ({ key, label, pct: (e as Record<string, unknown>)[key] as number }));
          const musclesStr = muscleHits.map(m => `${m.label}${m.pct}%`).join('/');
          const muscleKeySet = new Set(muscleHits.map(m => m.key));

          const weightFactor = (e as Record<string, unknown>).weightFactor as number ?? 1;
          const historyRef = (e.name === '跑步' || e.name === '跑步機負重')
            ? `${medianValue}分鐘 + ${medianSets}km`
            : (e.category === '力量' && weightFactor > 1)
              ? `${weightFactor}kg × ${medianValue}${e.unit} × ${medianSets}組`
              : `${medianValue}${e.unit} × ${medianSets}組`;

          const weeksWithData = weeklyVals.length;
          const avgPerWeek = weeksWithData > 0 ? (weeksWithData / ROLLING_WEEKS * sessionsPerWeek).toFixed(1) : '0';
          const reason = `近${ROLLING_WEEKS}週均${avgPerWeek}次/週 | ${musclesStr || '通用'}`;

          return {
            id: e.id,
            name: e.name,
            unit: e.unit,
            category: e.category,
            targetValue: medianValue,
            targetSets: medianSets,
            medianValueCap: medianValue,
            medianSetsCap: medianSets,
            perSessionBaseline,
            weeklyContrib,
            sessionsPerWeek,
            muscles: musclesStr,
            muscleKeySet,
            historyRef,
            reason,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      if (exerciseDataRaw.length === 0) {
        return res.status(400).json({ error: "沒有足夠的近期訓練數據來生成計畫，請先累積 4 週以上的訓練紀錄。" });
      }

      const MAX_TOTAL_SLOTS = mode === 'recovery' ? 9 : 15;
      const MAX_TRAINING_DAYS = mode === 'recovery' ? 3 : 5;
      const cappedData = exerciseDataRaw.map(e => ({
        ...e,
        sessionsPerWeek: e.category === '力量' ? Math.min(2, e.sessionsPerWeek) : e.sessionsPerWeek,
      }));

      // --- Phase 1: Iterative greedy — guarantee one slot per exercise ---
      const coveredMuscles = new Set<string>();
      const exercisesInPlan: typeof cappedData = [];
      let runningTotal = 0;
      const pool = [...cappedData];

      while (runningTotal < MAX_TOTAL_SLOTS && pool.length > 0) {
        let bestIdx = 0;
        let bestNewMuscles = -1;
        let bestContrib = -1;
        for (let i = 0; i < pool.length; i++) {
          const newMuscles = [...pool[i].muscleKeySet].filter(k => !coveredMuscles.has(k)).length;
          if (newMuscles > bestNewMuscles || (newMuscles === bestNewMuscles && pool[i].weeklyContrib > bestContrib)) {
            bestIdx = i;
            bestNewMuscles = newMuscles;
            bestContrib = pool[i].weeklyContrib;
          }
        }
        const picked = pool.splice(bestIdx, 1)[0];
        exercisesInPlan.push({ ...picked, sessionsPerWeek: 1 });
        runningTotal += 1;
        for (const k of picked.muscleKeySet) coveredMuscles.add(k);
      }

      // --- Phase 2: Distribute remaining slots by weeklyContrib priority ---
      let remainingSlots = MAX_TOTAL_SLOTS - runningTotal;
      if (remainingSlots > 0) {
        const expansionOrder = exercisesInPlan
          .map((_, i) => i)
          .sort((a, b) => exercisesInPlan[b].weeklyContrib - exercisesInPlan[a].weeklyContrib);
        for (const idx of expansionOrder) {
          if (remainingSlots <= 0) break;
          const ex = exercisesInPlan[idx];
          const originalMax = cappedData.find(c => c.id === ex.id)!.sessionsPerWeek;
          const canAdd = Math.min(originalMax - ex.sessionsPerWeek, remainingSlots);
          if (canAdd > 0) {
            ex.sessionsPerWeek += canAdd;
            remainingSlots -= canAdd;
          }
        }
      }

      const targetBaseline = Math.round(rollingWeightedAvg * targetMultiplier);

      const computeProjectedBaseline = (exercises: typeof exercisesInPlan) => {
        let sTotal = 0, cTotal = 0, aTotal = 0;
        for (const e of exercises) {
          const raw = e.sessionsPerWeek * e.perSessionBaseline;
          const ex = exerciseCatMapGen.get(e.id);
          const splitRatio = (ex as Record<string, unknown>)?.splitRatio as number ?? 0;
          const splitCat = (ex as Record<string, unknown>)?.splitCategory as string | null ?? null;
          const addTo = (cat: string | null, val: number) => {
            if (cat === '力量') sTotal += val;
            else if (cat === '有氧') cTotal += val;
            else if (cat === '活动量') aTotal += val;
            else sTotal += val;
          };
          addTo(e.category, raw * (1 - splitRatio));
          if (splitRatio > 0 && splitCat) addTo(splitCat, raw * splitRatio);
        }
        return sTotal * genSW + cTotal * genCW + aTotal * genAW;
      };

      const computeScaledProjectedBaseline = (exercises: typeof exercisesInPlan) => {
        let sTotal = 0, cTotal = 0, aTotal = 0;
        for (const e of exercises) {
          const scaleFactor = e.medianValueCap > 0 ? e.targetValue / e.medianValueCap : 1;
          const raw = e.sessionsPerWeek * e.perSessionBaseline * scaleFactor;
          const ex = exerciseCatMapGen.get(e.id);
          const splitRatio = (ex as Record<string, unknown>)?.splitRatio as number ?? 0;
          const splitCat = (ex as Record<string, unknown>)?.splitCategory as string | null ?? null;
          const addTo = (cat: string | null, val: number) => {
            if (cat === '力量') sTotal += val;
            else if (cat === '有氧') cTotal += val;
            else if (cat === '活动量') aTotal += val;
            else sTotal += val;
          };
          addTo(e.category, raw * (1 - splitRatio));
          if (splitRatio > 0 && splitCat) addTo(splitCat, raw * splitRatio);
        }
        return sTotal * genSW + cTotal * genCW + aTotal * genAW;
      };

      const calibrateVolume = (exercises: typeof exercisesInPlan) => {
        const projected = computeProjectedBaseline(exercises);
        if (projected > 0 && targetBaseline > 0 && Math.abs(projected - targetBaseline) / targetBaseline > 0.05) {
          const scale = targetBaseline / projected;
          for (const e of exercises) {
            e.targetValue = Math.min(Math.max(1, Math.round(e.targetValue * scale)), e.medianValueCap);
            e.targetSets = Math.min(e.targetSets, e.medianSetsCap);
          }
        }
      };

      calibrateVolume(exercisesInPlan);

      // --- Parse scheduling constraints from settings (planCustomRules) via OpenAI ---
      let aiDayPreference: number[] | null = null;
      let aiExcludedExerciseNames: string[] = [];
      let aiRequiredExercises: { name: string; minSessions: number }[] = [];
      let aiNotes = '';
      const planCustomRules = genSettings['planCustomRules'] ?? DEFAULT_PLAN_CUSTOM_RULES;
      try {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });
        const exerciseNames = allExercises.filter(e => e.name !== '每周平均步数').map(e => e.name);
        const resp = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_completion_tokens: 800,
          messages: [
            {
              role: 'system',
              content: `You parse fitness scheduling preferences into JSON. Days: 1=Mon,2=Tue,...,7=Sun.
Available exercises: ${exerciseNames.join(', ')}
Return JSON with these fields:
- "preferredDays": [numbers] — days the user wants to train
- "excludedDays": [numbers] — days the user wants to rest
- "excludedExercises": ["name"] — exercises to exclude entirely
- "requiredExercises": [{"name":"exercise name","minSessions":N}] — exercises that MUST appear at least N times per week (e.g. "每周至少深蹲一次" → [{"name":"深蹲","minSessions":1}])
- "notes": "brief note"
Match exercise names exactly to the available exercises list. Return ONLY valid JSON, no markdown.`
            },
            { role: 'user', content: planCustomRules.trim() }
          ],
          response_format: { type: 'json_object' },
        });
        const parsed = JSON.parse(resp.choices[0]?.message?.content || '{}');
        if (Array.isArray(parsed.preferredDays) && parsed.preferredDays.length > 0) {
          aiDayPreference = parsed.preferredDays.filter((d: unknown) => typeof d === 'number' && d >= 1 && d <= 7);
        }
        if (Array.isArray(parsed.excludedDays)) {
          const excDays = new Set(parsed.excludedDays.filter((d: unknown) => typeof d === 'number' && d >= 1 && d <= 7));
          if (excDays.size > 0 && !aiDayPreference) {
            aiDayPreference = [1, 2, 3, 4, 5, 6, 7].filter(d => !excDays.has(d));
          } else if (excDays.size > 0 && aiDayPreference) {
            aiDayPreference = aiDayPreference.filter(d => !excDays.has(d));
          }
        }
        if (Array.isArray(parsed.excludedExercises)) {
          aiExcludedExerciseNames = parsed.excludedExercises.filter((n: unknown) => typeof n === 'string');
        }
        if (Array.isArray(parsed.requiredExercises)) {
          aiRequiredExercises = parsed.requiredExercises
            .filter((r: unknown) => r && typeof (r as Record<string, unknown>).name === 'string')
            .map((r: Record<string, unknown>) => ({
              name: String(r.name),
              minSessions: typeof r.minSessions === 'number' ? Math.max(1, Math.round(r.minSessions)) : 1,
            }));
        }
        if (parsed.notes) aiNotes = String(parsed.notes);
      } catch (aiErr) {
        console.error("AI排課偏好解析失敗，使用預設邏輯:", aiErr);
      }

      if (aiExcludedExerciseNames.length > 0) {
        const excSet = new Set(aiExcludedExerciseNames.map(n => n.toLowerCase()));
        for (let i = exercisesInPlan.length - 1; i >= 0; i--) {
          if (excSet.has(exercisesInPlan[i].name.toLowerCase())) {
            exercisesInPlan.splice(i, 1);
          }
        }
        calibrateVolume(exercisesInPlan);
      }

      // --- Enforce required exercises from settings ---
      if (aiRequiredExercises.length > 0) {
        const inPlanNames = new Set(exercisesInPlan.map(e => e.name.toLowerCase()));
        for (const req of aiRequiredExercises) {
          const nameLc = req.name.toLowerCase();
          const existing = exercisesInPlan.find(e => e.name.toLowerCase() === nameLc);
          if (existing) {
            // Ensure minimum sessions
            if (existing.sessionsPerWeek < req.minSessions) {
              existing.sessionsPerWeek = req.minSessions;
            }
          } else {
            // Add from cappedData if available, else from exerciseDataRaw
            const source = cappedData.find(e => e.name.toLowerCase() === nameLc)
              ?? exerciseDataRaw.find(e => e.name.toLowerCase() === nameLc);
            if (source) {
              exercisesInPlan.push({ ...source, sessionsPerWeek: req.minSessions });
            }
          }
        }
        calibrateVolume(exercisesInPlan);
      }

      // --- Select training days ---
      const neededDays = Math.min(MAX_TRAINING_DAYS, Math.max(1, Math.ceil(
        exercisesInPlan.reduce((s, e) => s + e.sessionsPerWeek, 0) / 3
      )));

      // Fisher-Yates shuffle helper
      const shuffle = <T>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      let dayPreferenceOrder: number[];
      if (aiDayPreference && aiDayPreference.length > 0) {
        const aiSet = new Set(aiDayPreference);
        const nonAi = shuffle([1, 2, 3, 4, 5, 6, 7].filter(d => !aiSet.has(d)));
        dayPreferenceOrder = [...shuffle([...aiDayPreference]), ...nonAi];
      } else {
        // Randomly shuffle within weekends and weekdays, but keep weekends preferred
        const weekends = shuffle([6, 7]);
        const weekdays = shuffle([1, 2, 3, 4, 5]);
        dayPreferenceOrder = [...weekends, ...weekdays];
      }
      const trainingDays = dayPreferenceOrder.slice(0, neededDays).sort((a, b) => a - b);

      // --- Randomised scheduler ---
      interface PlanSlot {
        exerciseId: string;
        exerciseName: string;
        targetValue: number;
        targetSets: number;
        unit: string;
        category: string | null;
        weeklyContrib: number;
        reason: string;
        historyRef: string;
        targetItemBaseline: number;
        weightFactor?: number;
      }

      const getCatWeightGen = (cat: string | null) =>
        cat === '力量' ? genSW : cat === '有氧' ? genCW : cat === '活动量' ? genAW : genSW;

      const allSlots: PlanSlot[] = exercisesInPlan.flatMap(e => {
        // Scale perSessionBaseline by how much targetValue was scaled from median
        const scaleFactor = e.medianValueCap > 0 ? e.targetValue / e.medianValueCap : 1;
        const exObj = exerciseCatMapGen.get(e.id);
        const splitRatio = (exObj as Record<string, unknown>)?.splitRatio as number ?? 0;
        const splitCat = (exObj as Record<string, unknown>)?.splitCategory as string | null ?? null;
        // Weight targetItemBaseline by category so per-exercise values sum to ~targetBaseline
        const effectiveWeight = getCatWeightGen(e.category) * (1 - splitRatio)
          + (splitRatio > 0 && splitCat ? getCatWeightGen(splitCat) * splitRatio : 0);
        const targetItemBaseline = Math.round(e.perSessionBaseline * scaleFactor * effectiveWeight);
        const wf = (exObj as Record<string, unknown>)?.weightFactor as number ?? 0;
        return Array.from({ length: e.sessionsPerWeek }, () => ({
          exerciseId: e.id,
          exerciseName: e.name,
          targetValue: e.targetValue,
          targetSets: e.targetSets,
          unit: e.unit,
          category: e.category,
          weeklyContrib: e.weeklyContrib,
          reason: e.reason,
          historyRef: e.historyRef,
          targetItemBaseline,
          weightFactor: wf > 1 ? wf : undefined,
        }));
      });

      // Sort slots by priority tier, then shuffle within each tier for variety
      const contribBuckets = new Map<number, PlanSlot[]>();
      for (const s of allSlots) {
        const bucket = Math.round(s.weeklyContrib / 10); // group into buckets of ~10
        if (!contribBuckets.has(bucket)) contribBuckets.set(bucket, []);
        contribBuckets.get(bucket)!.push(s);
      }
      const sortedBucketKeys = [...contribBuckets.keys()].sort((a, b) => b - a);
      allSlots.length = 0;
      for (const key of sortedBucketKeys) {
        allSlots.push(...shuffle(contribBuckets.get(key)!));
      }

      // Shuffle weekend and weekday index lists so exercise-day pairing varies each generation
      const weekendDayIdxs = shuffle(trainingDays.map((d, i) => ({ d, i })).filter(x => x.d >= 5).map(x => x.i));
      const weekdayDayIdxs = shuffle(trainingDays.map((d, i) => ({ d, i })).filter(x => x.d < 5).map(x => x.i));

      const dayBuckets = new Map<number, PlanSlot[]>(trainingDays.map(d => [d, []]));
      const lastPlacedDay = new Map<string, number>();
      const lastPlacedIdx = new Map<string, number>();

      for (const slot of allSlots) {
        const prefIdxs = slot.category === '力量'
          ? [...weekendDayIdxs, ...weekdayDayIdxs]
          : [...weekdayDayIdxs, ...weekendDayIdxs];

        const lastDay = lastPlacedDay.get(slot.exerciseId);
        const lastIdx = lastPlacedIdx.get(slot.exerciseId);
        const nonConsecIdxs = prefIdxs.filter(i => {
          if (lastDay === undefined) return true;
          const candidateDay = trainingDays[i];
          const calDiff = Math.abs(candidateDay - lastDay);
          const calOk = Math.min(calDiff, 7 - calDiff) > 1;
          const idxOk = lastIdx === undefined || Math.abs(i - lastIdx) > 1;
          return calOk && idxOk;
        });
        if (nonConsecIdxs.length === 0 && lastDay !== undefined) continue;
        const candidateIdxs = nonConsecIdxs.length > 0 ? nonConsecIdxs : prefIdxs;

        const sortedCandidates = [...candidateIdxs].sort((a, b) => {
          const la = dayBuckets.get(trainingDays[a])!.length;
          const lb = dayBuckets.get(trainingDays[b])!.length;
          return la - lb;
        });

        const chosenIdx = sortedCandidates.find(i =>
          (dayBuckets.get(trainingDays[i])?.length ?? 0) < 4
        ) ?? sortedCandidates[0];

        if (chosenIdx !== undefined) {
          const chosenDay = trainingDays[chosenIdx];
          dayBuckets.get(chosenDay)!.push(slot);
          lastPlacedDay.set(slot.exerciseId, chosenDay);
          lastPlacedIdx.set(slot.exerciseId, chosenIdx);
        }
      }

      const parsedPlan: PlanDayItem[] = trainingDays
        .map(d => ({
          day: d,
          dayName: dayNames[d - 1],
          exercises: (dayBuckets.get(d) ?? []).sort((a, b) => {
            const rank = (c: string | null) => c === '力量' ? 0 : c === '有氧' ? 1 : 2;
            return rank(a.category) - rank(b.category);
          }),
        }))
        .filter(d => d.exercises.length > 0);

      const weekStart = getCurrentWeekStart();
      const planPayload = {
        targetBaseline,
        aiNotes: aiNotes || undefined,
        days: parsedPlan,
      };
      const saved = await storage.saveWeeklyPlan({
        weekStart,
        mode: mode as 'recovery' | 'normal',
        planJson: JSON.stringify(planPayload),
      });

      res.json(saved);
    } catch (error) {
      console.error("生成训练计划失败:", error);
      res.status(500).json({ error: "生成训练计划失败", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/plan/progress", async (req, res) => {
    try {
      const weekStart = getCurrentWeekStart();
      const plan = await storage.getWeeklyPlan(weekStart);
      if (!plan) {
        return res.json(null);
      }

      // Support both old format (array) and new format ({ targetBaseline, days })
      const parsedJson = JSON.parse(plan.planJson);
      const planDays: PlanDayItem[] = Array.isArray(parsedJson) ? parsedJson : parsedJson.days;
      const storedTargetBaseline: number = Array.isArray(parsedJson) ? 0 : (parsedJson.targetBaseline ?? 0);

      const [entries, allExercises, settings] = await Promise.all([
        storage.getWorkoutEntries(),
        storage.getExercises(),
        storage.getAllUserSettings(),
      ]);

      const weekStartDate = new Date(weekStart);
      const TAIPEI_OFFSET = 8 * 60 * 60 * 1000;
      const taipeiMonday = new Date(weekStartDate.getTime() + TAIPEI_OFFSET);
      const weekEndDate = new Date(Date.UTC(
        taipeiMonday.getUTCFullYear(), taipeiMonday.getUTCMonth(), taipeiMonday.getUTCDate() + 6, 23, 59, 59, 999
      ));
      const weekEnd = new Date(weekEndDate.getTime() - TAIPEI_OFFSET);

      const weekEntries = entries.filter(e => {
        const d = new Date(e.date);
        return d >= weekStartDate && d <= weekEnd;
      });

      // Group all week entries by exerciseId (for make-up training support)
      // An entry recorded on ANY day of the week can satisfy a plan item on a different day.
      interface WeekEntry { volume: number; sets: number; baselineValue: number; date: Date; }
      const weekExerciseEntries = new Map<string, WeekEntry[]>();
      for (const entry of weekEntries) {
        if (!weekExerciseEntries.has(entry.exerciseId)) weekExerciseEntries.set(entry.exerciseId, []);
        weekExerciseEntries.get(entry.exerciseId)!.push({
          volume: entry.value * (entry.sets || 1),
          sets: entry.sets || 1,
          baselineValue: entry.baselineValue ?? 0,
          date: new Date(entry.date),
        });
      }
      // Sort each exercise's entries by date ascending
      for (const arr of Array.from(weekExerciseEntries.values())) {
        arr.sort((a, b) => a.date.getTime() - b.date.getTime());
      }

      // Build plan occurrences per exercise, sorted by day ascending
      // exerciseId -> sorted list of { dayIndex, targetVolume }
      interface Occurrence { dayIndex: number; day: number; targetVolume: number; }
      const exerciseOccurrences = new Map<string, Occurrence[]>();
      planDays.forEach((day, di) => {
        day.exercises.forEach(ex => {
          if (!exerciseOccurrences.has(ex.exerciseId)) exerciseOccurrences.set(ex.exerciseId, []);
          exerciseOccurrences.get(ex.exerciseId)!.push({ dayIndex: di, day: day.day, targetVolume: ex.targetValue * ex.targetSets });
        });
      });

      // Greedy match: i-th occurrence (sorted by day) gets i-th actual entry (sorted by date)
      // key: `${exerciseId}__${dayIndex}` -> matched WeekEntry | null
      const occurrenceMatch = new Map<string, WeekEntry | null>();
      for (const [exId, occs] of Array.from(exerciseOccurrences.entries())) {
        const sortedOccs = [...occs].sort((a, b) => a.day - b.day);
        const entries = weekExerciseEntries.get(exId) ?? [];
        sortedOccs.forEach((occ, i) => {
          occurrenceMatch.set(`${exId}__${occ.dayIndex}`, entries[i] ?? null);
        });
      }

      let totalPlanned = 0;
      let totalMet = 0;

      // targetBaseline: read from stored plan (computed at generation time, no DB scan needed)
      const targetBaseline = storedTargetBaseline;

      // actualBaseline: compute from week entries using exercise categories + user weights.
      // This avoids calling slow getAllWeeklyStats() / getWeeklyStats() on production.
      const exerciseMap = new Map(allExercises.map(ex => [ex.id, ex]));
      const sW = parseFloat(settings['strengthWeight'] ?? '50') / 100;
      const cW = parseFloat(settings['cardioWeight'] ?? '30') / 100;
      const aW = parseFloat(settings['activityWeight'] ?? '20') / 100;

      let strengthTotal = 0, cardioTotal = 0, activityTotal = 0;
      for (const entry of weekEntries) {
        const ex = exerciseMap.get(entry.exerciseId);
        const baseline = entry.baselineValue ?? 0;
        if (!ex) { strengthTotal += baseline; continue; } // fallback: treat as strength
        const splitRatio = (ex as Record<string, unknown>).splitRatio as number ?? 0;
        const splitCat = (ex as Record<string, unknown>).splitCategory as string | null ?? null;
        const primaryBaseline = baseline * (1 - splitRatio);
        const secondaryBaseline = baseline * splitRatio;
        const addTo = (cat: string | null, val: number) => {
          if (cat === '力量') strengthTotal += val;
          else if (cat === '有氧') cardioTotal += val;
          else if (cat === '活动量') activityTotal += val;
          else strengthTotal += val; // fallback
        };
        addTo(ex.category, primaryBaseline);
        if (splitRatio > 0 && splitCat) addTo(splitCat, secondaryBaseline);
      }
      const actualBaseline = Math.round(strengthTotal * sW + cardioTotal * cW + activityTotal * aW);

      const daysWithProgress = planDays.map((day, dayIndex) => ({
        ...day,
        exercises: day.exercises.map(ex => {
          totalPlanned++;
          const itemTarget = ex.targetValue * ex.targetSets;
          const matched = occurrenceMatch.get(`${ex.exerciseId}__${dayIndex}`);
          const volume = matched?.volume ?? 0;
          const setsActual = matched?.sets ?? 0;
          // Apply category weight so per-exercise values are consistent with the weighted header total
          const exObj2 = exerciseMap.get(ex.exerciseId);
          const getCatWeightProg = (cat: string | null) => cat === '力量' ? sW : cat === '有氧' ? cW : cat === '活动量' ? aW : sW;
          const exSplitRatio = (exObj2 as Record<string, unknown>)?.splitRatio as number ?? 0;
          const exSplitCat = (exObj2 as Record<string, unknown>)?.splitCategory as string | null ?? null;
          const exEffWeight = getCatWeightProg(exObj2?.category ?? null) * (1 - exSplitRatio)
            + (exSplitRatio > 0 && exSplitCat ? getCatWeightProg(exSplitCat) * exSplitRatio : 0);
          const actualBaselineValue = Math.round((matched?.baselineValue ?? 0) * exEffWeight * 10) / 10;
          const targetItemBaseline = (ex as Record<string, unknown>).targetItemBaseline as number ?? 0;

          let status: 'met' | 'partial' | 'not_met';
          if (volume >= itemTarget) {
            status = 'met';
            totalMet++;
          } else if (volume > 0) {
            status = 'partial';
          } else {
            status = 'not_met';
          }

          return {
            ...ex,
            actualValue: Math.round(volume * 10) / 10,
            actualSets: setsActual,
            actualBaselineValue,
            targetItemBaseline,
            status,
          };
        }),
      }));

      res.json({
        weekStart: plan.weekStart,
        mode: plan.mode,
        generatedAt: plan.generatedAt,
        days: daysWithProgress,
        totalPlanned,
        totalMet,
        completionPercentage: totalPlanned > 0 ? Math.round((totalMet / totalPlanned) * 100) : 0,
        targetBaseline: Math.round(targetBaseline),
        actualBaseline: Math.round(actualBaseline),
        baselinePercentage: targetBaseline > 0 ? Math.round((actualBaseline / targetBaseline) * 100) : 0,
      });
    } catch (error) {
      console.error("获取训练进度失败:", error);
      res.status(500).json({ error: "获取训练进度失败" });
    }
  });

  // ==================== CSV 导入导出 API ====================

  // CSV 导入
  app.post("/api/import", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send("未上传文件");
      }

      const csvData = req.file.buffer.toString("utf-8");
      const parsed = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
      });

      if (parsed.errors.length > 0) {
        return res.status(400).send("CSV文件格式错误");
      }

      const exerciseMap = new Map<string, string>(); // name -> id
      let exercisesCount = 0;
      let entriesCount = 0;

      // 处理每一行数据
      for (const row of parsed.data as any[]) {
        const exerciseName = row["运动名称"] || row["name"];
        const unit = row["单位"] || row["unit"];
        const weightFactor = parseFloat(row["重量系数"] || row["weightFactor"] || "1");
        const value = parseFloat(row["数据值"] || row["value"]);
        const dateStr = row["日期"] || row["date"];
        const notes = row["备注"] || row["notes"] || "";

        if (!exerciseName || !unit || isNaN(value) || !dateStr) {
          continue; // 跳过无效行
        }

        // 创建或获取运动类型
        let exerciseId = exerciseMap.get(exerciseName);
        if (!exerciseId) {
          const exercises = await storage.getExercises();
          const existing = exercises.find(e => e.name === exerciseName && e.unit === unit);
          
          if (existing) {
            exerciseId = existing.id;
          } else {
            const newExercise = await storage.createExercise({
              name: exerciseName,
              unit,
              weightFactor: isNaN(weightFactor) ? 1 : weightFactor,
              splitRatio: 0,
              muscleChest: 0,
              muscleBack: 0,
              muscleLegs: 0,
              muscleShoulders: 0,
              muscleArms: 0,
              muscleCore: 0,
              muscleGlutes: 0,
              muscleFullBody: 0,
              movementCoefficient: 1,
              intensityFactor: 1,
            });
            exerciseId = newExercise.id;
            exercisesCount++;
          }
          
          exerciseMap.set(exerciseName, exerciseId);
        }

        // 创建运动记录
        await storage.createWorkoutEntry({
          exerciseId,
          value,
          date: dateStr,
          notes: notes || undefined,
        });
        entriesCount++;
      }

      res.json({ exercisesCount, entriesCount });
    } catch (error) {
      console.error("导入错误:", error);
      res.status(500).send("导入失败");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
