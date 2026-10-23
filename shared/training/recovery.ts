import { computeAcwr, ACWR_SWEET_HIGH, type AcwrZone } from "./acwr";
import { taipeiDayIndex } from "./time";

// 「久未訓練」與肌群恢復狀態：取代原本的 AI 週計畫。不排課表，只回答兩件事——
//   1. 哪些肌群/項目比平常久沒練了？
//   2. 那些肌群現在適不適合練（用該肌群自己的 ACWR 判斷是否已經過度疲勞）？

export const MUSCLE_FIELDS = [
  { field: "muscleChest", name: "胸" },
  { field: "muscleBack", name: "背" },
  { field: "muscleLegs", name: "腿" },
  { field: "muscleShoulders", name: "肩" },
  { field: "muscleArms", name: "二头肌" },
  { field: "muscleCore", name: "核心" },
  { field: "muscleGlutes", name: "臀" },
  { field: "muscleFullBody", name: "三头肌" },
] as const;

export type MuscleField = (typeof MUSCLE_FIELDS)[number]["field"];

/** 這個動作對某肌群的貢獻 ≥ 此百分比，才算「有練到」該肌群 */
const PRIMARY_MUSCLE_PCT = 30;
/** 超過幾天沒練就標「該練了」 */
export const MUSCLE_DUE_DAYS = 5;
/** 項目半年內都沒練視為已停練，不再列入「久未訓練」 */
const DORMANT_DAYS = 120;
const DEFAULT_INTERVAL_DAYS = 7;
const MAX_SUGGESTIONS = 3;
const OVERDUE_LIST_SIZE = 8;

export interface RecoveryExercise {
  id: string;
  name: string;
  category: string | null;
  muscleChest: number | null;
  muscleBack: number | null;
  muscleLegs: number | null;
  muscleShoulders: number | null;
  muscleArms: number | null;
  muscleCore: number | null;
  muscleGlutes: number | null;
  muscleFullBody: number | null;
}

export interface RecoveryEntry {
  exerciseId: string;
  date: Date | string;
  baselineValue: number | null;
  source?: string | null;
}

export type MuscleStatusKind = "fatigued" | "due" | "ok";

export interface MuscleSuggestion {
  exerciseId: string;
  name: string;
}

export interface MuscleStatus {
  name: string;
  daysSince: number | null; // null = 近 120 天沒練過
  acwr: number | null;
  zone: AcwrZone;
  status: MuscleStatusKind;
  suggestions: MuscleSuggestion[];
}

export interface OverdueExercise {
  exerciseId: string;
  name: string;
  category: string | null;
  daysSince: number;
  typicalIntervalDays: number;
  overdueRatio: number;
}

export interface RecoveryOverview {
  muscles: MuscleStatus[];
  /** 比平常久沒練的項目（已依逾期程度排序，取前幾名） */
  overdueExercises: OverdueExercise[];
  /** 近 120 天內練過的每個項目的間隔資訊，給快速記錄排序用 */
  exerciseRecency: OverdueExercise[];
}

/** 步數這類「活動量」不是訓練，不納入負荷與久未訓練 */
export function countsAsTraining(ex: Pick<RecoveryExercise, "category">, entry?: Pick<RecoveryEntry, "source">): boolean {
  return ex.category !== "活动量" && entry?.source !== "auto";
}

