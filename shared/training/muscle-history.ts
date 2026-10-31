import { RADAR_AXIS_NAMES, accumulateMuscleTotals, getMuscleSetsMaintenance } from "../muscleGroupStats";
import type { WorkoutEntryWithExercise } from "../schema";
import { computeStreak, type StreakResult } from "./streak";
import { dayIndexToKey, taipeiDayIndex } from "./time";
import { STEPS_EXERCISE_NAME, toMuscleEntry, weekIndexOf } from "./weekly-report";

// 肌群歷史：回答「哪個肌群在進步、哪個被忽略」。
// 每週的數字直接從訓練記錄算，不靠快照，所以改舊記錄會跟著更新，也不會缺週。
//
// 尺度固定用「組數 ÷ 該肌群維持量」（100 = 剛好維持）。首頁雷達的複合分含「容量 ÷ 全期平均」，
// 全期平均會隨時間漂移，三個月前的分數和現在的不能直接比；這裡的基準不會變。

const COMPARE_WEEKS = 4;
const SPARK_WEEKS = 12;
/** 近 4 週比前 4 週變動超過這個比例才算進步或退步 */
const PROGRESS_SHIFT = 0.15;
const PERIOD_OFFSETS = [
  { key: "now", label: "近 4 週", weeksAgo: 0 },
  { key: "quarter", label: "3 個月前", weeksAgo: 13 },
  { key: "year", label: "1 年前", weeksAgo: 52 },
] as const;

export type ProgressStatus = "up" | "flat" | "down" | "insufficient";

export interface MuscleHistoryWeek {
  weekStart: string;
  isCurrent: boolean;
  trainingDays: number;
  /** 跟 axes 同順序的達成率（%） */
  values: number[];
}

export interface MuscleProgress {
  name: string;
  recentAvg: number;
  prevAvg: number | null;
  status: ProgressStatus;
  spark: number[];
}

export interface MusclePeriod {
  key: string;
  label: string;
  values: number[];
}

export interface MuscleHistory {
  axes: { name: string; maintenance: number }[];
  /** 由舊到新，含進行中的這週 */
  weeks: MuscleHistoryWeek[];
  progress: MuscleProgress[];
  periods: MusclePeriod[];
  streak: StreakResult;
}

const mean = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);

export function classifyProgress(recent: number, prev: number | null): ProgressStatus {
  if (prev === null) return "insufficient";
  if (prev === 0) return recent > 0 ? "up" : "flat";
  if (recent >= prev * (1 + PROGRESS_SHIFT)) return "up";
  return recent <= prev * (1 - PROGRESS_SHIFT) ? "down" : "flat";
}

export function buildMuscleHistory(entries: WorkoutEntryWithExercise[], now: Date = new Date()): MuscleHistory {
  const currentWeek = weekIndexOf(taipeiDayIndex(now));
  const axes = RADAR_AXIS_NAMES.map((name) => ({ name, maintenance: getMuscleSetsMaintenance(name) }));

  const byWeek = new Map<number, { entries: WorkoutEntryWithExercise[]; days: Set<number> }>();
  for (const entry of entries) {
    if (!entry.exercise) continue;
    const day = taipeiDayIndex(entry.date);
    const week = weekIndexOf(day);
    if (week > currentWeek) continue; // 未來日期的記錄不算
    const bucket = byWeek.get(week) ?? { entries: [], days: new Set<number>() };
    bucket.entries.push(entry);
    if (entry.exercise.name !== STEPS_EXERCISE_NAME) bucket.days.add(day);
    byWeek.set(week, bucket);
  }

  const firstWeek = Math.min(currentWeek, ...Array.from(byWeek.keys()));
  const weeks: MuscleHistoryWeek[] = [];
  for (let week = firstWeek; week <= currentWeek; week += 7) {
    const bucket = byWeek.get(week);
    const totals = accumulateMuscleTotals((bucket?.entries ?? []).map(toMuscleEntry));
    weeks.push({
      weekStart: dayIndexToKey(week),
      isCurrent: week === currentWeek,
      trainingDays: bucket?.days.size ?? 0,
      values: axes.map(({ name, maintenance }) => Math.round(((totals.get(name)?.totalSets ?? 0) / maintenance) * 100)),
    });
  }

  // 比較只看結束的週：進行中的週還沒練完，放進去會被看成退步
  const complete = weeks.filter((w) => !w.isCurrent);
  const averageOf = (list: MuscleHistoryWeek[], axis: number) => Math.round(mean(list.map((w) => w.values[axis])));

  const progress: MuscleProgress[] = axes.map(({ name }, axis) => {
    const recent = complete.slice(-COMPARE_WEEKS);
    const prev = complete.slice(-COMPARE_WEEKS * 2, -COMPARE_WEEKS);
    const recentAvg = averageOf(recent, axis);
    const prevAvg = prev.length === COMPARE_WEEKS ? averageOf(prev, axis) : null;
    return {
      name,
      recentAvg,
      prevAvg,
      status: classifyProgress(recentAvg, prevAvg),
      spark: complete.slice(-SPARK_WEEKS).map((w) => w.values[axis]),
    };
  });

  const periods: MusclePeriod[] = PERIOD_OFFSETS.flatMap(({ key, label, weeksAgo }) => {
    const end = complete.length - weeksAgo;
    const slice = end >= COMPARE_WEEKS ? complete.slice(end - COMPARE_WEEKS, end) : [];
    if (slice.length < COMPARE_WEEKS) return [];
    return [{ key, label, values: axes.map((_, axis) => averageOf(slice, axis)) }];
  });

  return {
    axes,
    weeks,
    progress,
    periods,
    streak: computeStreak(weeks.map((w) => ({ trainingDays: w.trainingDays, inProgress: w.isCurrent }))),
  };
}
