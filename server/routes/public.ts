import type { Express } from "express";
import { storage } from "../storage";
import { summaryKeyGuard } from "../summaryKey";

export function registerPublicRoutes(app: Express) {
  // ── Steps auto-sync endpoint (no login, protected by secret header) ───────
  // Called by an external automation (Health Sync → Google Drive → Claude) that
  // computes this week's average daily steps from however many days of data are
  // actually available so far. Stored as a 'auto' source entry so it only acts as
  // a default — any manual entry for the week always takes precedence (see
  // /api/entries/current-week-steps above).
  app.post("/api/public/steps-auto-sync", async (req, res) => {
    const secret = process.env.STEPS_SYNC_SECRET;
    if (!secret || req.headers["x-steps-sync-secret"] !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const dailyAverageSteps = Number(req.body?.dailyAverageSteps);
      const daysAvailable = Number(req.body?.daysAvailable);
      if (!Number.isFinite(dailyAverageSteps) || dailyAverageSteps <= 0 || !Number.isFinite(daysAvailable) || daysAvailable <= 0) {
        return res.status(400).json({ error: "dailyAverageSteps 和 daysAvailable 必須是正數" });
      }

      const allExercises = await storage.getExercises();
      const stepsExercise = allExercises.find(e => e.name === "每周平均步数");
      if (!stepsExercise) {
        return res.status(404).json({ error: "找不到「每週平均步數」運動類型，請先在運動管理建立" });
      }

      const TAIPEI_OFFSET = 8 * 60 * 60 * 1000;
      const now = new Date();
      const taipeiDate = new Date(now.getTime() + TAIPEI_OFFSET);
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

      // Delete any manual entries for this week — auto-sync should always take precedence
      const manualEntries = entries.filter(e => {
        if (e.exerciseId !== stepsExercise.id || e.source === "auto") return false;
        const d = new Date(e.date);
        return d >= weekStart && d <= weekEnd;
      });
      for (const manual of manualEntries) {
        await storage.deleteWorkoutEntry(manual.id);
      }

      const existingAuto = entries.find(e => {
        if (e.exerciseId !== stepsExercise.id || e.source !== "auto") return false;
        const d = new Date(e.date);
        return d >= weekStart && d <= weekEnd;
      });

      const weeklyTotal = Math.round(dailyAverageSteps * 7);
      const payload = {
        exerciseId: stepsExercise.id,
        value: weeklyTotal,
        weightFactor: 1,
        source: "auto" as const,
        sourceDays: daysAvailable,
      };

      const saved = existingAuto
        ? await storage.updateWorkoutEntry(existingAuto.id, payload)
        : await storage.createWorkoutEntry(payload);

      res.json({ success: true, entry: saved, dailyAverageSteps, daysAvailable });
    } catch (error) {
      console.error("步數自動同步失敗:", error);
      res.status(500).json({ error: "步數自動同步失敗" });
    }
  });

  // ── Public life-score endpoint (no auth) ──────────────────────────────────
  // Returns aggregate workout metrics for the Life Integration System.
  // Called nightly by local Claude to compute the unified life score.
  app.get('/api/public/life-score', async (_req, res) => {
    try {
      const summary = await storage.getPublicLifeScore();
      res.json({ ...summary, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Error in /api/public/life-score:', error);
      res.status(500).json({ message: String(error) });
    }
  });

  // ── Public summary endpoint (no auth) ─────────────────────────────────────
  // Compact weekly score / trend / muscle-group breakdown for external
  // dashboards (Aiportal's system-overview cards).
  app.get('/api/public/summary', summaryKeyGuard, async (_req, res) => {
    try {
      const summary = await storage.getPublicSummary();
      res.json({ ...summary, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Error in /api/public/summary:', error);
      res.status(500).json({ message: String(error) });
    }
  });
}
