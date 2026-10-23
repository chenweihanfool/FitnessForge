// 儀表板各卡片共用的 API 回應型別與格式化工具

export type WeekDetails = {
  weekStart: string;
  weekEnd: string;
  totalBaselineValue: number;
  weightedTotal: number;
  strengthValue: number;
  cardioValue: number;
  activityValue: number;
  strengthWeight: number;
  cardioWeight: number;
  activityWeight: number;
  entryCount: number;
  details: Array<{
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    weightFactor: number;
    intensityFactor: number;
    count: number;
    totalValue: number;
    baselineValue: number;
  }>;
};

export type BestWeekDetails = {
  weekStart: string;
  weekEnd: string;
  year: number;
  weekNumber: number;
  totalBaselineValue: number;
  entryCount: number;
  details: Array<{
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    weightFactor: number;
    count: number;
    totalValue: number;
    baselineValue: number;
    weeklyAverage: number | null;
    difference: number | null;
    differencePercentage: number | null;
  }>;
};

export type CategoryBreakdown = {
  category: string;
  value: number;
  percentage: number;
};

export type MuscleGroupWeeklyStats = {
  weekStart: string;
  weekEnd: string;
  muscleGroups: Array<{
    muscleGroup: string;
    totalSets: number;
    totalVolume: number;
  }>;
};

export type WeeklyProgress = {
  weekStart: string;
  weekEnd: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    currentWeekValue: number;
    weeklyAverage: number | null;
    difference: number | null;
    differencePercentage: number | null;
    daysSinceLastWorkout: number | null;
    currentWeekKm: number | null;
    weeklyAverageKm: number | null;
    bestWeekKm: number | null;
  }>;
  recommendations: Array<{
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    reason: string;
  }>;
};

export type DailyContributions = {
  weekStart: string;
  weekEnd: string;
  dailyData: Array<{
    date: string;
    dayOfWeek: number;
    dayName: string;
    baselineValue: number;
    percentage: number;
    entryCount: number;
  }>;
  weekTotal: number;
};

export type MuscleGroupAverages = {
  chestAvg: number;
  backAvg: number;
  legsAvg: number;
  shouldersAvg: number;
  armsAvg: number;
  coreAvg: number;
  glutesAvg: number;
  fullBodyAvg: number;
  aerobicAvg: number;
  weekCount: number;
};

export type MuscleGroupHistoryRecord = {
  weekStart: string;
  chestValue: number;
  backValue: number;
  legsValue: number;
  shouldersValue: number;
  armsValue: number;
  coreValue: number;
  glutesValue: number;
  fullBodyValue: number;
  aerobicValue: number;
  updatedAt: string;
};

export type DayEntriesData = {
  date: string;
  entries: Array<{
    id: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    value: number;
    sets: number | null;
    baselineValue: number;
    weightFactor: number;
  }>;
  totalBaselineValue: number;
  dailyStepsBaseline: number;
};

// 週區間帶年份：「2026/10/19 – 10/25」；跨年時結束日也帶年份
export const formatWeekRange = (startIso: string, endIso: string) => {
  const parts = (iso: string) => {
    const [y, m, d] = new Date(iso)
      .toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })
      .split("-")
      .map(Number);
    return { y, md: `${m}/${d}` };
  };
  const s = parts(startIso);
  const e = parts(endIso);
  return `${s.y}/${s.md} – ${e.y !== s.y ? `${e.y}/` : ""}${e.md}`;
};
