import { Router } from "express";
import { storage } from "../storage";
import { computeAcwr } from "@shared/training/acwr";
import { computeExerciseStats } from "@shared/training/exercise-stats";
import { computeRecoveryOverview, countsAsTraining } from "@shared/training/recovery";

// 訓練負荷相關 API（ACWR 疲勞風險、久未訓練/肌群恢復、單項運動歷史指標）。
// 計算邏輯都在 shared/training/ 的純函式裡，這裡只負責取資料與回應。
// 個人使用規模（數千筆記錄）下每次直接讀全部記錄再算即可，不另做快取。
export const trainingRouter = Router();

trainingRouter.get("/overview", async (_req, res) => {
  try {
    const entries = await storage.getWorkoutEntries();
    const trainingEntries = entries.filter((e) => countsAsTraining(e.exercise, e));
    const acwr = computeAcwr(
      trainingEntries.map((e) => ({ date: e.date, load: e.baselineValue ?? 0 })),
    );
    const exerciseList = await storage.getExercises();
    const recovery = computeRecoveryOverview(exerciseList, entries);
    res.json({ acwr, recovery });
  } catch (error) {
    console.error("計算訓練總覽失敗:", error);
    res.status(500).json({ error: "計算訓練總覽失敗" });
  }
});

trainingRouter.get("/exercise-stats/:exerciseId", async (req, res) => {
  try {
    const exercise = await storage.getExercise(req.params.exerciseId);
    if (!exercise) return res.status(404).json({ error: "运动不存在" });
    const entries = (await storage.getWorkoutEntries()).filter((e) => e.exerciseId === exercise.id);
    res.json(computeExerciseStats(exercise, entries));
  } catch (error) {
    console.error("計算運動統計失敗:", error);
    res.status(500).json({ error: "計算運動統計失敗" });
  }
});
