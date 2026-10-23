import type { Express } from "express";
import { storage } from "../storage";

export function registerHealthRoutes(app: Express) {
  // Dead man's switch target — reports whether the weekly radar snapshot cron
  // is actually still producing fresh data, not just whether the server process
  // is up. This exact job has already silently failed for an unknown stretch of
  // time before (stale URL + missing secret + middleware ordering, found only
  // because the user happened to ask about it) — a 200 from a basic health check
  // wouldn't have caught any of those. Polled by an external HERMES-side check.
  app.get("/api/health/scheduled-jobs", async (req, res) => {
    try {
      const snapshots = await storage.getAllRadarSnapshots();
      const latest = snapshots.length > 0
        ? snapshots.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b))
        : null;
      const lastRunAt = latest?.updatedAt ?? null;
      const staleThresholdHours = 192; // weekly job (Sun 22:00) + ~1 day slack
      const isStale = !lastRunAt
        || (Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60) > staleThresholdHours;

      res.json({
        weeklyRadarSnapshot: {
          lastRunAt: lastRunAt ? new Date(lastRunAt).toISOString() : null,
          staleThresholdHours,
          isStale,
        },
      });
    } catch (err) {
      console.error("Error checking scheduled job health:", err);
      res.status(500).json({ error: "Failed to check scheduled job health" });
    }
  });
}
