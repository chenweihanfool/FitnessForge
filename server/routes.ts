import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertExerciseSchema, insertWorkoutEntrySchema } from "@shared/schema";
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
      const details = await storage.getCurrentWeekDetails();
      
      // 按分类分组统计（使用exerciseCategory字段）
      const categoryStats = new Map<string, number>();
      for (const detail of details.details) {
        const category = detail.exerciseCategory || "未分类";
        categoryStats.set(
          category,
          (categoryStats.get(category) || 0) + detail.baselineValue
        );
      }
      
      // 计算百分比
      const total = details.totalBaselineValue;
      const breakdown = Array.from(categoryStats.entries())
        .map(([category, value]) => ({
          category,
          value,
          percentage: total > 0 ? (value / total) * 100 : 0,
        }))
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