export function computeRecoveryOverview(
  exercises: RecoveryExercise[],
  entries: RecoveryEntry[],
  today: Date = new Date(),
): RecoveryOverview {
  const todayIdx = taipeiDayIndex(today);
  const exById = new Map(exercises.map((e) => [e.id, e]));

  const muscleLoads = new Map<string, Array<{ date: Date | string; load: number }>>();
  const muscleLastDay = new Map<string, number>();
  const sessionDays = new Map<string, Set<number>>(); // exerciseId -> 訓練日集合

  for (const entry of entries) {
    const ex = exById.get(entry.exerciseId);
    if (!ex || !countsAsTraining(ex, entry)) continue;
    const day = taipeiDayIndex(entry.date);
    if (day > todayIdx) continue;

    const days = sessionDays.get(ex.id) ?? new Set<number>();
    days.add(day);
    sessionDays.set(ex.id, days);

    const baseline = entry.baselineValue ?? 0;
    const touch = (muscle: string, pct: number) => {
      if (baseline > 0) {
        const list = muscleLoads.get(muscle) ?? [];
        list.push({ date: entry.date, load: (baseline * pct) / 100 });
        muscleLoads.set(muscle, list);
      }
      if (pct >= PRIMARY_MUSCLE_PCT && day > (muscleLastDay.get(muscle) ?? -Infinity)) {
        muscleLastDay.set(muscle, day);
      }
    };
    for (const { field, name } of MUSCLE_FIELDS) {
      const pct = ex[field] ?? 0;
      if (pct > 0) touch(name, pct);
    }
    if (ex.category === "有氧") touch("有氧", 100);
  }

  // 各肌群最近常用的動作，當「該練了」時的建議清單
  const sessionCount = (exerciseId: string) => sessionDays.get(exerciseId)?.size ?? 0;
  const suggestFor = (muscle: string): MuscleSuggestion[] =>
    exercises
      .filter((ex) => {
        if (!countsAsTraining(ex) || sessionCount(ex.id) === 0) return false;
        if (muscle === "有氧") return ex.category === "有氧";
        const field = MUSCLE_FIELDS.find((m) => m.name === muscle)!.field;
        return (ex[field] ?? 0) >= PRIMARY_MUSCLE_PCT;
      })
      .sort((a, b) => sessionCount(b.id) - sessionCount(a.id) || a.name.localeCompare(b.name, "zh-Hant"))
      .slice(0, MAX_SUGGESTIONS)
      .map((ex) => ({ exerciseId: ex.id, name: ex.name }));

  const muscleNames = [...MUSCLE_FIELDS.map((m) => m.name), "有氧"];
  const muscles: MuscleStatus[] = muscleNames
    .filter((name) => muscleLastDay.has(name) || suggestFor(name).length > 0)
    .map((name) => {
      const lastDay = muscleLastDay.get(name);
      const rawDays = lastDay === undefined ? null : todayIdx - lastDay;
      const daysSince = rawDays !== null && rawDays <= DORMANT_DAYS ? rawDays : null;
      const acwr = computeAcwr(muscleLoads.get(name) ?? [], today, 1);
      const fatigued = acwr.ratio !== null && acwr.zone !== "insufficient" && acwr.ratio > ACWR_SWEET_HIGH;
      const status: MuscleStatusKind = fatigued ? "fatigued" : daysSince === null || daysSince >= MUSCLE_DUE_DAYS ? "due" : "ok";
      return {
        name,
        daysSince,
        acwr: acwr.ratio,
        zone: acwr.zone,
        status,
        suggestions: status === "due" ? suggestFor(name) : [],
      };
    });

  // 排序：該練的（最久沒練的在前）→ 狀態正常 → 疲勞偏高（要休息的放最後，但仍可見）
  const statusRank: Record<MuscleStatusKind, number> = { due: 0, ok: 1, fatigued: 2 };
  muscles.sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity),
  );

  const exerciseRecency: OverdueExercise[] = [];
  for (const [exerciseId, days] of Array.from(sessionDays.entries())) {
    const ex = exById.get(exerciseId)!;
    const sorted = Array.from(days).sort((a, b) => a - b);
    const daysSince = todayIdx - sorted[sorted.length - 1];
    if (daysSince > DORMANT_DAYS) continue;
    const typical = typicalInterval(sorted);
    exerciseRecency.push({
      exerciseId,
      name: ex.name,
      category: ex.category,
      daysSince,
      typicalIntervalDays: typical,
      overdueRatio: Math.round((daysSince / typical) * 10) / 10,
    });
  }
  exerciseRecency.sort((a, b) => b.overdueRatio - a.overdueRatio || b.daysSince - a.daysSince);
  const overdueExercises = exerciseRecency.filter((e) => e.overdueRatio >= 1).slice(0, OVERDUE_LIST_SIZE);

  return { muscles, overdueExercises, exerciseRecency };
}

// 相鄰訓練日間隔的中位數（至少 2 天，避免天天練的項目隔一天就被標逾期）；
// 只練過一次的項目沒有間隔可看，用預設 7 天。
function typicalInterval(sortedDays: number[]): number {
  if (sortedDays.length < 2) return DEFAULT_INTERVAL_DAYS;
  const gaps = sortedDays.slice(1).map((d, i) => d - sortedDays[i]).sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return Math.max(2, Math.round(median));
}

