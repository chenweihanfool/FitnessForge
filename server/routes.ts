import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExerciseSchema, insertWorkoutEntrySchema, type PlanDayItem } from "@shared/schema";
import multer from "multer";
import Papa from "papaparse";
import OpenAI from "openai";

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

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllUserSettings();
      res.json({
        strengthWeight: parseFloat(settings['strengthWeight'] ?? '50'),
        cardioWeight: parseFloat(settings['cardioWeight'] ?? '30'),
        activityWeight: parseFloat(settings['activityWeight'] ?? '20'),
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

  // ==================== AI 训练计划 API ====================

  const getOpenAIClient = () => {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  };

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

  app.post("/api/plan/generate", async (req, res) => {
    try {
      const { mode } = req.body;
      if (!mode || !['recovery', 'normal'].includes(mode)) {
        return res.status(400).json({ error: "模式必须是 recovery 或 normal" });
      }

      const allExercises = await storage.getExercises();
      const weeklyProgress = await storage.getWeeklyProgress();

      const exerciseData = allExercises
        .filter(e => e.name !== '每周平均步数')
        .map(e => {
          const prog = weeklyProgress.exercises.find(p => p.exerciseId === e.id);
          return {
            id: e.id,
            name: e.name,
            unit: e.unit,
            category: e.category,
            weeklyAverage: prog?.weeklyAverage ?? 0,
          };
        })
        .filter(e => e.weeklyAverage > 0);

      if (exerciseData.length === 0) {
        return res.status(400).json({ error: "没有足够的历史数据来生成训练计划。请先记录一些训练数据。" });
      }

      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const targetMultiplier = mode === 'recovery' ? 1.0 : 1.15;

      const prompt = `You are a fitness training planner. Generate a weekly training schedule in JSON format.

The user has the following exercises with their weekly averages:
${exerciseData.map(e => `- ${e.name} (${e.unit}, category: ${e.category || 'other'}, weekly avg: ${e.weeklyAverage.toFixed(1)})`).join('\n')}

Mode: ${mode === 'recovery' ? 'Recovery week (target = career averages)' : 'Normal week (target = averages + 15%)'}
Target multiplier: ${targetMultiplier}

Rules:
1. Distribute exercises across 3-5 training days (Mon-Sun), leave 2-4 rest days
2. Each training day should have 2-4 exercises
3. For each exercise, set targetValue (reps/minutes/steps per set) and targetSets (number of sets)
4. The total weekly volume (sum of targetValue * targetSets across all days) for each exercise should approximate: weeklyAverage * ${targetMultiplier}
5. Group exercises logically by category (strength together, cardio together)
6. Don't include the same exercise on consecutive days
7. Balance the total baseline load across training days
8. WEEKDAY vs WEEKEND intensity balance: Monday–Thursday are workdays so keep intensity moderate-to-light on those days — shorter sessions, fewer sets, or lighter cardio/core work. 1-2 rest days among Mon-Thu is fine but do NOT skip all four. Friday–Sunday are free days so these can have higher volume and heavier strength exercises, but still within reason (do not stack everything here). Aim for a natural intensity curve that rises toward the weekend.

Respond ONLY with a JSON array (no markdown, no explanation). Each element represents a day:
[
  {
    "day": 1,
    "dayName": "週一",
    "exercises": [
      {
        "exerciseId": "<id>",
        "exerciseName": "<name>",
        "targetValue": <number>,
        "targetSets": <number>,
        "unit": "<unit>",
        "category": "<category or null>"
      }
    ]
  }
]

Only include days that have exercises. Day numbers: 1=週一, 2=週二, ..., 7=週日.
Use the exact exerciseId and exerciseName from the list above.`;

      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt + '\n\nWrap the array in a JSON object with key "days", e.g. {"days": [...]}' }],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ error: "AI 未返回有效的训练计划" });
      }

      let parsedPlan: PlanDayItem[];
      try {
        const parsed = JSON.parse(content);
        parsedPlan = Array.isArray(parsed) ? parsed : (parsed.plan || parsed.days || parsed.schedule || []);
        if (!Array.isArray(parsedPlan)) {
          throw new Error("Invalid plan format");
        }
      } catch {
        console.error("AI 返回内容解析失败:", content);
        return res.status(500).json({ error: "AI 返回的训练计划格式无效" });
      }

      const validExerciseIds = new Set(allExercises.map(e => e.id));
      const exerciseNameToId = new Map(allExercises.map(e => [e.name, e.id]));
      const exerciseIdToData = new Map(allExercises.map(e => [e.id, e]));

      parsedPlan = parsedPlan.map(day => ({
        ...day,
        dayName: dayNames[(day.day - 1)] || `第${day.day}天`,
        exercises: day.exercises.map(ex => {
          if (validExerciseIds.has(ex.exerciseId)) return ex;
          const resolvedId = exerciseNameToId.get(ex.exerciseName);
          if (resolvedId) {
            const exData = exerciseIdToData.get(resolvedId);
            return { ...ex, exerciseId: resolvedId, unit: exData?.unit || ex.unit, category: exData?.category || ex.category };
          }
          return null;
        }).filter((ex): ex is NonNullable<typeof ex> => ex !== null),
      })).filter(day => day.exercises.length > 0);

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

      const dayEntries = new Map<number, Map<string, { totalVolume: number; totalSets: number }>>();
      for (const entry of weekEntries) {
        const entryTaipei = new Date(new Date(entry.date).getTime() + TAIPEI_OFFSET);
        let entryDow = entryTaipei.getUTCDay();
        const dayNum = entryDow === 0 ? 7 : entryDow;

        if (!dayEntries.has(dayNum)) dayEntries.set(dayNum, new Map());
        const dayMap = dayEntries.get(dayNum)!;
        const existing = dayMap.get(entry.exerciseId) || { totalVolume: 0, totalSets: 0 };
        existing.totalVolume += entry.value * (entry.sets || 1);
        existing.totalSets += (entry.sets || 1);
        dayMap.set(entry.exerciseId, existing);
      }

      let totalPlanned = 0;
      let totalMet = 0;

      const daysWithProgress = planDays.map(day => ({
        ...day,
        exercises: day.exercises.map(ex => {
          totalPlanned++;
          const itemTarget = ex.targetValue * ex.targetSets;
          const dayMap = dayEntries.get(day.day);
          const actual = dayMap?.get(ex.exerciseId) || { totalVolume: 0, totalSets: 0 };

          let status: 'met' | 'partial' | 'not_met';
          if (actual.totalVolume >= itemTarget) {
            status = 'met';
            totalMet++;
          } else if (actual.totalVolume > 0) {
            status = 'partial';
          } else {
            status = 'not_met';
          }

          return {
            ...ex,
            actualValue: Math.round(actual.totalVolume * 10) / 10,
            actualSets: actual.totalSets,
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
