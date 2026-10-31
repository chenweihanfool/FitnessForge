import { splitBaselineByCategory } from "../baseline";
import {
  RADAR_AXIS_NAMES,
  accumulateMuscleTotals,
  applyActivityBonus,
  computeBalanceScore,
  computeCoverageScore,
  computeMuscleCompositeScore,
  getMuscleSetsMaintenance,
} from "../muscleGroupStats";
import type { Exercise, WorkoutEntryWithExercise } from "../schema";
import { computeAcwr, type AcwrZone } from "./acwr";
import { computeExerciseStats, type StatsMetric } from "./exercise-stats";
import { computeMilestones, DISCIPLINE_DAYS, type MilestoneResult } from "./milestones";
import { MUSCLE_FIELDS, countsAsTraining } from "./recovery";
import { dayIndexToKey, taipeiDayIndex } from "./time";

// 週報告：把一週的訓練整理成指標、每日分布、肌群變化、個人紀錄與文字觀察。
// 全部是純函式，吃完整記錄、吐報告，伺服器只負責取資料（個人使用規模，同 routes/training.ts）。
//
// 肌群分數沿用首頁雷達圖的公式與「全期平均」基準，同一週在兩邊看到的數字才一致。

const DAY_MS = 24 * 60 * 60 * 1000;
export const STEPS_EXERCISE_NAME = "每周平均步数";
const TREND_WEEKS = 12;
const COMPARE_WEEKS = 4;
const TOP_EXERCISES = 6;
const FOCUS_MUSCLES = 3;
const FOCUS_SUGGESTIONS = 3;
const FOCUS_RECENT_DAYS = 90;
const SUGGEST_MUSCLE_PCT = 20;
/** 跟前 4 週平均比，差多少才算明顯變化 */
const SCORE_SHIFT = 0.15;
/** 肌群複合分跟前 4 週平均差多少分才算明顯變化 */
const MUSCLE_SHIFT = 30;
const LOW_STREAK_WEEKS = 3;

/** 資料庫裡的肌群名稱是舊的簡體字串，畫面一律轉成這裡的顯示名稱 */
export const MUSCLE_LABELS: Record<string, string> = { "二头肌": "二頭肌", "三头肌": "三頭肌" };
export const muscleLabel = (name: string) => MUSCLE_LABELS[name] ?? name;

export interface ReportScore {
  total: number;
  strength: number;
  cardio: number;
  activity: number;
}

export interface ReportDay {
  date: string;
  strength: number;
  cardio: number;
  exercises: { name: string; category: string | null; baseline: number }[];
}

export interface ReportMuscle {
  name: string;
  sets: number;
  volume: number;
  maintenance: number;
  composite: number;
  setsPct: number;
  volumePct: number | null;
  /** 前 4 週（含沒練的週）複合分平均；這週之前沒有資料時為 null */
  prevAvgComposite: number | null;
  /** 連續幾週（含這週）低於維持組數 */
  lowStreak: number;
}

export interface ReportTrendWeek extends ReportScore {
  weekStart: string;
  trainingDays: number;
}

export interface ReportRecord {
  exerciseId: string;
  name: string;
  metric: StatsMetric;
  metricLabel: string;
  value: number;
  previous: number;
  unit: string;
  date: string;
}

export interface ReportTopExercise {
  exerciseId: string;
  name: string;
  category: string | null;
  baseline: number;
  share: number;
  sessions: number;
  prevAvg: number | null;
}

export interface ReportObservation {
  tone: "good" | "warn" | "info";
  text: string;
}

export interface ReportFocus {
  name: string;
  composite: number;
  sets: number;
  maintenance: number;
  suggestions: { exerciseId: string; name: string }[];
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
  daysElapsed: number;
  hasData: boolean;
  prevWeekStart: string | null;
  nextWeekStart: string | null;
  score: ReportScore;
  prevWeek: ReportScore | null;
  avgPrev4: ReportScore | null;
  rank: number;
  totalWeeks: number;
  milestones: MilestoneResult;
  careerAvgTotal: number;
  trainingDays: number;
  prevTrainingDays: number | null;
  strengthSets: number;
  cardioMinutes: number;
  dailySteps: number | null;
  balance: number | null;
  coverage: number | null;
  activityBonus: number;
  acwr: {
    ratio: number | null;
    zone: AcwrZone;
    acute: number;
    chronic: number;
    series: { date: string; ratio: number | null }[];
  };
  days: ReportDay[];
  muscles: ReportMuscle[];
  trend: ReportTrendWeek[];
  records: ReportRecord[];
  topExercises: ReportTopExercise[];
  observations: ReportObservation[];
  focus: ReportFocus[];
}

