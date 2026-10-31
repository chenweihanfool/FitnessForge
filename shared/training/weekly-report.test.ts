import assert from "node:assert/strict";
import { test } from "node:test";
import type { Exercise, WorkoutEntryWithExercise } from "../schema";
import { computeMilestones } from "./milestones";
import { buildWeeklyReport, weekIndexOf } from "./weekly-report";

const NOW = new Date("2026-10-31T04:00:00Z"); // 週六，台北 12:00
const WEIGHTS = { strength: 50, cardio: 30, activity: 20 };

function exercise(id: string, over: Partial<Exercise>): Exercise {
  return {
    id, name: id, unit: "次", weightFactor: 10, category: "力量", splitCategory: null, splitRatio: 0,
    muscleChest: 0, muscleBack: 0, muscleLegs: 0, muscleShoulders: 0, muscleArms: 0, muscleCore: 0,
    muscleGlutes: 0, muscleFullBody: 0, movementCoefficient: 1, intensityFactor: 1, ...over,
  };
}

let seq = 0;
function entry(ex: Exercise, iso: string, over: Partial<WorkoutEntryWithExercise> = {}): WorkoutEntryWithExercise {
  return {
    id: `e${seq++}`, exerciseId: ex.id, value: 10, sets: 3, weightFactor: ex.weightFactor, setDetails: null,
    loadKg: null, baselineValue: 30, date: new Date(iso), notes: null, source: "manual", sourceDays: null,
    exercise: ex, ...over,
  };
}

const bench = exercise("臥推", { muscleChest: 80, muscleFullBody: 20 });
const run = exercise("跑步", { unit: "分鐘", category: "有氧", muscleLegs: 0 });
const steps = exercise("每周平均步数", { unit: "步", category: "活动量" });
const exercises = [bench, run, steps];

test("週一 00:00 與週日 23:59（台北）屬於同一週，下週一 00:00 不算", () => {
  const entries = [
    entry(bench, "2026-10-18T16:00:00Z"), // 台北 10/19 週一 00:00
    entry(bench, "2026-10-25T15:59:00Z"), // 台北 10/25 週日 23:59
    entry(bench, "2026-10-25T16:00:00Z"), // 台北 10/26 週一 00:00
  ];
  const r = buildWeeklyReport({ entries, exercises, weights: WEIGHTS, weekStart: "2026-10-19", now: NOW });
  assert.equal(r.score.strength, 60);
  assert.equal(r.days[0].strength, 30);
  assert.equal(r.days[6].strength, 30);
});

test("weekIndexOf 以週一為一週開始", () => {
  const monday = Date.UTC(2026, 9, 19) / 86400000;
  for (let i = 0; i < 7; i++) assert.equal(weekIndexOf(monday + i), monday);
  assert.equal(weekIndexOf(monday + 7), monday + 7);
});

test("沒帶 weekStart 時給上一個已結束的週，進行中的週可手動切換", () => {
  const entries = [entry(bench, "2026-10-20T04:00:00Z"), entry(bench, "2026-10-28T04:00:00Z")];
  const last = buildWeeklyReport({ entries, exercises, weights: WEIGHTS, now: NOW });
  assert.equal(last.weekStart, "2026-10-19");
  assert.equal(last.isCurrentWeek, false);
  assert.equal(last.nextWeekStart, "2026-10-26");
  const current = buildWeeklyReport({ entries, exercises, weights: WEIGHTS, weekStart: "2026-10-26", now: NOW });
  assert.equal(current.isCurrentWeek, true);
  assert.equal(current.daysElapsed, 6);
  assert.equal(current.nextWeekStart, null);
});

test("加權總分用設定的權重，步數不算訓練天", () => {
  const entries = [
    entry(bench, "2026-10-20T04:00:00Z", { baselineValue: 100 }),
    entry(run, "2026-10-21T04:00:00Z", { baselineValue: 200, value: 30, sets: 5 }),
    entry(steps, "2026-10-22T04:00:00Z", { baselineValue: 50, value: 70000, source: "auto" }),
  ];
  const r = buildWeeklyReport({ entries, exercises, weights: WEIGHTS, weekStart: "2026-10-19", now: NOW });
  assert.equal(r.score.total, 100 * 0.5 + 200 * 0.3 + 50 * 0.2);
  assert.equal(r.trainingDays, 2);
  assert.equal(r.dailySteps, 10000);
  assert.equal(r.cardioMinutes, 30);
  assert.equal(r.strengthSets, 3);
});

