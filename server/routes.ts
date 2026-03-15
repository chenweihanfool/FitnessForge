import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExerciseSchema, insertWorkoutEntrySchema, type PlanDayItem } from "@shared/schema";
import multer from "multer";
import Papa from "papaparse";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
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
      const { mode } = req.body;
      if (!mode || !['recovery', 'normal'].includes(mode)) {
        return res.status(400).json({ error: "模式必须是 recovery 或 normal" });
      }

      const ROLLING_WEEKS = 8;
      const MIN_ROLLING_WEEKS = 4;
      const allExercises = await storage.getExercises();
      const allEntries = await storage.getWorkoutEntries();

      const rollingTotalStats = await storage.getRollingTotalStats(ROLLING_WEEKS);
      if (!rollingTotalStats || rollingTotalStats.weekCount < MIN_ROLLING_WEEKS) {
        return res.status(400).json({ error: `需要至少 ${MIN_ROLLING_WEEKS} 週完成的訓練數據才能生成計畫。目前有 ${rollingTotalStats?.weekCount ?? 0} 週數據。` });
      }

      // Use only the rolling window entries for typicalValue/typicalSets/perSessionBaseline
      // so that stale early-history records don't corrupt per-set medians.
      const currentWeekStartDate = new Date(getCurrentWeekStart());
      const rollingCutoff = new Date(currentWeekStartDate);
      rollingCutoff.setDate(rollingCutoff.getDate() - ROLLING_WEEKS * 7);

      // Collect per-entry data within the rolling window
      const entryMap = new Map<string, { values: number[]; sets: number[]; baselines: number[] }>();
      const weeklyBaselineMap = new Map<string, Map<string, number>>(); // exerciseId -> weekKey -> weekSum
      for (const entry of allEntries) {
        const entryDate = new Date(entry.date);
        if (entryDate < rollingCutoff || entryDate >= currentWeekStartDate) continue;
        if (!entryMap.has(entry.exerciseId)) entryMap.set(entry.exerciseId, { values: [], sets: [], baselines: [] });
        const rec = entryMap.get(entry.exerciseId)!;
        if (entry.value > 0) rec.values.push(entry.value);
        if (entry.sets != null && entry.sets > 0) rec.sets.push(entry.sets);
        if (entry.baselineValue != null && entry.baselineValue > 0) rec.baselines.push(entry.baselineValue);

        // Track weekly baseline contribution per exercise
        const day = entryDate.getUTCDay();
        const diff = day === 0 ? -6 : 1 - day;
        const weekStart = new Date(entryDate);
        weekStart.setUTCDate(weekStart.getUTCDate() + diff);
        const weekKey = weekStart.toISOString().substring(0, 10);
        if (!weeklyBaselineMap.has(entry.exerciseId)) weeklyBaselineMap.set(entry.exerciseId, new Map());
        const wm = weeklyBaselineMap.get(entry.exerciseId)!;
        wm.set(weekKey, (wm.get(weekKey) ?? 0) + (entry.baselineValue ?? 0));
      }

      const median = (arr: number[]) => {
        if (!arr.length) return null;
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
      };
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      const muscleLabels: Array<[string, string]> = [
        ['muscleChest', '胸'], ['muscleBack', '背'], ['muscleLegs', '腿'],
        ['muscleShoulders', '肩'], ['muscleArms', '二頭/三頭'],
        ['muscleCore', '核心'], ['muscleGlutes', '臀'], ['muscleFullBody', '全身'],
      ];

      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const targetMultiplier = mode === 'recovery' ? 0.75 : 1.05;

      // Build exercise data with server-computed targets and session counts
      const exerciseDataRaw = allExercises
        .filter(e => e.name !== '每周平均步数')
        .map(e => {
          const hist = entryMap.get(e.id);
          if (!hist || hist.values.length === 0 || hist.sets.length === 0 || hist.baselines.length === 0) return null;

          const targetValue = Math.max(1, Math.round(median(hist.values)!));
          const targetSets = Math.max(1, Math.round(median(hist.sets)!));
          const perSessionBaseline = median(hist.baselines)!;

          // Avg weekly contribution for this exercise over the rolling window
          const weeklyVals = Array.from((weeklyBaselineMap.get(e.id) ?? new Map()).values());
          const weeklyContrib = avg(weeklyVals); // avg weekly baseline points from this exercise

          if (weeklyContrib <= 0 || perSessionBaseline <= 0) return null;

          // Sessions per week needed to hit the scaled target
          const rawSessions = (weeklyContrib * targetMultiplier) / perSessionBaseline;
          const sessionsPerWeek = Math.min(3, Math.max(1, Math.round(rawSessions)));

          const muscles = muscleLabels
            .filter(([key]) => ((e as Record<string, unknown>)[key] as number ?? 0) > 0)
            .map(([key, label]) => `${label}${(e as Record<string, unknown>)[key]}%`)
            .join('/');

          return {
            id: e.id,
            name: e.name,
            unit: e.unit,
            category: e.category,
            targetValue,
            targetSets,
            perSessionBaseline,
            weeklyContrib,
            sessionsPerWeek,
            muscles,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      if (exerciseDataRaw.length === 0) {
        return res.status(400).json({ error: "沒有足夠的近期訓練數據來生成計畫，請先累積 4 週以上的訓練紀錄。" });
      }

      // --- Cap sessions per exercise and total session count ---
      // Strength exercises need more recovery: max 2 sessions/week
      // Total cap: 5 training days × 3 exercises = 15 slots
      const MAX_TOTAL_SLOTS = 15;
      const cappedData = exerciseDataRaw
        .map(e => ({
          ...e,
          sessionsPerWeek: e.category === '力量'
            ? Math.min(2, e.sessionsPerWeek)
            : e.sessionsPerWeek,
        }))
        .sort((a, b) => b.weeklyContrib - a.weeklyContrib); // highest-priority first

      // Trim lower-priority exercises if total exceeds MAX_TOTAL_SLOTS
      let runningTotal = 0;
      const exercisesInPlan: typeof cappedData = [];
      for (const e of cappedData) {
        if (runningTotal + e.sessionsPerWeek <= MAX_TOTAL_SLOTS) {
          exercisesInPlan.push(e);
          runningTotal += e.sessionsPerWeek;
        } else if (runningTotal < MAX_TOTAL_SLOTS) {
          // Partially include if there's still room for 1 session
          exercisesInPlan.push({ ...e, sessionsPerWeek: 1 });
          runningTotal += 1;
        }
        // else skip this exercise
      }

      const totalSessions = exercisesInPlan.reduce((s, e) => s + e.sessionsPerWeek, 0);

      // --- Select training days server-side ---
      // Pattern: prefer weekends (Fri=5, Sat=6, Sun=7) for heavier load,
      // allow select weekdays for remaining sessions.
      // Mon-Thu contributes at most 2 training days (1-2 rest days as per custom rules).
      const neededDays = Math.min(5, Math.max(1, Math.ceil(totalSessions / 3)));
      // Day preference order: Sat(6) > Sun(7) > Fri(5) > Thu(4) > Tue(2) > Wed(3) > Mon(1)
      const dayPreferenceOrder = [6, 7, 5, 4, 2, 3, 1];
      const trainingDays = dayPreferenceOrder.slice(0, neededDays).sort((a, b) => a - b);

      const weeklyTarget = rollingTotalStats.avg * targetMultiplier;
      const projectedTotal = exercisesInPlan.reduce((s, e) => s + e.sessionsPerWeek * e.perSessionBaseline, 0);

      // --- Deterministic scheduler (no AI needed) ---
      // Rules:
      // - Strength → prefer weekend days; Cardio/Other → prefer weekday days
      // - Same exercise not on consecutive training days (by index in trainingDays array)
      // - Max 4 exercises per training day; balance load evenly
      // - Within each day, sort by category: 力量 first, then 有氧, then others

      interface PlanSlot {
        exerciseId: string;
        exerciseName: string;
        targetValue: number;
        targetSets: number;
        unit: string;
        category: string | null;
        weeklyContrib: number;
      }

      // Expand each exercise into sessionsPerWeek individual slots
      const allSlots: PlanSlot[] = exercisesInPlan.flatMap(e =>
        Array.from({ length: e.sessionsPerWeek }, () => ({
          exerciseId: e.id,
          exerciseName: e.name,
          targetValue: e.targetValue,
          targetSets: e.targetSets,
          unit: e.unit,
          category: e.category,
          weeklyContrib: e.weeklyContrib,
        }))
      );

      // Sort slots: higher weekly contribution first, then strength before cardio
      const categoryRank = (c: string | null) => c === '力量' ? 0 : c === '有氧' ? 1 : 2;
      allSlots.sort((a, b) =>
        b.weeklyContrib - a.weeklyContrib || categoryRank(a.category) - categoryRank(b.category)
      );

      // Categorise training days by weekday vs weekend
      const weekendDayIdxs = trainingDays.map((d, i) => ({ d, i })).filter(x => x.d >= 5).map(x => x.i);
      const weekdayDayIdxs = trainingDays.map((d, i) => ({ d, i })).filter(x => x.d < 5).map(x => x.i);

      const dayBuckets = new Map<number, PlanSlot[]>(trainingDays.map(d => [d, []]));
      const lastPlacedIdx = new Map<string, number>(); // exerciseId → index in trainingDays

      for (const slot of allSlots) {
        // Preferred day-index order by category
        const prefIdxs = slot.category === '力量'
          ? [...weekendDayIdxs, ...weekdayDayIdxs]
          : [...weekdayDayIdxs, ...weekendDayIdxs];

        // Filter out days that would be consecutive (training-day-index distance ≤ 1)
        const lastIdx = lastPlacedIdx.get(slot.exerciseId);
        const nonConsecIdxs = prefIdxs.filter(i =>
          lastIdx === undefined || Math.abs(i - lastIdx) > 1
        );
        const candidateIdxs = nonConsecIdxs.length > 0 ? nonConsecIdxs : prefIdxs;

        // Among candidates, pick day with fewest exercises (max 4 per day)
        const sortedCandidates = [...candidateIdxs].sort((a, b) => {
          const la = dayBuckets.get(trainingDays[a])!.length;
          const lb = dayBuckets.get(trainingDays[b])!.length;
          return la - lb;
        });

        const chosenIdx = sortedCandidates.find(i =>
          (dayBuckets.get(trainingDays[i])?.length ?? 0) < 4
        ) ?? sortedCandidates[0]; // fallback: ignore max-4 if no choice

        if (chosenIdx !== undefined) {
          const chosenDay = trainingDays[chosenIdx];
          dayBuckets.get(chosenDay)!.push(slot);
          lastPlacedIdx.set(slot.exerciseId, chosenIdx);
        }
      }

      // Build final plan: sort exercises within day by category
      const parsedPlan: PlanDayItem[] = trainingDays
        .map(d => ({
          day: d,
          dayName: dayNames[d - 1],
          exercises: (dayBuckets.get(d) ?? []).sort(
            (a, b) => categoryRank(a.category) - categoryRank(b.category)
          ),
        }))
        .filter(d => d.exercises.length > 0);

      const weekStart = getCurrentWeekStart();
      const saved = await storage.saveWeeklyPlan({
        weekStart,
        mode: mode as 'recovery' | 'normal',
        planJson: JSON.stringify(parsedPlan),
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

      const planDays: PlanDayItem[] = JSON.parse(plan.planJson);
      const entries = await storage.getWorkoutEntries();

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
      let actualBaseline = 0;

      // Compute targetBaseline: for each unique planned exercise,
      // targetContrib = weeklyContrib * targetMultiplier (historical avg scaled by mode)
      const targetMultiplier = plan.mode === 'recovery' ? 0.75 : 1.05;
      const seenExerciseIds = new Set<string>();
      let targetBaseline = 0;
      for (const day of planDays) {
        for (const ex of day.exercises) {
          if (!seenExerciseIds.has(ex.exerciseId)) {
            seenExerciseIds.add(ex.exerciseId);
            const contrib = (ex as { weeklyContrib?: number }).weeklyContrib ?? 0;
            targetBaseline += contrib * targetMultiplier;
          }
        }
      }

      // Actual baseline: sum of baselineValue for all week entries of planned exercises
      for (const [exId, entries] of Array.from(weekExerciseEntries.entries())) {
        if (seenExerciseIds.has(exId)) {
          for (const e of entries) actualBaseline += e.baselineValue;
        }
      }

      const daysWithProgress = planDays.map((day, dayIndex) => ({
        ...day,
        exercises: day.exercises.map(ex => {
          totalPlanned++;
          const itemTarget = ex.targetValue * ex.targetSets;
          const matched = occurrenceMatch.get(`${ex.exerciseId}__${dayIndex}`);
          const volume = matched?.volume ?? 0;
          const setsActual = matched?.sets ?? 0;

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