export interface WeeklyReportInput {
  entries: WorkoutEntryWithExercise[];
  exercises: Exercise[];
  /** 百分比，對應設定頁的 strengthWeight／cardioWeight／activityWeight */
  weights: { strength: number; cardio: number; activity: number };
  /** YYYY-MM-DD；沒給就用最近一個已結束的週 */
  weekStart?: string;
  now?: Date;
}

/** 這一天所在週的週一（週一到週日，跟 storage.getWeekStart 相同） */
export function weekIndexOf(dayIndex: number): number {
  return dayIndex - ((dayIndex + 3) % 7);
}

const keyToDayIndex = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

interface WeekBucket {
  strength: number;
  cardio: number;
  activity: number;
  total: number;
  days: Set<number>;
  entries: WorkoutEntryWithExercise[];
}

const toMuscleEntry = (e: WorkoutEntryWithExercise) => ({
  ...e,
  weightFactor: e.exercise.weightFactor,
  unit: e.exercise.unit,
  category: e.exercise.category,
  splitCategory: e.exercise.splitCategory,
  splitRatio: e.exercise.splitRatio,
  muscleChest: e.exercise.muscleChest,
  muscleBack: e.exercise.muscleBack,
  muscleLegs: e.exercise.muscleLegs,
  muscleShoulders: e.exercise.muscleShoulders,
  muscleArms: e.exercise.muscleArms,
  muscleCore: e.exercise.muscleCore,
  muscleGlutes: e.exercise.muscleGlutes,
  muscleFullBody: e.exercise.muscleFullBody,
});

