import { dayIndexToKey, taipeiDayIndex } from "./time";
import { effectiveLoad, estimateOneRepMax, isRepUnit, type LoadExerciseFields } from "./load";

export interface StatsEntryInput {
  id: string;
  date: Date | string;
  value: number;
  sets: number | null;
  weightFactor: number | null;
  loadKg?: number | null;
  baselineValue: number | null;
}

export interface StatsExerciseInput extends LoadExerciseFields {
  id: string;
  unit: string;
}

export type StatsMetric = "e1rm" | "load" | "value";

export interface ExerciseSetSummary {
  value: number; // 每組次數（或分鐘/公里…）
  sets: number;
  load: number | null; // 公斤
}

export interface ExerciseRecord extends ExerciseSetSummary {
  /** 這個紀錄本身的數值（公斤、1RM、容量…，單位看是哪一種紀錄） */
  amount: number;
  date: string;
}

export interface ExerciseHistoryPoint {
  date: string; // YYYY-MM-DD（台北）
  load: number | null; // 當天最高負重
  e1rm: number | null;
  volume: number; // 當天總容量：有負重 = Σ(公斤×次數×組數)，否則 = 基準值（訓練分）加總
  value: number; // 當天最大單組數值
  /** 圖表主指標（metric 指定的那一種） */
  metricValue: number;
  isPr: boolean;
}

export interface ExerciseStats {
  exerciseId: string;
  unit: string;
  sessionCount: number;
  hasLoad: boolean;
  metric: StatsMetric;
  /** 上一次記錄；新增記錄時用來預填 */
  last: (ExerciseSetSummary & { date: string; daysAgo: number; loggedSets: number | null }) | null;
  records: {
    maxLoad: ExerciseRecord | null;
    bestE1rm: ExerciseRecord | null;
    maxValue: ExerciseRecord | null;
    bestVolume: ExerciseRecord | null;
  };
  /** 時間由舊到新，最多 `limit` 個訓練日 */
  history: ExerciseHistoryPoint[];
  trend: "up" | "flat" | "down" | null;
}

export function computeExerciseStats(
  exercise: StatsExerciseInput,
  entries: StatsEntryInput[],
  today: Date = new Date(),
  limit = 30,
): ExerciseStats {
  const repBased = isRepUnit(exercise.unit);
  const rows = entries
    .map((e) => {
      const sets = e.sets && e.sets > 0 ? e.sets : 1;
      const load = effectiveLoad(e, exercise);
      // 有負重 = 公斤×次數×組數（kg·reps）；沒有負重的項目（有氧等）「組數」欄位語意
      // 不一（跑步是公里數），乘起來沒意義，改用系統自己算好的基準值當「訓練分」。
      const volume = load != null ? load * e.value * sets : (e.baselineValue ?? 0);
      return {
        time: new Date(e.date).getTime(),
        loggedSets: e.sets,
        day: taipeiDayIndex(e.date),
        date: new Date(e.date).toISOString(),
        value: e.value,
        sets,
        load,
        volume,
        e1rm: load != null && repBased ? estimateOneRepMax(load, e.value) : null,
      };
    })
    .sort((a, b) => a.time - b.time);

  const hasLoad = rows.some((r) => (r.load ?? 0) > 0);
  const metric: StatsMetric = hasLoad ? (repBased ? "e1rm" : "load") : "value";

  const todayIdx = taipeiDayIndex(today);
  const lastRow = rows[rows.length - 1];
  const last = lastRow
    ? {
        value: lastRow.value,
        sets: lastRow.sets,
        load: lastRow.load,
        loggedSets: lastRow.loggedSets,
        date: lastRow.date,
        daysAgo: Math.max(0, todayIdx - lastRow.day),
      }
    : null;

  const toRecord = (r: (typeof rows)[number], amount: number): ExerciseRecord => ({
    amount,
    date: r.date,
    value: r.value,
    sets: r.sets,
    load: r.load,
  });
  // 同分取較新的一筆（rows 已由舊到新排序，所以用 >=）
  const best = (score: (r: (typeof rows)[number]) => number | null): ExerciseRecord | null => {
    let pick: { r: (typeof rows)[number]; s: number } | null = null;
    for (const r of rows) {
      const s = score(r);
      if (s != null && s > 0 && (!pick || s >= pick.s)) pick = { r, s };
    }
    return pick ? toRecord(pick.r, pick.s) : null;
  };

  // 以台北日為單位合併成「訓練日」序列
  const byDay = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byDay.get(r.day) ?? [];
    list.push(r);
    byDay.set(r.day, list);
  }
  const days = Array.from(byDay.entries()).sort((a, b) => a[0] - b[0]);

  let runningBest = 0;
  const allHistory: ExerciseHistoryPoint[] = days.map(([day, list]) => {
    const load = max(list.map((r) => r.load));
    const e1rm = max(list.map((r) => r.e1rm));
    const value = Math.max(...list.map((r) => r.value));
    const volume = list.reduce((s, r) => s + r.volume, 0);
    const metricValue = metric === "e1rm" ? (e1rm ?? 0) : metric === "load" ? (load ?? 0) : value;
    const isPr = metricValue > runningBest;
    if (isPr) runningBest = metricValue;
    return {
      date: dayIndexToKey(day),
      load,
      e1rm: e1rm == null ? null : round1(e1rm),
      volume: round1(volume),
      value,
      metricValue: round1(metricValue),
      isPr,
    };
  });

  const dayVolumeBest = (() => {
    let pick: { day: number; s: number } | null = null;
    for (const [day, list] of days) {
      const s = list.reduce((sum, r) => sum + r.volume, 0);
      if (!pick || s >= pick.s) pick = { day, s };
    }
    return pick;
  })();
  const bestVolumeRecord: ExerciseRecord | null = dayVolumeBest
    ? (() => {
        const list = byDay.get(dayVolumeBest.day)!;
        const top = list.reduce((a, b) => (b.volume >= a.volume ? b : a));
        return toRecord(top, round1(dayVolumeBest.s));
      })()
    : null;

  return {
    exerciseId: exercise.id,
    unit: exercise.unit,
    sessionCount: days.length,
    hasLoad,
    metric,
    last,
    records: {
      maxLoad: best((r) => r.load),
      bestE1rm: best((r) => r.e1rm),
      maxValue: best((r) => r.value),
      bestVolume: bestVolumeRecord,
    },
    history: allHistory.slice(-limit),
    trend: computeTrend(allHistory.map((h) => h.metricValue)),
  };
}

// 最近 3 個訓練日 vs 之前 3 個訓練日的平均，變動超過 ±3% 才算上升/下降
function computeTrend(values: number[]): "up" | "flat" | "down" | null {
  if (values.length < 4) return null;
  const recent = values.slice(-3);
  const prev = values.slice(-6, -3);
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const prevAvg = avg(prev);
  if (prevAvg <= 0) return null;
  const change = (avg(recent) - prevAvg) / prevAvg;
  return change > 0.03 ? "up" : change < -0.03 ? "down" : "flat";
}

function max(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? Math.max(...nums) : null;
}
const round1 = (n: number) => Math.round(n * 10) / 10;