test("混合運動的基準值依 splitRatio 拆分", () => {
  const hybrid = exercise("負重", { unit: "分鐘", category: "有氧", splitCategory: "力量", splitRatio: 0.25 });
  const entries = [entry(hybrid, "2026-10-20T04:00:00Z", { baselineValue: 100, value: 40 })];
  const r = buildWeeklyReport({ entries, exercises: [hybrid], weights: WEIGHTS, weekStart: "2026-10-19", now: NOW });
  assert.equal(r.score.cardio, 75);
  assert.equal(r.score.strength, 25);
  assert.equal(r.cardioMinutes, 30);
});

test("破紀錄要超過過去最佳，第一次做的動作不算", () => {
  const first = buildWeeklyReport({
    entries: [entry(bench, "2026-10-20T04:00:00Z")],
    exercises, weights: WEIGHTS, weekStart: "2026-10-19", now: NOW,
  });
  assert.equal(first.records.length, 0);

  const entries = [
    entry(bench, "2026-10-13T04:00:00Z", { weightFactor: 50, value: 5 }),
    entry(bench, "2026-10-20T04:00:00Z", { weightFactor: 60, value: 5 }),
    entry(bench, "2026-10-21T04:00:00Z", { weightFactor: 40, value: 5 }),
  ];
  const r = buildWeeklyReport({ entries, exercises, weights: WEIGHTS, weekStart: "2026-10-19", now: NOW });
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].date, "2026-10-20");
  assert.equal(r.records[0].value, 70);
  assert.equal(Math.round(r.records[0].previous * 10) / 10, 58.3);
  const after = buildWeeklyReport({ entries, exercises, weights: WEIGHTS, weekStart: "2026-10-26", now: NOW });
  assert.equal(after.records.length, 0);
});

test("連續低於維持量與前 4 週比較", () => {
  const entries = ["2026-09-29", "2026-10-06", "2026-10-13", "2026-10-20"].map((d) =>
    entry(bench, `${d}T04:00:00Z`, { sets: 2 }),
  );
  const r = buildWeeklyReport({ entries, exercises, weights: WEIGHTS, weekStart: "2026-10-19", now: NOW });
  const chest = r.muscles.find((m) => m.name === "胸")!;
  assert.equal(chest.lowStreak, 4);
  assert.equal(chest.maintenance, 6);
  assert.ok(chest.prevAvgComposite !== null);
  assert.ok(r.observations.some((o) => o.text.includes("連續") && o.text.includes("胸")));
});

test("進行中的週不提不足類警告", () => {
  const entries = [entry(bench, "2026-10-20T04:00:00Z"), entry(bench, "2026-10-27T04:00:00Z")];
  const r = buildWeeklyReport({ entries, exercises, weights: WEIGHTS, weekStart: "2026-10-26", now: NOW });
  assert.ok(!r.observations.some((o) => o.text.includes("未達每週")));
});

test("沒資料的週不會丟例外", () => {
  const r = buildWeeklyReport({ entries: [], exercises, weights: WEIGHTS, now: NOW });
  assert.equal(r.hasData, false);
  assert.equal(r.observations[0].text, "這週沒有任何訓練記錄。");
});

const milestoneBase = {
  trainingDays: 3, totalScore: 100, careerAvgTotal: 80, rank: 1, totalWeeks: 20, prevFourTotals: [50],
  muscles: [{ name: "二头肌", sets: 3, volume: 10, avgVolume: 5 }],
};

test("里程碑用各肌群自己的維持組數", () => {
  assert.equal(computeMilestones(milestoneBase).allMusclesAtMaintenance, true); // 二頭 3 組達標
  const chest = { ...milestoneBase, muscles: [{ name: "胸", sets: 5, volume: 10, avgVolume: 5 }] };
  assert.equal(computeMilestones(chest).allMusclesAtMaintenance, false); // 胸要 6 組
});

test("里程碑逐級累積，中間斷掉後面不算", () => {
  assert.equal(computeMilestones(milestoneBase).achievedCount, 5);
  assert.equal(computeMilestones({ ...milestoneBase, trainingDays: 2 }).achievedCount, 1);
  assert.equal(computeMilestones({ ...milestoneBase, trainingDays: 0 }).achievedCount, 0);
});