export function buildWeeklyReport(input: WeeklyReportInput): WeeklyReport {
  const now = input.now ?? new Date();
  const todayIdx = taipeiDayIndex(now);
  const currentWeekIdx = weekIndexOf(todayIdx);
  const { strength: sw, cardio: cw, activity: aw } = input.weights;

  // ── 依週分桶 ────────────────────────────────────────────────────────────
  const buckets = new Map<number, WeekBucket>();
  for (const entry of input.entries) {
    if (!entry.exercise) continue;
    const day = taipeiDayIndex(entry.date);
    const week = weekIndexOf(day);
    const bucket = buckets.get(week) ?? { strength: 0, cardio: 0, activity: 0, total: 0, days: new Set<number>(), entries: [] };
    const shares = splitBaselineByCategory(entry.exercise, entry.baselineValue ?? 0);
    bucket.strength += shares.strength;
    bucket.cardio += shares.cardio;
    bucket.activity += shares.activity;
    bucket.entries.push(entry);
    if (entry.exercise.name !== STEPS_EXERCISE_NAME) bucket.days.add(day);
    buckets.set(week, bucket);
  }
  buckets.forEach((b) => {
    b.total = (b.strength * sw + b.cardio * cw + b.activity * aw) / 100;
  });

  const weekKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
  const firstWeek = weekKeys[0] ?? currentWeekIdx;
  const lastWeek = weekKeys[weekKeys.length - 1] ?? currentWeekIdx;
  // 中間沒練的週也算一週，跟 getAllWeeklyStats 一致
  const allWeeks: number[] = [];
  for (let w = firstWeek; w <= lastWeek; w += 7) allWeeks.push(w);

  const scoreOf = (week: number): ReportScore => {
    const b = buckets.get(week);
    return { total: b?.total ?? 0, strength: b?.strength ?? 0, cardio: b?.cardio ?? 0, activity: b?.activity ?? 0 };
  };

  const defaultWeek = Math.max(firstWeek, Math.min(lastWeek, currentWeekIdx - 7));
  const week = input.weekStart ? weekIndexOf(keyToDayIndex(input.weekStart)) : defaultWeek;
  const bucket = buckets.get(week);
  const score = scoreOf(week);
  const isCurrentWeek = week === currentWeekIdx;
  const daysElapsed = isCurrentWeek ? todayIdx - week + 1 : 7;

  const prevWeeks = allWeeks.filter((w) => w < week).slice(-COMPARE_WEEKS);
  const prevWeekIdx = week - 7 >= firstWeek ? week - 7 : null;

  const meanScore = (weeks: number[]): ReportScore | null => {
    if (weeks.length === 0) return null;
    const scores = weeks.map(scoreOf);
    return {
      total: avg(scores.map((s) => s.total)),
      strength: avg(scores.map((s) => s.strength)),
      cardio: avg(scores.map((s) => s.cardio)),
      activity: avg(scores.map((s) => s.activity)),
    };
  };

  const careerAvgTotal = avg(allWeeks.map((w) => scoreOf(w).total));
  const careerAvgActivity = avg(allWeeks.map((w) => scoreOf(w).activity));
  const rank = [...allWeeks].sort((a, b) => scoreOf(b).total - scoreOf(a).total).indexOf(week) + 1;

  // ── 肌群 ────────────────────────────────────────────────────────────────
  const totalsByWeek = new Map<number, ReturnType<typeof accumulateMuscleTotals>>();
  const totalsOf = (w: number) => {
    let totals = totalsByWeek.get(w);
    if (!totals) {
      totals = accumulateMuscleTotals((buckets.get(w)?.entries ?? []).map(toMuscleEntry));
      totalsByWeek.set(w, totals);
    }
    return totals;
  };
  // 歷史平均只算有記錄的週，跟 getMuscleGroupAverages（weekly_muscle_stats 列）一致
  const avgVolumeOf = (name: string) => avg(weekKeys.map((w) => totalsOf(w).get(name)?.totalVolume ?? 0));

  const compositeOf = (name: string, w: number) => {
    const t = totalsOf(w).get(name);
    return computeMuscleCompositeScore(name, t?.totalSets ?? 0, t?.totalVolume ?? 0, avgVolumeOf(name));
  };

  const muscles: ReportMuscle[] = RADAR_AXIS_NAMES.map((name) => {
    const t = totalsOf(week).get(name);
    const sets = round1(t?.totalSets ?? 0);
    const maintenance = getMuscleSetsMaintenance(name);
    const { composite, setsPct, volumePct } = compositeOf(name, week);
    let lowStreak = 0;
    for (let w = week; w >= firstWeek; w -= 7) {
      if ((totalsOf(w).get(name)?.totalSets ?? 0) >= maintenance) break;
      lowStreak++;
    }
    return {
      name,
      sets,
      volume: t?.totalVolume ?? 0,
      maintenance,
      composite,
      setsPct,
      volumePct,
      prevAvgComposite: prevWeeks.length ? Math.round(avg(prevWeeks.map((w) => compositeOf(name, w).composite))) : null,
      lowStreak,
    };
  });

  const balance = computeBalanceScore(
    muscles.map((m) => ({ name: m.name, composite: m.composite, hasVolumeHistory: avgVolumeOf(m.name) > 0 })),
  );
  const { adjustedCoverage: coverage, bonusPoints: activityBonus } = applyActivityBonus(
    computeCoverageScore(muscles.map((m) => m.composite)),
    careerAvgActivity > 0 ? (score.activity / careerAvgActivity) * 100 : 0,
  );

  const milestones = computeMilestones({
    trainingDays: bucket?.days.size ?? 0,
    totalScore: score.total,
    careerAvgTotal,
    rank: rank || allWeeks.length,
    totalWeeks: allWeeks.length,
    prevFourTotals: prevWeeks.map((w) => scoreOf(w).total),
    muscles: MUSCLE_FIELDS.map(({ name }) => {
      const t = totalsOf(week).get(name);
      return { name, sets: t?.totalSets ?? 0, volume: t?.totalVolume ?? 0, avgVolume: avgVolumeOf(name) };
    }),
  });

  // ── 每日 ────────────────────────────────────────────────────────────────
  const weekEntries = bucket?.entries ?? [];
  const days: ReportDay[] = Array.from({ length: 7 }, (_, i) => {
    const dayIdx = week + i;
    const byExercise = new Map<string, ReportDay["exercises"][number]>();
    let strength = 0;
    let cardio = 0;
    for (const e of weekEntries) {
      if (taipeiDayIndex(e.date) !== dayIdx || e.exercise.name === STEPS_EXERCISE_NAME) continue;
      const shares = splitBaselineByCategory(e.exercise, e.baselineValue ?? 0);
      strength += shares.strength;
      cardio += shares.cardio;
      const row = byExercise.get(e.exerciseId) ?? { name: e.exercise.name, category: e.exercise.category, baseline: 0 };
      row.baseline += e.baselineValue ?? 0;
      byExercise.set(e.exerciseId, row);
    }
    return {
      date: dayIndexToKey(dayIdx),
      strength: round1(strength),
      cardio: round1(cardio),
      exercises: Array.from(byExercise.values())
        .map((row) => ({ ...row, baseline: round1(row.baseline) }))
        .sort((a, b) => b.baseline - a.baseline),
    };
  });

  // ── 趨勢、步數、組數 ────────────────────────────────────────────────────
  const trend: ReportTrendWeek[] = allWeeks
    .filter((w) => w <= week)
    .slice(-TREND_WEEKS)
    .map((w) => ({ weekStart: dayIndexToKey(w), ...scoreOf(w), trainingDays: buckets.get(w)?.days.size ?? 0 }));

  const stepEntries = weekEntries.filter((e) => e.exercise.name === STEPS_EXERCISE_NAME);
  const stepEntry = stepEntries.find((e) => e.source !== "auto") ?? stepEntries[0];
  const strengthSets = weekEntries
    .filter((e) => e.exercise.category === "力量")
    .reduce((s, e) => s + (e.sets || 1), 0);
  const cardioMinutes = totalsOf(week).get("有氧")?.totalSets ?? 0;

  // ── ACWR：看週末當下（進行中的週看今天）───────────────────────────────
  const acwrDay = Math.min(week + 6, todayIdx);
  const trainingEntries = input.entries.filter((e) => e.exercise && countsAsTraining(e.exercise, e));
  const acwrResult = computeAcwr(
    trainingEntries.filter((e) => taipeiDayIndex(e.date) <= acwrDay).map((e) => ({ date: e.date, load: e.baselineValue ?? 0 })),
    new Date(acwrDay * DAY_MS),
  );

  // ── 個人紀錄：這週第一次超過過去最佳；第一次做的動作不算破紀錄 ─────────
  const records: ReportRecord[] = [];
  const weekExerciseIds = new Set(weekEntries.filter((e) => countsAsTraining(e.exercise, e)).map((e) => e.exerciseId));
  for (const exercise of input.exercises) {
    if (!weekExerciseIds.has(exercise.id)) continue;
    const upToWeek = trainingEntries.filter((e) => e.exerciseId === exercise.id && taipeiDayIndex(e.date) <= week + 6);
    const stats = computeExerciseStats(exercise, upToWeek, new Date((week + 6) * DAY_MS), Infinity);
    const before = stats.history.filter((h) => keyToDayIndex(h.date) < week);
    if (before.length === 0) continue;
    const previous = Math.max(...before.map((h) => h.metricValue));
    const prs = stats.history.filter((h) => keyToDayIndex(h.date) >= week && h.isPr);
    const best = prs[prs.length - 1];
    if (!best) continue;
    const metricLabel = stats.metric === "e1rm" ? "預估 1RM" : stats.metric === "load" ? "最高負重" : "單次最佳";
    records.push({
      exerciseId: exercise.id,
      name: exercise.name,
      metric: stats.metric,
      metricLabel,
      value: best.metricValue,
      previous,
      unit: stats.metric === "value" ? exercise.unit : stats.loadIsIndex ? "" : "kg",
      date: best.date,
    });
  }
  records.sort((a, b) => b.value / (b.previous || 1) - a.value / (a.previous || 1));

  // ── 主要動作 ────────────────────────────────────────────────────────────
  const baselineByExercise = (w: number) => {
    const totals = new Map<string, number>();
    for (const e of buckets.get(w)?.entries ?? []) {
      if (e.exercise.name === STEPS_EXERCISE_NAME) continue;
      totals.set(e.exerciseId, (totals.get(e.exerciseId) ?? 0) + (e.baselineValue ?? 0));
    }
    return totals;
  };
  const thisWeekTotals = baselineByExercise(week);
  const prevTotals = prevWeeks.map(baselineByExercise);
  const weekBaselineSum = Array.from(thisWeekTotals.values()).reduce((s, v) => s + v, 0);
  const topExercises: ReportTopExercise[] = Array.from(thisWeekTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_EXERCISES)
    .map(([exerciseId, baseline]) => {
      const sample = weekEntries.find((e) => e.exerciseId === exerciseId)!;
      return {
        exerciseId,
        name: sample.exercise.name,
        category: sample.exercise.category,
        baseline: round1(baseline),
        share: weekBaselineSum > 0 ? baseline / weekBaselineSum : 0,
        sessions: new Set(weekEntries.filter((e) => e.exerciseId === exerciseId).map((e) => taipeiDayIndex(e.date))).size,
        prevAvg: prevTotals.length ? round1(avg(prevTotals.map((t) => t.get(exerciseId) ?? 0))) : null,
      };
    });

  // ── 下週重點 ────────────────────────────────────────────────────────────
  const recentSessions = new Map<string, Set<number>>();
  for (const e of trainingEntries) {
    const day = taipeiDayIndex(e.date);
    if (day > acwrDay || day <= acwrDay - FOCUS_RECENT_DAYS) continue;
    const set = recentSessions.get(e.exerciseId) ?? new Set<number>();
    set.add(day);
    recentSessions.set(e.exerciseId, set);
  }
  const focus: ReportFocus[] = muscles
    .filter((m) => avgVolumeOf(m.name) > 0 && m.composite < 80)
    .sort((a, b) => a.composite - b.composite)
    .slice(0, FOCUS_MUSCLES)
    .map((m) => {
      const field = MUSCLE_FIELDS.find((f) => f.name === m.name)?.field;
      const contribution = (ex: Exercise) => (field ? ex[field] ?? 0 : ex.category === "有氧" ? 100 : 0);
      const suggestions = input.exercises
        .filter((ex) => countsAsTraining(ex) && contribution(ex) >= SUGGEST_MUSCLE_PCT)
        .sort(
          (a, b) =>
            (recentSessions.get(b.id)?.size ?? 0) - (recentSessions.get(a.id)?.size ?? 0) ||
            contribution(b) - contribution(a),
        )
        .slice(0, FOCUS_SUGGESTIONS)
        .map((ex) => ({ exerciseId: ex.id, name: ex.name }));
      return { name: m.name, composite: m.composite, sets: m.sets, maintenance: m.maintenance, suggestions };
    });

  const avgPrev4 = meanScore(prevWeeks);
  const report: WeeklyReport = {
    weekStart: dayIndexToKey(week),
    weekEnd: dayIndexToKey(week + 6),
    isCurrentWeek,
    daysElapsed,
    hasData: weekEntries.length > 0,
    prevWeekStart: prevWeekIdx === null ? null : dayIndexToKey(prevWeekIdx),
    nextWeekStart: week + 7 <= Math.max(lastWeek, currentWeekIdx) ? dayIndexToKey(week + 7) : null,
    score,
    prevWeek: prevWeekIdx === null ? null : scoreOf(prevWeekIdx),
    avgPrev4,
    rank,
    totalWeeks: allWeeks.length,
    milestones,
    careerAvgTotal,
    trainingDays: bucket?.days.size ?? 0,
    prevTrainingDays: prevWeekIdx === null ? null : buckets.get(prevWeekIdx)?.days.size ?? 0,
    strengthSets: round1(strengthSets),
    cardioMinutes: Math.round(cardioMinutes),
    dailySteps: stepEntry ? Math.round(stepEntry.value / 7) : null,
    balance,
    coverage,
    activityBonus,
    acwr: {
      ratio: acwrResult.ratio,
      zone: acwrResult.zone,
      acute: acwrResult.acute,
      chronic: acwrResult.chronic,
      series: acwrResult.series.map((p) => ({ date: p.date, ratio: p.ratio })),
    },
    days,
    muscles,
    trend,
    records,
    topExercises,
    observations: [],
    focus,
  };
  report.observations = buildObservations(report);
  return report;
}

