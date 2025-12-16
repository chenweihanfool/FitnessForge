import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExerciseSchema, insertWorkoutEntrySchema } from "@shared/schema";
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
  app.patch("/api/entries/:id", async (req, res) => {
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
  });

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
      
      // 使用getWeeklyStats返回的分类值（已应用split ratio逻辑）
      const breakdown = [
        {
          category: "力量",
          value: weeklyStats.strengthValue,
          percentage: weeklyStats.totalBaselineValue > 0 
            ? (weeklyStats.strengthValue / weeklyStats.totalBaselineValue) * 100 
            : 0,
        },
        {
          category: "有氧",
          value: weeklyStats.cardioValue,
          percentage: weeklyStats.totalBaselineValue > 0 
            ? (weeklyStats.cardioValue / weeklyStats.totalBaselineValue) * 100 
            : 0,
        },
        {
          category: "活动量",
          value: weeklyStats.activityValue,
          percentage: weeklyStats.totalBaselineValue > 0 
            ? (weeklyStats.activityValue / weeklyStats.totalBaselineValue) * 100 
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

  // ==================== AI 评语 API ====================
  
  // 检查AI集成环境变量
  const hasAIIntegration = !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
  
  // 生成本周AI评语
  app.post("/api/stats/ai-assessment", async (req, res) => {
    try {
      // 检查AI集成是否可用
      if (!hasAIIntegration) {
        return res.status(503).json({ error: "AI服务未配置" });
      }
      
      const { weeklyStats, categoryBreakdown, ranking, weeklyProgress, careerAverages } = req.body;
      
      // 验证必要的数据存在
      if (!weeklyStats || typeof weeklyStats.totalBaselineValue !== 'number') {
        return res.status(400).json({ error: "缺少本周统计数据" });
      }
      
      // 构建提示词
      const prompt = buildAssessmentPrompt(weeklyStats, categoryBreakdown, ranking, weeklyProgress, careerAverages);
      
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "你是一位专业的健身教练，负责给用户提供每周运动表现评语。评语要简短（2-3句话）、有针对性、鼓励性，并给出具体建议。使用繁体中文回复。严禁使用任何emoji表情符号或特殊符号，只使用纯文字。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });
      
      let assessment = response.choices[0]?.message?.content || "无法生成评语";
      // 移除emoji和特殊符号 - 使用简单的过滤方法
      assessment = removeEmojis(assessment);
      res.json({ assessment });
    } catch (error) {
      console.error("AI评语生成失败:", error);
      res.status(500).json({ error: "生成评语失败", details: error instanceof Error ? error.message : String(error) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// 移除emoji和特殊符号
function removeEmojis(text: string): string {
  // 只保留常见的中文、英文、数字、标点符号
  return text.replace(/[^\u4e00-\u9fa5\u3000-\u303f\uff00-\uffefa-zA-Z0-9\s.,!?;:'"()\[\]{}，。！？；：''""（）【】、\-—]/g, '');
}

// 安全的数字格式化
function safeToFixed(value: number | undefined | null, decimals: number = 1): string {
  if (value === undefined || value === null || isNaN(value)) return "0";
  return value.toFixed(decimals);
}

// 构建AI评语提示词
function buildAssessmentPrompt(
  weeklyStats: { totalBaselineValue: number; strengthValue: number; cardioValue: number; activityValue: number } | null,
  categoryBreakdown: { strength: number; cardio: number; activity: number } | null,
  ranking: { rank: number; totalWeeks: number; strengthRank: number; cardioRank: number; activityRank: number } | null,
  weeklyProgress: Array<{ exerciseName: string; currentValue: number; weeklyAverage: number | null }> | null,
  careerAverages: { total: number; strength: number; cardio: number; activity: number } | null
): string {
  let prompt = "以下是用户本周的运动数据：\n\n";
  
  if (weeklyStats) {
    prompt += `【本周总分】${safeToFixed(weeklyStats.totalBaselineValue)} 基准值\n`;
    prompt += `- 力量: ${safeToFixed(weeklyStats.strengthValue)}\n`;
    prompt += `- 有氧: ${safeToFixed(weeklyStats.cardioValue)}\n`;
    prompt += `- 活动量: ${safeToFixed(weeklyStats.activityValue)}\n\n`;
  }
  
  if (careerAverages) {
    prompt += `【历史平均】总分: ${safeToFixed(careerAverages.total)}, 力量: ${safeToFixed(careerAverages.strength)}, 有氧: ${safeToFixed(careerAverages.cardio)}, 活动量: ${safeToFixed(careerAverages.activity)}\n\n`;
  }
  
  if (ranking && ranking.totalWeeks > 0) {
    const percentile = Math.round((ranking.rank / ranking.totalWeeks) * 100);
    prompt += `【排名】本周在历史${ranking.totalWeeks}周中排名第${ranking.rank}（前${percentile}%）\n\n`;
  }
  
  if (weeklyProgress && weeklyProgress.length > 0) {
    const aboveAverage = weeklyProgress.filter(p => p.weeklyAverage && p.currentValue >= p.weeklyAverage);
    const belowAverage = weeklyProgress.filter(p => p.weeklyAverage && p.currentValue < p.weeklyAverage);
    
    if (aboveAverage.length > 0) {
      prompt += `【超过平均的项目】${aboveAverage.map(p => p.exerciseName).join('、')}\n`;
    }
    if (belowAverage.length > 0) {
      prompt += `【未达平均的项目】${belowAverage.map(p => p.exerciseName).join('、')}\n`;
    }
  }
  
  prompt += "\n请根据以上数据，给出简短的周评语（2-3句话），包含表现总结和具体建议。";
  
  return prompt;
}