const joinNames = (names: string[]) => names.map(muscleLabel).join("、");

/** 依規則產生文字觀察。進行中的週還沒練完，不提「不足」類的提醒。 */
export function buildObservations(r: WeeklyReport): ReportObservation[] {
  if (!r.hasData) return [{ tone: "info", text: "這週沒有任何訓練記錄。" }];

  const out: ReportObservation[] = [];
  const finished = !r.isCurrentWeek;

  if (r.avgPrev4 && r.avgPrev4.total > 0 && finished) {
    const shift = r.score.total / r.avgPrev4.total - 1;
    const pct = Math.abs(Math.round(shift * 100));
    if (shift >= SCORE_SHIFT) out.push({ tone: "good", text: `綜合分比前 4 週平均高 ${pct}%。` });
    else if (shift <= -SCORE_SHIFT) out.push({ tone: "warn", text: `綜合分比前 4 週平均低 ${pct}%。` });
    else out.push({ tone: "info", text: `綜合分跟前 4 週平均差不多（${shift >= 0 ? "+" : "−"}${pct}%）。` });
  }

  if (r.records.length > 0) {
    out.push({ tone: "good", text: `破了 ${r.records.length} 項個人紀錄：${r.records.slice(0, 3).map((p) => p.name).join("、")}${r.records.length > 3 ? " 等" : ""}。` });
  }

  if (finished && r.trainingDays < DISCIPLINE_DAYS) {
    out.push({ tone: "warn", text: `只練了 ${r.trainingDays} 天，未達每週 ${DISCIPLINE_DAYS} 天的門檻。` });
  }

  const compared = r.muscles.filter((m) => m.prevAvgComposite !== null);
  if (finished && compared.length > 0) {
    const shifts = compared
      .map((m) => ({ name: m.name, shift: m.composite - (m.prevAvgComposite as number) }))
      .sort((a, b) => b.shift - a.shift);
    const up = shifts[0];
    const down = shifts[shifts.length - 1];
    if (up.shift >= MUSCLE_SHIFT) out.push({ tone: "good", text: `${muscleLabel(up.name)}進步最多，複合分比前 4 週平均高 ${up.shift} 分。` });
    if (down.shift <= -MUSCLE_SHIFT) out.push({ tone: "warn", text: `${muscleLabel(down.name)}退步最多，複合分比前 4 週平均低 ${-down.shift} 分。` });
  }

  if (finished) {
    const streaks = r.muscles.filter((m) => m.lowStreak >= LOW_STREAK_WEEKS).sort((a, b) => b.lowStreak - a.lowStreak);
    if (streaks.length > 0) {
      const worst = streaks[0].lowStreak;
      out.push({ tone: "warn", text: `${joinNames(streaks.slice(0, 3).map((m) => m.name))}已連續 ${worst === streaks[Math.min(2, streaks.length - 1)].lowStreak ? worst : `${streaks[Math.min(2, streaks.length - 1)].lowStreak}–${worst}`} 週低於維持量。` });
    }
    if (r.balance !== null && r.balance < 50) {
      out.push({ tone: "warn", text: `均衡度 ${r.balance}%，最弱與最強的肌群落差偏大。` });
    }
  }

  if (r.acwr.zone === "danger") out.push({ tone: "warn", text: `ACWR ${r.acwr.ratio}，負荷增加太快，受傷風險偏高。` });
  else if (r.acwr.zone === "caution") out.push({ tone: "warn", text: `ACWR ${r.acwr.ratio}，已超過甜蜜點，留意疲勞。` });
  else if (r.acwr.zone === "optimal") out.push({ tone: "good", text: `ACWR ${r.acwr.ratio}，負荷增加的速度在甜蜜點內。` });
  else if (r.acwr.zone === "low" && finished) out.push({ tone: "info", text: `ACWR ${r.acwr.ratio}，訓練量低於身體已適應的程度。` });

  if (out.length === 0) out.push({ tone: "info", text: `這週到目前練了 ${r.trainingDays} 天，週日結束後會有完整比較。` });
  return out;
}
