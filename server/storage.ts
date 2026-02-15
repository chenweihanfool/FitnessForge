import {
  type Exercise,
  type InsertExercise,
  type WorkoutEntry,
  type InsertWorkoutEntry,
  type WorkoutEntryWithExercise,
  type WeeklyStats,
  type RankingData,
  type RankingDetailResponse,
  exercises,
  workoutEntries,
  weeklyMuscleStats,
  userSettings,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, gte, lte, lt, desc, sql, sum, count } from "drizzle-orm";
import { Pool } from "pg";

function calculateBaseline(
  value: number,
  sets: number,
  weightFactor: number,
  category: string | null,
  movementCoefficient: number,
  intensityFactor: number,
  exerciseName: string
): number {
  if (exerciseName === '每周平均步数' || category === '活动量') {
    if (value <= 0) return 0;
    const dailySteps = exerciseName === '每周平均步数' ? value / 7 : value;
    const dailyScore = (dailySteps / 500) * (1 - 0.00002 * dailySteps);
    return dailyScore * 7;
  }
  if (category === '有氧') {
    if (exerciseName === '開合跳') {
      return (value / 60) * (sets || 1) * intensityFactor;
    }
    return value * (sets || 1) * intensityFactor;
  }
  if (category === '力量') {
    return weightFactor * value * (sets || 1) * movementCoefficient / 10;
  }
  return value * (sets || 1) * weightFactor;
}

export interface IStorage {
  // 运动类型 CRUD
  getExercises(): Promise<Exercise[]>;
  getExercise(id: string): Promise<Exercise | undefined>;
  createExercise(exercise: InsertExercise): Promise<Exercise>;
  updateExercise(id: string, exercise: InsertExercise): Promise<Exercise | undefined>;
  deleteExercise(id: string): Promise<boolean>;

  // 运动记录 CRUD
  getWorkoutEntries(): Promise<WorkoutEntryWithExercise[]>;
  getWorkoutEntry(id: string): Promise<WorkoutEntryWithExercise | undefined>;
  createWorkoutEntry(entry: InsertWorkoutEntry): Promise<WorkoutEntry>;
  updateWorkoutEntry(id: string, entry: InsertWorkoutEntry): Promise<WorkoutEntry | undefined>;
  deleteWorkoutEntry(id: string): Promise<boolean>;

  // 统计和分析
  getWeeklyStats(weekStart: Date, weekEnd: Date): Promise<WeeklyStats>;
  getAllWeeklyStats(): Promise<WeeklyStats[]>;
  getRankingData(): Promise<RankingData>;
  getRankingDetail(metric: 'total' | 'strength' | 'cardio' | 'activity'): Promise<RankingDetailResponse>;
  getCurrentWeekDetails(): Promise<{
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
  }>;
  getExerciseWeeklyAverage(exerciseId: string): Promise<number | null>;
  getWeeklyProgress(): Promise<{
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
    }>;
    recommendations: Array<{
      exerciseId: string;
      exerciseName: string;
      exerciseUnit: string;
      reason: string;
    }>;
  }>;
  getDailyContributions(): Promise<{
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
  }>;
  getEntriesByDate(date: string): Promise<{
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
    dailyStepsBaseline: number; // 每周平均步数分配到当日的基准值
  }>;
  getWeekDetails(weekStart: string): Promise<{
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
  }>;
  getCareerOverview(): Promise<{
    weeks: Array<{
      weekStart: string;
      weekEnd: string;
      year: number;
      weekNumber: number;
      totalScore: number;
      strengthScore: number;
      cardioScore: number;
      activityScore: number;
      stars: number;
      percentile: number;
    }>;
    totalStars: number;
    averageStars: number;
  }>;
  getMuscleGroupWeeklyStats(): Promise<{
    weekStart: string;
    weekEnd: string;
    muscleGroups: Array<{
      muscleGroup: string;
      totalSets: number;
      totalVolume: number;
    }>;
  }>;
  
  // 每周肌群统计持久化
  updateWeeklyMuscleStats(weekStart: string): Promise<void>;
  getWeeklyMuscleStatsHistory(): Promise<Array<{
    weekStart: string;
    chestValue: number;
    backValue: number;
    legsValue: number;
    shouldersValue: number;
    armsValue: number;
    coreValue: number;
    glutesValue: number;
    fullBodyValue: number;
    updatedAt: Date;
  }>>;
  getMuscleGroupAverages(): Promise<{
    chestAvg: number;
    backAvg: number;
    legsAvg: number;
    shouldersAvg: number;
    armsAvg: number;
    coreAvg: number;
    glutesAvg: number;
    fullBodyAvg: number;
    weekCount: number;
  }>;
  migrateHistoricalMuscleStats(): Promise<{ migratedWeeks: number }>;
  recalculateAllBaselines(): Promise<{ updatedEntries: number; updatedWeeks: number; updatedExercises: number }>;

  // 用户设置
  getUserSetting(key: string): Promise<string | null>;
  setUserSetting(key: string, value: string): Promise<void>;
  getAllUserSettings(): Promise<Record<string, string>>;
}

type WeeklyMuscleStatsRecord = {
  weekStart: string;
  chestValue: number;
  backValue: number;
  legsValue: number;
  shouldersValue: number;
  armsValue: number;
  coreValue: number;
  glutesValue: number;
  fullBodyValue: number;
  updatedAt: Date;
};

export class MemStorage implements IStorage {
  private exercises: Map<string, Exercise>;
  private workoutEntries: Map<string, WorkoutEntry>;
  private weeklyMuscleStatsStore: Map<string, WeeklyMuscleStatsRecord>;
  
  // UTC+8时区偏移（毫秒）
  private readonly TAIPEI_OFFSET = 8 * 60 * 60 * 1000;

  constructor() {
    this.exercises = new Map();
    this.workoutEntries = new Map();
    this.weeklyMuscleStatsStore = new Map();
  }
  
  // 辅助方法：获取台北时区的年月日时分秒
  private getTaipeiComponents(utcDate: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    ms: number;
    dayOfWeek: number;
  } {
    // 将UTC时间戳加8小时得到台北时间戳
    const taipeiTimestamp = utcDate.getTime() + this.TAIPEI_OFFSET;
    const taipeiDate = new Date(taipeiTimestamp);
    
    return {
      year: taipeiDate.getUTCFullYear(),
      month: taipeiDate.getUTCMonth(),
      day: taipeiDate.getUTCDate(),
      hour: taipeiDate.getUTCHours(),
      minute: taipeiDate.getUTCMinutes(),
      second: taipeiDate.getUTCSeconds(),
      ms: taipeiDate.getUTCMilliseconds(),
      dayOfWeek: taipeiDate.getUTCDay(), // 0=周日, 1=周一...
    };
  }

  // 辅助方法：从台北时区组件创建UTC Date
  private createUTCFromTaipei(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): Date {
    // 创建台北时间的UTC表示
    const taipeiDate = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
    // 减去8小时偏移得到真正的UTC时间
    return new Date(taipeiDate.getTime() - this.TAIPEI_OFFSET);
  }

  // 运动类型方法
  async getExercises(): Promise<Exercise[]> {
    return Array.from(this.exercises.values());
  }

  async getExercise(id: string): Promise<Exercise | undefined> {
    return this.exercises.get(id);
  }

  async createExercise(insertExercise: InsertExercise): Promise<Exercise> {
    const id = randomUUID();
    const exercise: Exercise = { 
      ...insertExercise, 
      id, 
      category: insertExercise.category ?? null,
      splitCategory: insertExercise.splitCategory ?? null,
      splitRatio: insertExercise.splitRatio ?? 0,
      muscleChest: insertExercise.muscleChest ?? 0,
      muscleBack: insertExercise.muscleBack ?? 0,
      muscleLegs: insertExercise.muscleLegs ?? 0,
      muscleShoulders: insertExercise.muscleShoulders ?? 0,
      muscleArms: insertExercise.muscleArms ?? 0,
      muscleCore: insertExercise.muscleCore ?? 0,
      muscleGlutes: insertExercise.muscleGlutes ?? 0,
      muscleFullBody: insertExercise.muscleFullBody ?? 0,
    };
    this.exercises.set(id, exercise);
    return exercise;
  }

  async updateExercise(id: string, insertExercise: InsertExercise): Promise<Exercise | undefined> {
    const existing = this.exercises.get(id);
    if (!existing) return undefined;

    const updated: Exercise = { 
      ...insertExercise, 
      id, 
      category: insertExercise.category ?? null,
      splitCategory: insertExercise.splitCategory ?? null,
      splitRatio: insertExercise.splitRatio ?? 0,
      muscleChest: insertExercise.muscleChest ?? 0,
      muscleBack: insertExercise.muscleBack ?? 0,
      muscleLegs: insertExercise.muscleLegs ?? 0,
      muscleShoulders: insertExercise.muscleShoulders ?? 0,
      muscleArms: insertExercise.muscleArms ?? 0,
      muscleCore: insertExercise.muscleCore ?? 0,
      muscleGlutes: insertExercise.muscleGlutes ?? 0,
      muscleFullBody: insertExercise.muscleFullBody ?? 0,
    };
    this.exercises.set(id, updated);
    return updated;
  }

  async deleteExercise(id: string): Promise<boolean> {
    // 同时删除相关的运动记录
    const entriesToDelete = Array.from(this.workoutEntries.values())
      .filter(entry => entry.exerciseId === id);
    
    entriesToDelete.forEach(entry => {
      this.workoutEntries.delete(entry.id);
    });

    return this.exercises.delete(id);
  }

  // 运动记录方法
  async getWorkoutEntries(): Promise<WorkoutEntryWithExercise[]> {
    const entries = Array.from(this.workoutEntries.values());
    const result: WorkoutEntryWithExercise[] = [];

    for (const entry of entries) {
      const exercise = this.exercises.get(entry.exerciseId);
      if (exercise) {
        result.push({ ...entry, exercise });
      }
    }

    // 按日期降序排序
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getWorkoutEntry(id: string): Promise<WorkoutEntryWithExercise | undefined> {
    const entry = this.workoutEntries.get(id);
    if (!entry) return undefined;

    const exercise = this.exercises.get(entry.exerciseId);
    if (!exercise) return undefined;

    return { ...entry, exercise };
  }

  async createWorkoutEntry(insertEntry: InsertWorkoutEntry): Promise<WorkoutEntry> {
    const id = randomUUID();
    const date = insertEntry.date ? new Date(insertEntry.date) : new Date();
    
    const exercise = this.exercises.get(insertEntry.exerciseId);
    const weightFactor = insertEntry.weightFactor ?? exercise?.weightFactor ?? 1;
    const sets = insertEntry.sets ?? 1;
    const baselineValue = calculateBaseline(
      insertEntry.value, sets, weightFactor,
      exercise?.category ?? null,
      exercise?.movementCoefficient ?? 1,
      exercise?.intensityFactor ?? 1,
      exercise?.name ?? ''
    );
    
    const entry: WorkoutEntry = {
      id,
      exerciseId: insertEntry.exerciseId,
      value: insertEntry.value,
      sets: insertEntry.sets ?? null,
      weightFactor,
      baselineValue,
      date,
      notes: insertEntry.notes || null,
    };

    this.workoutEntries.set(id, entry);
    return entry;
  }

  async updateWorkoutEntry(id: string, insertEntry: InsertWorkoutEntry): Promise<WorkoutEntry | undefined> {
    const existing = this.workoutEntries.get(id);
    if (!existing) return undefined;

    const date = insertEntry.date ? new Date(insertEntry.date) : existing.date;
    
    const exercise = this.exercises.get(insertEntry.exerciseId);
    const weightFactor = insertEntry.weightFactor ?? exercise?.weightFactor ?? 1;
    const sets = insertEntry.sets ?? 1;
    const baselineValue = calculateBaseline(
      insertEntry.value, sets, weightFactor,
      exercise?.category ?? null,
      exercise?.movementCoefficient ?? 1,
      exercise?.intensityFactor ?? 1,
      exercise?.name ?? ''
    );
    
    const updated: WorkoutEntry = {
      id,
      exerciseId: insertEntry.exerciseId,
      value: insertEntry.value,
      sets: insertEntry.sets ?? null,
      weightFactor,
      baselineValue,
      date,
      notes: insertEntry.notes || null,
    };

    this.workoutEntries.set(id, updated);
    return updated;
  }

  async deleteWorkoutEntry(id: string): Promise<boolean> {
    return this.workoutEntries.delete(id);
  }

  // 统计和分析方法
  async getWeeklyStats(weekStart: Date, weekEnd: Date): Promise<WeeklyStats> {
    const entries = Array.from(this.workoutEntries.values())
      .filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= weekStart && entryDate <= weekEnd;
      });

    let strengthValue = 0;
    let cardioValue = 0;
    let activityValue = 0;

    for (const entry of entries) {
      const exercise = this.exercises.get(entry.exerciseId);
      if (exercise) {
        const baseline = entry.baselineValue ?? 0;

        const hasSplit = exercise.splitCategory && exercise.splitRatio && exercise.splitRatio > 0;
        const primaryRatio = hasSplit ? 1 - (exercise.splitRatio || 0) : 1;
        const secondaryRatio = hasSplit ? (exercise.splitRatio || 0) : 0;

        if (exercise.category === '力量') {
          strengthValue += baseline * primaryRatio;
        } else if (exercise.category === '有氧') {
          cardioValue += baseline * primaryRatio;
        } else if (exercise.category === '活动量') {
          activityValue += baseline * primaryRatio;
        }

        if (hasSplit) {
          if (exercise.splitCategory === '力量') {
            strengthValue += baseline * secondaryRatio;
          } else if (exercise.splitCategory === '有氧') {
            cardioValue += baseline * secondaryRatio;
          } else if (exercise.splitCategory === '活动量') {
            activityValue += baseline * secondaryRatio;
          }
        }
      }
    }

    const settings = await this.getAllUserSettings();
    const strengthWeight = parseFloat(settings['strengthWeight'] ?? '50') / 100;
    const cardioWeight = parseFloat(settings['cardioWeight'] ?? '30') / 100;
    const activityWeight = parseFloat(settings['activityWeight'] ?? '20') / 100;
    const totalBaselineValue = strengthValue * strengthWeight + cardioValue * cardioWeight + activityValue * activityWeight;

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalBaselineValue,
      entryCount: entries.length,
      strengthValue,
      cardioValue,
      activityValue,
    };
  }

  async getAllWeeklyStats(): Promise<WeeklyStats[]> {
    const allEntries = Array.from(this.workoutEntries.values());
    if (allEntries.length === 0) return [];

    // 找到最早和最晚的记录
    const dates = allEntries.map(e => new Date(e.date).getTime());
    const earliestDate = new Date(Math.min(...dates));
    const latestDate = new Date(Math.max(...dates));

    // 获取最早记录所在周的周一
    const firstWeekStart = this.getWeekStart(earliestDate);
    
    // 获取最晚记录所在周的周日
    const lastWeekEnd = this.getWeekEnd(latestDate);

    // 生成所有周的统计
    const weeklyStats: WeeklyStats[] = [];
    let currentWeekStart = new Date(firstWeekStart);

    while (currentWeekStart <= lastWeekEnd) {
      const currentWeekEnd = this.getWeekEnd(currentWeekStart);
      const stats = await this.getWeeklyStats(currentWeekStart, currentWeekEnd);
      weeklyStats.push(stats);

      // 移动到下一周
      currentWeekStart = new Date(currentWeekStart);
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return weeklyStats;
  }

  async getCurrentWeekDetails() {
    // 获取排名数据以获得"当前周"（实际上是最后一周有数据的周）
    const rankingData = await this.getRankingData();
    const weekStart = new Date(rankingData.currentWeek.weekStart);
    const weekEnd = new Date(rankingData.currentWeek.weekEnd);

    const entries = Array.from(this.workoutEntries.values())
      .filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= weekStart && entryDate <= weekEnd;
      });

    const exerciseStats = new Map<string, {
      exerciseId: string;
      exerciseName: string;
      exerciseUnit: string;
      exerciseCategory: string | null;
      weightFactor: number;
      intensityFactor: number;
      count: number;
      totalValue: number;
      baselineValue: number;
    }>();

    for (const entry of entries) {
      const exercise = this.exercises.get(entry.exerciseId);
      if (!exercise) continue;

      const sets = entry.sets || 1;
      const entryTotal = entry.value * sets;
      const entryBaseline = entry.baselineValue ?? (entryTotal * exercise.weightFactor);

      const existing = exerciseStats.get(entry.exerciseId);
      if (existing) {
        existing.count++;
        existing.totalValue += entryTotal;
        existing.baselineValue += entryBaseline;
      } else {
        exerciseStats.set(entry.exerciseId, {
          exerciseId: entry.exerciseId,
          exerciseName: exercise.name,
          exerciseUnit: exercise.unit,
          exerciseCategory: exercise.category,
          weightFactor: exercise.weightFactor,
          intensityFactor: exercise.intensityFactor ?? 1,
          count: 1,
          totalValue: entryTotal,
          baselineValue: entryBaseline,
        });
      }
    }

    const details = Array.from(exerciseStats.values())
      .sort((a, b) => b.baselineValue - a.baselineValue);

    const totalBaselineValue = details.reduce((sum, d) => sum + d.baselineValue, 0);

    const weeklyStats = await this.getWeeklyStats(weekStart, weekEnd);
    const settings = await this.getAllUserSettings();
    const strengthWeightPct = parseFloat(settings['strengthWeight'] ?? '50');
    const cardioWeightPct = parseFloat(settings['cardioWeight'] ?? '30');
    const activityWeightPct = parseFloat(settings['activityWeight'] ?? '20');

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalBaselineValue,
      weightedTotal: weeklyStats.totalBaselineValue,
      strengthValue: weeklyStats.strengthValue,
      cardioValue: weeklyStats.cardioValue,
      activityValue: weeklyStats.activityValue,
      strengthWeight: strengthWeightPct,
      cardioWeight: cardioWeightPct,
      activityWeight: activityWeightPct,
      entryCount: entries.length,
      details,
    };
  }

  async getRankingData(): Promise<RankingData> {
    const allWeeklyStats = await this.getAllWeeklyStats();
    
    if (allWeeklyStats.length === 0) {
      const now = new Date();
      const weekStart = this.getWeekStart(now);
      const weekEnd = this.getWeekEnd(now);
      
      return {
        currentWeek: {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          totalBaselineValue: 0,
          entryCount: 0,
          strengthValue: 0,
          cardioValue: 0,
          activityValue: 0,
        },
        bestWeek: null,
        worstWeek: null,
        averageWeeklyValue: 0,
        averageStrengthValue: 0,
        averageCardioValue: 0,
        averageActivityValue: 0,
        rank: 0,
        totalWeeks: 0,
        strengthRank: 0,
        cardioRank: 0,
        activityRank: 0,
        topWeekTotalValue: 0,
        topWeekStrengthValue: 0,
        topWeekCardioValue: 0,
        topWeekActivityValue: 0,
      };
    }

    // 当前周（最后一周）
    const currentWeek = allWeeklyStats[allWeeklyStats.length - 1];

    // 找出最佳周、最差周
    let bestWeek = allWeeklyStats[0];
    let worstWeek = allWeeklyStats[0];

    for (const week of allWeeklyStats) {
      if (week.totalBaselineValue > bestWeek.totalBaselineValue) {
        bestWeek = week;
      }
      if (week.totalBaselineValue < worstWeek.totalBaselineValue) {
        worstWeek = week;
      }
    }

    // 计算各指标平均值
    const totalValue = allWeeklyStats.reduce((sum, week) => sum + week.totalBaselineValue, 0);
    const averageWeeklyValue = totalValue / allWeeklyStats.length;
    
    const totalStrength = allWeeklyStats.reduce((sum, week) => sum + week.strengthValue, 0);
    const averageStrengthValue = totalStrength / allWeeklyStats.length;
    
    const totalCardio = allWeeklyStats.reduce((sum, week) => sum + week.cardioValue, 0);
    const averageCardioValue = totalCardio / allWeeklyStats.length;
    
    const totalActivity = allWeeklyStats.reduce((sum, week) => sum + week.activityValue, 0);
    const averageActivityValue = totalActivity / allWeeklyStats.length;

    // 计算总排名（降序，值越大排名越高）
    const sorted = [...allWeeklyStats].sort((a, b) => b.totalBaselineValue - a.totalBaselineValue);
    const rank = sorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    ) + 1;

    // 计算分类排名
    const strengthSorted = [...allWeeklyStats].sort((a, b) => b.strengthValue - a.strengthValue);
    const strengthRank = strengthSorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    ) + 1;

    const cardioSorted = [...allWeeklyStats].sort((a, b) => b.cardioValue - a.cardioValue);
    const cardioRank = cardioSorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    ) + 1;

    const activitySorted = [...allWeeklyStats].sort((a, b) => b.activityValue - a.activityValue);
    const activityRank = activitySorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    ) + 1;

    // 获取各分类第一名的数值
    const topWeekTotalValue = sorted[0].totalBaselineValue;
    const topWeekStrengthValue = strengthSorted[0].strengthValue;
    const topWeekCardioValue = cardioSorted[0].cardioValue;
    const topWeekActivityValue = activitySorted[0].activityValue;

    return {
      currentWeek,
      bestWeek,
      worstWeek,
      averageWeeklyValue,
      averageStrengthValue,
      averageCardioValue,
      averageActivityValue,
      rank,
      totalWeeks: allWeeklyStats.length,
      strengthRank,
      cardioRank,
      activityRank,
      topWeekTotalValue,
      topWeekStrengthValue,
      topWeekCardioValue,
      topWeekActivityValue,
    };
  }

  async getRankingDetail(metric: 'total' | 'strength' | 'cardio' | 'activity'): Promise<RankingDetailResponse> {
    const allWeeklyStats = await this.getAllWeeklyStats();
    
    if (allWeeklyStats.length === 0) {
      const now = new Date();
      const weekStart = this.getWeekStart(now);
      const weekEnd = this.getWeekEnd(now);
      const thursday = new Date(weekStart);
      thursday.setDate(thursday.getDate() + 3);
      const year = this.getISOYear(thursday);
      const weekNumber = this.getWeekNumber(weekStart);
      
      return {
        metric,
        current: {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          year,
          weekNumber,
          rank: 0,
          value: 0,
        },
        surrounding: [],
        careerAverage: 0,
      };
    }

    // 根据metric选择要排序的字段
    const getValue = (week: WeeklyStats) => {
      switch (metric) {
        case 'total': return week.totalBaselineValue;
        case 'strength': return week.strengthValue;
        case 'cardio': return week.cardioValue;
        case 'activity': return week.activityValue;
      }
    };

    // 计算生涯平均值（基于所有历史周数据）
    const totalValue = allWeeklyStats.reduce((sum, week) => sum + getValue(week), 0);
    const careerAverage = totalValue / allWeeklyStats.length;

    // 按指定metric降序排序
    const sorted = [...allWeeklyStats].sort((a, b) => getValue(b) - getValue(a));
    
    // 当前周（最后一周）
    const currentWeek = allWeeklyStats[allWeeklyStats.length - 1];
    
    // 找到当前周在排序后的索引
    const currentIndex = sorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    );
    
    // 计算当前周的排名
    const currentRank = currentIndex + 1;
    
    // 获取当前周的ISO周信息
    const currentWeekStart = new Date(currentWeek.weekStart);
    const currentThursday = new Date(currentWeekStart);
    currentThursday.setDate(currentThursday.getDate() + 3);
    const currentYear = this.getISOYear(currentThursday);
    const currentWeekNumber = this.getWeekNumber(currentWeekStart);
    
    // 计算要显示的范围：前2名到后2名
    const startIdx = Math.max(0, currentIndex - 2);
    const endIdx = Math.min(sorted.length, currentIndex + 3);
    const surroundingWeeks = sorted.slice(startIdx, endIdx);
    
    // 构建结果
    const current = {
      weekStart: currentWeek.weekStart,
      weekEnd: currentWeek.weekEnd,
      year: currentYear,
      weekNumber: currentWeekNumber,
      rank: currentRank,
      value: getValue(currentWeek),
    };
    
    const surrounding = surroundingWeeks.map((week, idx) => {
      const weekStart = new Date(week.weekStart);
      const thursday = new Date(weekStart);
      thursday.setDate(thursday.getDate() + 3);
      const year = this.getISOYear(thursday);
      const weekNumber = this.getWeekNumber(weekStart);
      
      return {
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        year,
        weekNumber,
        rank: startIdx + idx + 1,
        value: getValue(week),
      };
    });
    
    return {
      metric,
      current,
      surrounding,
      careerAverage,
    };
  }

  async getExerciseWeeklyAverage(exerciseId: string): Promise<number | null> {
    // 获取该运动类型的所有记录
    const exerciseEntries = Array.from(this.workoutEntries.values())
      .filter(entry => entry.exerciseId === exerciseId);

    if (exerciseEntries.length === 0) {
      return null;
    }

    // 按周分组计算
    const weeklyTotals = new Map<string, number>();

    for (const entry of exerciseEntries) {
      const entryDate = new Date(entry.date);
      const weekStart = this.getWeekStart(entryDate);
      const weekKey = weekStart.toISOString();

      weeklyTotals.set(
        weekKey,
        (weeklyTotals.get(weekKey) || 0) + entry.value
      );
    }

    // 计算平均值
    const totalWeeks = weeklyTotals.size;
    const sumOfWeeklyTotals = Array.from(weeklyTotals.values()).reduce((sum, val) => sum + val, 0);
    
    return sumOfWeeklyTotals / totalWeeks;
  }

  async getWeeklyProgress() {
    const allExercises = await this.getExercises();
    const weekDetails = await this.getCurrentWeekDetails();
    const now = new Date();
    
    const exercisesProgress: Array<{
      exerciseId: string;
      exerciseName: string;
      exerciseUnit: string;
      exerciseCategory: string | null;
      currentWeekValue: number;
      weeklyAverage: number | null;
      difference: number | null;
      differencePercentage: number | null;
      daysSinceLastWorkout: number | null;
    }> = [];
    
    for (const exercise of allExercises) {
      const weekDetail = weekDetails.details.find(d => d.exerciseId === exercise.id);
      const currentWeekValue = weekDetail?.totalValue || 0;
      const weeklyAverage = await this.getExerciseWeeklyAverage(exercise.id);
      
      let difference = null;
      let differencePercentage = null;
      
      if (weeklyAverage !== null && weeklyAverage > 0) {
        difference = currentWeekValue - weeklyAverage;
        differencePercentage = (difference / weeklyAverage) * 100;
      }
      
      // 计算距离上次锻炼的天数
      const exerciseEntries = Array.from(this.workoutEntries.values())
        .filter(entry => entry.exerciseId === exercise.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      let daysSinceLastWorkout: number | null = null;
      if (exerciseEntries.length > 0) {
        const lastWorkoutDate = new Date(exerciseEntries[0].date);
        const nowTaipei = this.getTaipeiComponents(now);
        const lastTaipei = this.getTaipeiComponents(lastWorkoutDate);
        
        // getTaipeiComponents返回的month已经是0基索引，直接使用
        const nowDateOnly = new Date(nowTaipei.year, nowTaipei.month, nowTaipei.day);
        const lastDateOnly = new Date(lastTaipei.year, lastTaipei.month, lastTaipei.day);
        daysSinceLastWorkout = Math.floor((nowDateOnly.getTime() - lastDateOnly.getTime()) / (24 * 60 * 60 * 1000));
      }
      
      exercisesProgress.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        exerciseUnit: exercise.unit,
        exerciseCategory: exercise.category,
        currentWeekValue,
        weeklyAverage,
        difference,
        differencePercentage,
        daysSinceLastWorkout,
      });
    }
    
    // 推荐逻辑（MemStorage）：
    // 1. 最优先：推荐能锻炼到组数落后肌群的运动项目
    // 2. 其次：按距离上次锻炼天数排序，推荐很久没练的运动
    // 注意：排除"每周平均步数"，因为它是特殊的统计项目
    const recommendations: Array<{
      exerciseId: string;
      exerciseName: string;
      exerciseUnit: string;
      reason: string;
    }> = [];
    
    // 获取本周肌群训练数据
    const muscleGroupStats = await this.getMuscleGroupWeeklyStats();
    
    // 定义肌群字段映射
    const muscleFieldMap: Array<{ field: string; name: string }> = [
      { field: 'muscleChest', name: '胸' },
      { field: 'muscleBack', name: '背' },
      { field: 'muscleLegs', name: '腿' },
      { field: 'muscleShoulders', name: '肩' },
      { field: 'muscleArms', name: '二头肌' },
      { field: 'muscleCore', name: '核心' },
      { field: 'muscleGlutes', name: '臀' },
      { field: 'muscleFullBody', name: '三头肌' },
    ];
    
    // 找出组数落后的肌群（< 4组为低于维持量）
    const trainedMuscleMap = new Map<string, number>();
    for (const mg of muscleGroupStats.muscleGroups) {
      trainedMuscleMap.set(mg.muscleGroup, mg.totalSets);
    }
    
    // 找出所有肌群及其组数（未训练的为0）
    const allMuscleSetCounts: Array<{ name: string; sets: number }> = muscleFieldMap.map(m => ({
      name: m.name,
      sets: trainedMuscleMap.get(m.name) || 0,
    }));
    
    // 按组数排序，组数最少的排前面
    allMuscleSetCounts.sort((a, b) => a.sets - b.sets);
    
    // 找出组数落后的肌群（< 4组）
    const laggingMuscles = allMuscleSetCounts.filter(m => m.sets < 4);
    
    // 找出能锻炼落后肌群的运动（排除"每周平均步数"）
    if (laggingMuscles.length > 0) {
      for (const laggingMuscle of laggingMuscles) {
        const fieldInfo = muscleFieldMap.find(m => m.name === laggingMuscle.name);
        if (!fieldInfo) continue;
        
        // 找出能锻炼这个肌群的运动
        const exercisesForMuscle = allExercises.filter(ex => {
          const muscleValue = (ex as Record<string, unknown>)[fieldInfo.field] as number | null;
          return muscleValue && muscleValue > 0 && ex.name !== '每周平均步数';
        });
        
        if (exercisesForMuscle.length > 0) {
          // 优先推荐本周还没练过的
          const notDoneExercises = exercisesForMuscle.filter(ex => {
            const progress = exercisesProgress.find(p => p.exerciseId === ex.id);
            return progress && progress.currentWeekValue === 0;
          });
          
          // 按肌群百分比排序，选择对该肌群锻炼效果最好的
          const sortedExercises = (notDoneExercises.length > 0 ? notDoneExercises : exercisesForMuscle)
            .sort((a, b) => {
              const aValue = ((a as Record<string, unknown>)[fieldInfo.field] as number) || 0;
              const bValue = ((b as Record<string, unknown>)[fieldInfo.field] as number) || 0;
              return bValue - aValue;
            });
          
          const bestExercise = sortedExercises[0];
          if (bestExercise && !recommendations.find(r => r.exerciseId === bestExercise.id)) {
            const setsText = laggingMuscle.sets === 0 ? '未训练' : `仅${laggingMuscle.sets.toFixed(0)}组`;
            recommendations.push({
              exerciseId: bestExercise.id,
              exerciseName: bestExercise.name,
              exerciseUnit: bestExercise.unit,
              reason: `${laggingMuscle.name}肌群${setsText}，建议加强`,
            });
            
            // 最多推荐3个基于肌群落后的运动
            if (recommendations.length >= 3) break;
          }
        }
      }
    }
    
    // 其次按距离上次锻炼天数推荐（排除"每周平均步数"）
    const byDaysSinceLastWorkout = exercisesProgress
      .filter(e => 
        e.exerciseName !== '每周平均步数' &&
        e.daysSinceLastWorkout !== null &&
        e.daysSinceLastWorkout > 7 && // 超过一周没练
        !recommendations.find(r => r.exerciseId === e.exerciseId)
      )
      .sort((a, b) => (b.daysSinceLastWorkout || 0) - (a.daysSinceLastWorkout || 0));
    
    for (const exercise of byDaysSinceLastWorkout) {
      if (recommendations.length >= 5) break;
      recommendations.push({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        exerciseUnit: exercise.exerciseUnit,
        reason: `已${exercise.daysSinceLastWorkout}天未训练`,
      });
    }
    
    // 如果还没有推荐，找出低于历史平均的运动
    if (recommendations.length === 0) {
      const belowAverage = exercisesProgress.filter(e => 
        e.differencePercentage !== null && 
        e.differencePercentage < -10 && 
        e.exerciseName !== '每周平均步数'
      );
      if (belowAverage.length > 0) {
        belowAverage.sort((a, b) => (a.differencePercentage || 0) - (b.differencePercentage || 0));
        recommendations.push({
          exerciseId: belowAverage[0].exerciseId,
          exerciseName: belowAverage[0].exerciseName,
          exerciseUnit: belowAverage[0].exerciseUnit,
          reason: `低于平均值${Math.abs(belowAverage[0].differencePercentage!).toFixed(0)}%，需加强`,
        });
      }
    }
    
    return {
      weekStart: weekDetails.weekStart,
      weekEnd: weekDetails.weekEnd,
      exercises: exercisesProgress,
      recommendations,
    };
  }

  async getDailyContributions() {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = this.getWeekEnd(weekStart);
    
    // MemStorage: 计算每日数据
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dailyData: Array<{
      date: string;
      dayOfWeek: number;
      dayName: string;
      baselineValue: number;
      percentage: number;
      entryCount: number;
    }> = [];
    
    let weekTotal = 0;
    const dailyTotals: { date: Date; baselineValue: number; entryCount: number }[] = [];
    
    // 先计算本周"每周平均步数"的总基准值，用于平均分配到每天
    let weeklyStepsBaselineTotal = 0;
    const weekEndTime = new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000);
    const allEntries = Array.from(this.workoutEntries.values());
    for (const entry of allEntries) {
      const entryDate = new Date(entry.date);
      if (entryDate >= weekStart && entryDate < weekEndTime) {
        const exercise = this.exercises.get(entry.exerciseId);
        if (exercise && exercise.name === '每周平均步数') {
          // 直接使用已保存的基准值
          weeklyStepsBaselineTotal += entry.baselineValue ?? (entry.value * (entry.sets || 1) * exercise.weightFactor);
        }
      }
    }
    const dailyStepsBaseline = weeklyStepsBaselineTotal / 7;
    
    // 遍历本周每一天
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      
      // 获取当天的所有记录
      const dayEntries = Array.from(this.workoutEntries.values()).filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= dayStart && entryDate <= dayEnd;
      });
      
      // 计算当天的基准值（排除"每周平均步数"，因为会平均分配）
      let dayBaselineValue = dailyStepsBaseline; // 从平均步数基准值开始
      for (const entry of dayEntries) {
        const exercise = this.exercises.get(entry.exerciseId);
        if (exercise && exercise.name !== '每周平均步数') {
          // 直接使用已保存的基准值
          dayBaselineValue += entry.baselineValue ?? (entry.value * (entry.sets || 1) * exercise.weightFactor);
        }
      }
      
      dailyTotals.push({
        date: dayStart,
        baselineValue: dayBaselineValue,
        entryCount: dayEntries.length,
      });
      
      weekTotal += dayBaselineValue;
    }
    
    // 计算百分比
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      const taipeiComponents = this.getTaipeiComponents(dayStart);
      const dayOfWeek = taipeiComponents.dayOfWeek;
      
      dailyData.push({
        date: dayStart.toISOString(),
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        baselineValue: dailyTotals[i].baselineValue,
        percentage: weekTotal > 0 ? (dailyTotals[i].baselineValue / weekTotal) * 100 : 0,
        entryCount: dailyTotals[i].entryCount,
      });
    }
    
    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      dailyData,
      weekTotal,
    };
  }

  async getEntriesByDate(dateStr: string) {
    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    // 计算本周每周平均步数的分配基准值
    const weekStart = this.getWeekStart(dayStart);
    const weekEnd = this.getWeekEnd(weekStart);
    const weekEndTime = new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000);
    
    let weeklyStepsBaselineTotal = 0;
    const allEntries = Array.from(this.workoutEntries.values());
    for (const entry of allEntries) {
      const entryDate = new Date(entry.date);
      if (entryDate >= weekStart && entryDate < weekEndTime) {
        const exercise = this.exercises.get(entry.exerciseId);
        if (exercise && exercise.name === '每周平均步数') {
          // 直接使用已保存的基准值
          weeklyStepsBaselineTotal += entry.baselineValue ?? (entry.value * (entry.sets || 1) * exercise.weightFactor);
        }
      }
    }
    const dailyStepsBaseline = weeklyStepsBaselineTotal / 7;
    
    const entries = allEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= dayStart && entryDate < dayEnd;
    });
    
    const result: Array<{
      id: string;
      exerciseName: string;
      exerciseUnit: string;
      exerciseCategory: string | null;
      value: number;
      sets: number | null;
      baselineValue: number;
      weightFactor: number;
    }> = [];
    
    let totalBaselineValue = 0;
    
    for (const entry of entries) {
      const exercise = this.exercises.get(entry.exerciseId);
      if (!exercise) continue;
      
      // 直接使用已保存的基准值
      const baselineValue = entry.baselineValue ?? (entry.value * (entry.sets || 1) * exercise.weightFactor);
      totalBaselineValue += baselineValue;
      
      result.push({
        id: entry.id,
        exerciseName: exercise.name,
        exerciseUnit: exercise.unit,
        exerciseCategory: exercise.category,
        value: entry.value,
        sets: entry.sets,
        baselineValue,
        weightFactor: exercise.weightFactor,
      });
    }
    
    return {
      date: dateStr,
      entries: result,
      totalBaselineValue,
      dailyStepsBaseline,
    };
  }

  async getWeekDetails(weekStartStr: string) {
    const weekStart = new Date(weekStartStr);
    const weekEnd = this.getWeekEnd(weekStart);

    const entries = Array.from(this.workoutEntries.values())
      .filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= weekStart && entryDate <= weekEnd;
      });

    const exerciseStats = new Map<string, {
      exerciseId: string;
      exerciseName: string;
      exerciseUnit: string;
      exerciseCategory: string | null;
      weightFactor: number;
      count: number;
      totalValue: number;
      baselineValue: number;
    }>();

    for (const entry of entries) {
      const exercise = this.exercises.get(entry.exerciseId);
      if (!exercise) continue;

      // 直接使用已保存的基准值
      const entryBaselineValue = entry.baselineValue ?? (entry.value * (entry.sets || 1) * exercise.weightFactor);
      const entryTotalValue = entry.value * (entry.sets || 1);
      
      const existing = exerciseStats.get(entry.exerciseId);
      if (existing) {
        existing.count++;
        existing.totalValue += entryTotalValue;
        existing.baselineValue += entryBaselineValue;
      } else {
        exerciseStats.set(entry.exerciseId, {
          exerciseId: entry.exerciseId,
          exerciseName: exercise.name,
          exerciseUnit: exercise.unit,
          exerciseCategory: exercise.category,
          weightFactor: exercise.weightFactor,
          count: 1,
          totalValue: entryTotalValue,
          baselineValue: entryBaselineValue,
        });
      }
    }

    const detailsWithAverage = [];
    for (const stat of Array.from(exerciseStats.values())) {
      const weeklyAverage = await this.getExerciseWeeklyAverage(stat.exerciseId);
      
      let difference = null;
      let differencePercentage = null;
      
      if (weeklyAverage !== null && weeklyAverage > 0) {
        difference = stat.totalValue - weeklyAverage;
        differencePercentage = (difference / weeklyAverage) * 100;
      }

      detailsWithAverage.push({
        ...stat,
        weeklyAverage,
        difference,
        differencePercentage,
      });
    }

    const details = detailsWithAverage.sort((a, b) => b.baselineValue - a.baselineValue);
    const totalBaselineValue = details.reduce((sum, d) => sum + d.baselineValue, 0);
    const year = this.getISOYear(weekStart);
    const weekNumber = this.getWeekNumber(weekStart);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      year,
      weekNumber,
      totalBaselineValue,
      entryCount: entries.length,
      details,
    };
  }

  // 辅助方法：获取周一（基于UTC+8时区）
  private getWeekStart(date: Date): Date {
    // 获取台北时区的日期组件
    const taipei = this.getTaipeiComponents(date);
    const diff = taipei.dayOfWeek === 0 ? -6 : 1 - taipei.dayOfWeek; // 周日是0，需要-6天；其他日子到周一
    
    // 直接从台北时区的date计算周一的毫秒时间戳
    // 方法：在当前日期基础上加/减天数得到周一，然后设为00:00:00
    const taipeiMondayTimestamp = date.getTime() + this.TAIPEI_OFFSET + diff * 24 * 60 * 60 * 1000;
    const taipeiMonday = new Date(taipeiMondayTimestamp);
    
    // 获取周一在台北时区的年月日
    const mondayYear = taipeiMonday.getUTCFullYear();
    const mondayMonth = taipeiMonday.getUTCMonth();
    const mondayDay = taipeiMonday.getUTCDate();
    
    // 返回周一00:00:00（台北时间）对应的UTC时间
    return this.createUTCFromTaipei(mondayYear, mondayMonth, mondayDay, 0, 0, 0, 0);
  }

  // 辅助方法：获取周日（基于UTC+8时区）
  private getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(date);
    
    // 周日是周一+6天
    const taipeiSundayTimestamp = weekStart.getTime() + this.TAIPEI_OFFSET + 6 * 24 * 60 * 60 * 1000;
    const taipeiSunday = new Date(taipeiSundayTimestamp);
    
    // 获取周日在台北时区的年月日
    const sundayYear = taipeiSunday.getUTCFullYear();
    const sundayMonth = taipeiSunday.getUTCMonth();
    const sundayDay = taipeiSunday.getUTCDate();
    
    // 返回周日23:59:59.999（台北时间）对应的UTC时间
    return this.createUTCFromTaipei(sundayYear, sundayMonth, sundayDay, 23, 59, 59, 999);
  }

  // 辅助方法：计算ISO周数（基于UTC+8时区）
  private getWeekNumber(date: Date): number {
    const taipei = this.getTaipeiComponents(date);
    // ISO周数计算：找到包含当年第一个周四的那一周
    const tempDate = new Date(Date.UTC(taipei.year, taipei.month, taipei.day));
    tempDate.setUTCDate(tempDate.getUTCDate() + 3 - (tempDate.getUTCDay() + 6) % 7);
    const week1 = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getUTCDay() + 6) % 7) / 7);
  }

  // 辅助方法：计算ISO年份（基于UTC+8时区）
  private getISOYear(date: Date): number {
    const taipei = this.getTaipeiComponents(date);
    const tempDate = new Date(Date.UTC(taipei.year, taipei.month, taipei.day));
    // 调整到周四（周一+3天）
    tempDate.setUTCDate(tempDate.getUTCDate() + 3 - (tempDate.getUTCDay() + 6) % 7);
    return tempDate.getUTCFullYear();
  }

  async getCareerOverview() {
    const allWeeklyStats = await this.getAllWeeklyStats();
    
    if (allWeeklyStats.length === 0) {
      return { weeks: [], totalStars: 0, averageStars: 0 };
    }

    // 计算各项平均值
    const avgTotal = allWeeklyStats.reduce((sum, w) => sum + w.totalBaselineValue, 0) / allWeeklyStats.length;
    const avgStrength = allWeeklyStats.reduce((sum, w) => sum + w.strengthValue, 0) / allWeeklyStats.length;
    const avgCardio = allWeeklyStats.reduce((sum, w) => sum + w.cardioValue, 0) / allWeeklyStats.length;
    const avgActivity = allWeeklyStats.reduce((sum, w) => sum + w.activityValue, 0) / allWeeklyStats.length;

    // 按总分排序计算百分比
    const sortedByTotal = [...allWeeklyStats].sort((a, b) => b.totalBaselineValue - a.totalBaselineValue);

    const weeks = allWeeklyStats.map((week) => {
      const weekStart = new Date(week.weekStart);
      const year = this.getISOYear(weekStart);
      const weekNumber = this.getWeekNumber(weekStart);

      // 计算百分位排名
      const rank = sortedByTotal.findIndex(w => w.weekStart === week.weekStart && w.weekEnd === week.weekEnd) + 1;
      const percentile = (rank / allWeeklyStats.length) * 100;

      // 计算星星数量（5个里程碑）
      let stars = 0;
      const inTop70 = percentile <= 70;
      const inTop10 = percentile <= 10;
      const totalAbove = week.totalBaselineValue >= avgTotal;
      const strengthAbove = week.strengthValue >= avgStrength && avgStrength > 0;
      const cardioAbove = week.cardioValue >= avgCardio && avgCardio > 0;
      const activityAbove = week.activityValue >= avgActivity && avgActivity > 0;
      const threeAbove = strengthAbove && cardioAbove && activityAbove;

      if (inTop70) stars++;
      if (totalAbove) stars++;
      if (threeAbove) stars++;
      // 全项超越需要查看每个运动的表现，简化为三项达标+总分达标
      if (threeAbove && totalAbove) stars++;
      if (inTop10) stars++;

      return {
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        year,
        weekNumber,
        totalScore: week.totalBaselineValue,
        strengthScore: week.strengthValue,
        cardioScore: week.cardioValue,
        activityScore: week.activityValue,
        stars,
        percentile,
      };
    });

    // 按时间倒序排列（最新的在前）
    weeks.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());

    const totalStars = weeks.reduce((sum, w) => sum + w.stars, 0);
    const averageStars = weeks.length > 0 ? totalStars / weeks.length : 0;

    return { weeks, totalStars, averageStars };
  }

  async getMuscleGroupWeeklyStats() {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = this.getWeekEnd(now);

    const entries = Array.from(this.workoutEntries.values())
      .filter(entry => entry.date >= weekStart && entry.date <= weekEnd);

    const muscleGroupMap = new Map<string, { totalSets: number; totalVolume: number }>();
    const muscleFields = [
      { field: 'muscleChest', name: '胸' },
      { field: 'muscleBack', name: '背' },
      { field: 'muscleLegs', name: '腿' },
      { field: 'muscleShoulders', name: '肩' },
      { field: 'muscleArms', name: '二头肌' },
      { field: 'muscleCore', name: '核心' },
      { field: 'muscleGlutes', name: '臀' },
      { field: 'muscleFullBody', name: '三头肌' },
    ] as const;

    for (const entry of entries) {
      const exercise = this.exercises.get(entry.exerciseId);
      if (!exercise) continue;

      // 直接使用已保存的基准值
      const baseSets = entry.sets || 1;
      const baseVolume = entry.baselineValue ?? (entry.value * baseSets * exercise.weightFactor);

      for (const { field, name } of muscleFields) {
        const percentage = (exercise[field] as number) || 0;
        if (percentage <= 0) continue;

        const existing = muscleGroupMap.get(name) || { totalSets: 0, totalVolume: 0 };
        existing.totalSets += baseSets * (percentage / 100);
        existing.totalVolume += baseVolume * (percentage / 100);
        muscleGroupMap.set(name, existing);
      }
    }

    const muscleGroups = Array.from(muscleGroupMap.entries())
      .map(([muscleGroup, stats]) => ({
        muscleGroup,
        totalSets: Math.round(stats.totalSets * 10) / 10,
        totalVolume: stats.totalVolume,
      }))
      .filter(g => g.totalVolume > 0)
      .sort((a, b) => b.totalVolume - a.totalVolume);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      muscleGroups,
    };
  }

  // 获取台北时区的日期字符串 (YYYY-MM-DD)
  private formatTaipeiDate(date: Date): string {
    const taipei = this.getTaipeiComponents(date);
    const year = taipei.year;
    const month = String(taipei.month + 1).padStart(2, '0');
    const day = String(taipei.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async updateWeeklyMuscleStats(weekStartStr: string): Promise<void> {
    const weekStart = new Date(weekStartStr);
    const weekEnd = this.getWeekEnd(weekStart);
    const weekEndTime = new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000);

    let chestValue = 0, backValue = 0, legsValue = 0, shouldersValue = 0;
    let armsValue = 0, coreValue = 0, glutesValue = 0, fullBodyValue = 0;

    const allEntries = Array.from(this.workoutEntries.values());
    for (const entry of allEntries) {
      const entryDate = new Date(entry.date);
      if (entryDate >= weekStart && entryDate < weekEndTime) {
        const exercise = this.exercises.get(entry.exerciseId);
        if (!exercise) continue;

        const baseVolume = entry.baselineValue ?? (entry.value * (entry.sets || 1) * exercise.weightFactor);

        chestValue += baseVolume * ((exercise.muscleChest || 0) / 100);
        backValue += baseVolume * ((exercise.muscleBack || 0) / 100);
        legsValue += baseVolume * ((exercise.muscleLegs || 0) / 100);
        shouldersValue += baseVolume * ((exercise.muscleShoulders || 0) / 100);
        armsValue += baseVolume * ((exercise.muscleArms || 0) / 100);
        coreValue += baseVolume * ((exercise.muscleCore || 0) / 100);
        glutesValue += baseVolume * ((exercise.muscleGlutes || 0) / 100);
        fullBodyValue += baseVolume * ((exercise.muscleFullBody || 0) / 100);
      }
    }

    const weekStartFormatted = this.formatTaipeiDate(weekStart);
    this.weeklyMuscleStatsStore.set(weekStartFormatted, {
      weekStart: weekStartFormatted,
      chestValue,
      backValue,
      legsValue,
      shouldersValue,
      armsValue,
      coreValue,
      glutesValue,
      fullBodyValue,
      updatedAt: new Date(),
    });
  }

  async getWeeklyMuscleStatsHistory(): Promise<Array<{
    weekStart: string;
    chestValue: number;
    backValue: number;
    legsValue: number;
    shouldersValue: number;
    armsValue: number;
    coreValue: number;
    glutesValue: number;
    fullBodyValue: number;
    updatedAt: Date;
  }>> {
    const records = Array.from(this.weeklyMuscleStatsStore.values());
    return records.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  async getMuscleGroupAverages(): Promise<{
    chestAvg: number;
    backAvg: number;
    legsAvg: number;
    shouldersAvg: number;
    armsAvg: number;
    coreAvg: number;
    glutesAvg: number;
    fullBodyAvg: number;
    weekCount: number;
  }> {
    const records = Array.from(this.weeklyMuscleStatsStore.values());
    if (records.length === 0) {
      return {
        chestAvg: 0,
        backAvg: 0,
        legsAvg: 0,
        shouldersAvg: 0,
        armsAvg: 0,
        coreAvg: 0,
        glutesAvg: 0,
        fullBodyAvg: 0,
        weekCount: 0,
      };
    }

    const totals = records.reduce((acc, r) => {
      acc.chest += r.chestValue;
      acc.back += r.backValue;
      acc.legs += r.legsValue;
      acc.shoulders += r.shouldersValue;
      acc.arms += r.armsValue;
      acc.core += r.coreValue;
      acc.glutes += r.glutesValue;
      acc.fullBody += r.fullBodyValue;
      return acc;
    }, { chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0, glutes: 0, fullBody: 0 });

    const count = records.length;
    return {
      chestAvg: totals.chest / count,
      backAvg: totals.back / count,
      legsAvg: totals.legs / count,
      shouldersAvg: totals.shoulders / count,
      armsAvg: totals.arms / count,
      coreAvg: totals.core / count,
      glutesAvg: totals.glutes / count,
      fullBodyAvg: totals.fullBody / count,
      weekCount: count,
    };
  }

  async migrateHistoricalMuscleStats(): Promise<{ migratedWeeks: number }> {
    const allEntries = Array.from(this.workoutEntries.values());

    const weekStartsSet = new Set<string>();
    for (const entry of allEntries) {
      const weekStart = this.getWeekStart(entry.date);
      weekStartsSet.add(this.formatTaipeiDate(weekStart));
    }

    const weekStarts = Array.from(weekStartsSet);
    for (const weekStartStr of weekStarts) {
      await this.updateWeeklyMuscleStats(weekStartStr);
    }

    return { migratedWeeks: weekStarts.length };
  }

  async recalculateAllBaselines(): Promise<{ updatedEntries: number; updatedWeeks: number; updatedExercises: number }> {
    let updatedEntries = 0;
    const weekStartsSet = new Set<string>();

    for (const [id, entry] of this.workoutEntries) {
      const exercise = this.exercises.get(entry.exerciseId);
      if (!exercise) continue;
      const newBaseline = calculateBaseline(
        entry.value, entry.sets ?? 1, entry.weightFactor ?? exercise.weightFactor,
        exercise.category, exercise.movementCoefficient ?? 1, exercise.intensityFactor ?? 1, exercise.name
      );
      entry.baselineValue = newBaseline;
      this.workoutEntries.set(id, entry);
      updatedEntries++;
      const weekStart = this.getWeekStart(entry.date);
      weekStartsSet.add(this.formatTaipeiDate(weekStart));
    }

    for (const ws of weekStartsSet) {
      await this.updateWeeklyMuscleStats(ws);
    }

    return { updatedEntries, updatedWeeks: weekStartsSet.size, updatedExercises: 0 };
  }

  private userSettingsMap: Map<string, string> = new Map();

  async getUserSetting(key: string): Promise<string | null> {
    return this.userSettingsMap.get(key) ?? null;
  }

  async setUserSetting(key: string, value: string): Promise<void> {
    this.userSettingsMap.set(key, value);
  }

  async getAllUserSettings(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const [k, v] of this.userSettingsMap) {
      result[k] = v;
    }
    return result;
  }
}

export class DbStorage implements IStorage {
  private db;
  
  // UTC+8时区偏移（毫秒）
  private readonly TAIPEI_OFFSET = 8 * 60 * 60 * 1000;

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this.db = drizzle(pool);
  }
  
  // 辅助方法：获取台北时区的年月日时分秒
  private getTaipeiComponents(utcDate: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    ms: number;
    dayOfWeek: number;
  } {
    // 将UTC时间戳加8小时得到台北时间戳
    const taipeiTimestamp = utcDate.getTime() + this.TAIPEI_OFFSET;
    const taipeiDate = new Date(taipeiTimestamp);
    
    return {
      year: taipeiDate.getUTCFullYear(),
      month: taipeiDate.getUTCMonth(),
      day: taipeiDate.getUTCDate(),
      hour: taipeiDate.getUTCHours(),
      minute: taipeiDate.getUTCMinutes(),
      second: taipeiDate.getUTCSeconds(),
      ms: taipeiDate.getUTCMilliseconds(),
      dayOfWeek: taipeiDate.getUTCDay(), // 0=周日, 1=周一...
    };
  }

  // 辅助方法：从台北时区组件创建UTC Date
  private createUTCFromTaipei(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): Date {
    // 创建台北时间的UTC表示
    const taipeiDate = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
    // 减去8小时偏移得到真正的UTC时间
    return new Date(taipeiDate.getTime() - this.TAIPEI_OFFSET);
  }

  // 获取台北时区的日期字符串 (YYYY-MM-DD)
  private formatTaipeiDate(date: Date): string {
    const taipei = this.getTaipeiComponents(date);
    const year = taipei.year;
    const month = String(taipei.month + 1).padStart(2, '0');
    const day = String(taipei.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 运动类型方法
  async getExercises(): Promise<Exercise[]> {
    return await this.db.select().from(exercises);
  }

  async getExercise(id: string): Promise<Exercise | undefined> {
    const result = await this.db.select().from(exercises).where(eq(exercises.id, id));
    return result[0];
  }

  async createExercise(insertExercise: InsertExercise): Promise<Exercise> {
    const result = await this.db.insert(exercises).values({
      name: insertExercise.name,
      unit: insertExercise.unit,
      weightFactor: insertExercise.weightFactor,
      category: insertExercise.category ?? null,
      splitCategory: insertExercise.splitCategory ?? null,
      splitRatio: insertExercise.splitRatio ?? 0,
    }).returning();
    return result[0];
  }

  async updateExercise(id: string, insertExercise: InsertExercise): Promise<Exercise | undefined> {
    const result = await this.db
      .update(exercises)
      .set({
        name: insertExercise.name,
        unit: insertExercise.unit,
        weightFactor: insertExercise.weightFactor,
        category: insertExercise.category ?? null,
        splitCategory: insertExercise.splitCategory ?? null,
        splitRatio: insertExercise.splitRatio ?? 0,
        muscleChest: insertExercise.muscleChest ?? 0,
        muscleBack: insertExercise.muscleBack ?? 0,
        muscleLegs: insertExercise.muscleLegs ?? 0,
        muscleShoulders: insertExercise.muscleShoulders ?? 0,
        muscleArms: insertExercise.muscleArms ?? 0,
        muscleCore: insertExercise.muscleCore ?? 0,
        muscleGlutes: insertExercise.muscleGlutes ?? 0,
        muscleFullBody: insertExercise.muscleFullBody ?? 0,
      })
      .where(eq(exercises.id, id))
      .returning();
    return result[0];
  }

  async deleteExercise(id: string): Promise<boolean> {
    const result = await this.db.delete(exercises).where(eq(exercises.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // 运动记录方法
  async getWorkoutEntries(): Promise<WorkoutEntryWithExercise[]> {
    const result = await this.db
      .select({
        id: workoutEntries.id,
        exerciseId: workoutEntries.exerciseId,
        value: workoutEntries.value,
        sets: workoutEntries.sets,
        weightFactor: workoutEntries.weightFactor,
        baselineValue: workoutEntries.baselineValue,
        date: workoutEntries.date,
        notes: workoutEntries.notes,
        exercise: exercises,
      })
      .from(workoutEntries)
      .leftJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
      .orderBy(desc(workoutEntries.date));

    return result.filter(r => r.exercise !== null) as WorkoutEntryWithExercise[];
  }

  async getWorkoutEntry(id: string): Promise<WorkoutEntryWithExercise | undefined> {
    const result = await this.db
      .select({
        id: workoutEntries.id,
        exerciseId: workoutEntries.exerciseId,
        value: workoutEntries.value,
        sets: workoutEntries.sets,
        weightFactor: workoutEntries.weightFactor,
        baselineValue: workoutEntries.baselineValue,
        date: workoutEntries.date,
        notes: workoutEntries.notes,
        exercise: exercises,
      })
      .from(workoutEntries)
      .leftJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
      .where(eq(workoutEntries.id, id));

    if (result.length === 0 || !result[0].exercise) return undefined;
    return result[0] as WorkoutEntryWithExercise;
  }

  async createWorkoutEntry(insertEntry: InsertWorkoutEntry): Promise<WorkoutEntry> {
    const date = insertEntry.date ? new Date(insertEntry.date) : new Date();
    
    const exerciseResult = await this.db
      .select({
        weightFactor: exercises.weightFactor,
        category: exercises.category,
        movementCoefficient: exercises.movementCoefficient,
        intensityFactor: exercises.intensityFactor,
        name: exercises.name,
      })
      .from(exercises)
      .where(eq(exercises.id, insertEntry.exerciseId));
    const ex = exerciseResult[0];
    const weightFactor = insertEntry.weightFactor ?? ex?.weightFactor ?? 1;
    const sets = insertEntry.sets ?? 1;
    const baselineValue = calculateBaseline(
      insertEntry.value, sets, weightFactor,
      ex?.category ?? null,
      ex?.movementCoefficient ?? 1,
      ex?.intensityFactor ?? 1,
      ex?.name ?? ''
    );
    
    const result = await this.db
      .insert(workoutEntries)
      .values({
        exerciseId: insertEntry.exerciseId,
        value: insertEntry.value,
        sets: insertEntry.sets ?? null,
        weightFactor,
        baselineValue,
        date,
        notes: insertEntry.notes ?? null,
      })
      .returning();

    // 更新该周的肌群统计
    const weekStart = this.getWeekStart(date);
    await this.updateWeeklyMuscleStats(this.formatTaipeiDate(weekStart));

    return result[0];
  }

  async updateWorkoutEntry(id: string, insertEntry: InsertWorkoutEntry): Promise<WorkoutEntry | undefined> {
    // 先获取原记录以确定原来的日期（用于更新旧周的统计）
    const oldEntry = await this.db
      .select({ date: workoutEntries.date })
      .from(workoutEntries)
      .where(eq(workoutEntries.id, id));
    const oldDate = oldEntry[0]?.date;
    
    const date = insertEntry.date ? new Date(insertEntry.date) : undefined;
    
    const exerciseResult = await this.db
      .select({
        weightFactor: exercises.weightFactor,
        category: exercises.category,
        movementCoefficient: exercises.movementCoefficient,
        intensityFactor: exercises.intensityFactor,
        name: exercises.name,
      })
      .from(exercises)
      .where(eq(exercises.id, insertEntry.exerciseId));
    const ex = exerciseResult[0];
    const weightFactor = insertEntry.weightFactor ?? ex?.weightFactor ?? 1;
    const sets = insertEntry.sets ?? 1;
    const baselineValue = calculateBaseline(
      insertEntry.value, sets, weightFactor,
      ex?.category ?? null,
      ex?.movementCoefficient ?? 1,
      ex?.intensityFactor ?? 1,
      ex?.name ?? ''
    );
    
    const result = await this.db
      .update(workoutEntries)
      .set({
        exerciseId: insertEntry.exerciseId,
        value: insertEntry.value,
        sets: insertEntry.sets ?? null,
        weightFactor,
        baselineValue,
        ...(date && { date }),
        notes: insertEntry.notes ?? null,
      })
      .where(eq(workoutEntries.id, id))
      .returning();

    if (result.length > 0) {
      // 更新新日期所在周的肌群统计
      const newDate = date || oldDate;
      if (newDate) {
        const newWeekStart = this.getWeekStart(newDate);
        await this.updateWeeklyMuscleStats(this.formatTaipeiDate(newWeekStart));
      }
      // 如果日期跨周了，还需要更新旧周的统计
      if (oldDate && date) {
        const oldWeekStart = this.getWeekStart(oldDate);
        const newWeekStart = this.getWeekStart(date);
        if (oldWeekStart.getTime() !== newWeekStart.getTime()) {
          await this.updateWeeklyMuscleStats(this.formatTaipeiDate(oldWeekStart));
        }
      }
    }

    return result.length > 0 ? result[0] : undefined;
  }

  async deleteWorkoutEntry(id: string): Promise<boolean> {
    // 先获取记录日期以便后续更新肌群统计
    const entry = await this.db
      .select({ date: workoutEntries.date })
      .from(workoutEntries)
      .where(eq(workoutEntries.id, id));
    const entryDate = entry[0]?.date;
    
    const result = await this.db.delete(workoutEntries).where(eq(workoutEntries.id, id));
    const deleted = result.rowCount ? result.rowCount > 0 : false;
    
    // 更新该周的肌群统计
    if (deleted && entryDate) {
      const weekStart = this.getWeekStart(entryDate);
      await this.updateWeeklyMuscleStats(this.formatTaipeiDate(weekStart));
    }
    
    return deleted;
  }

  // 统计和分析方法
  async getWeeklyStats(weekStart: Date, weekEnd: Date): Promise<WeeklyStats> {
    const entries = await this.db
      .select({
        id: workoutEntries.id,
        exerciseId: workoutEntries.exerciseId,
        value: workoutEntries.value,
        sets: workoutEntries.sets,
        baselineValue: workoutEntries.baselineValue,
        date: workoutEntries.date,
        notes: workoutEntries.notes,
        exercise: exercises,
      })
      .from(workoutEntries)
      .leftJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
      .where(
        and(
          gte(workoutEntries.date, weekStart),
          lte(workoutEntries.date, weekEnd)
        )
      );

    let strengthValue = 0;
    let cardioValue = 0;
    let activityValue = 0;
    let entryCount = 0;

    for (const entry of entries) {
      if (entry.exercise) {
        const baseline = entry.baselineValue ?? 0;
        entryCount++;

        const hasSplit = entry.exercise.splitCategory && entry.exercise.splitRatio && entry.exercise.splitRatio > 0;
        const primaryRatio = hasSplit ? 1 - (entry.exercise.splitRatio || 0) : 1;
        const secondaryRatio = hasSplit ? (entry.exercise.splitRatio || 0) : 0;

        if (entry.exercise.category === '力量') {
          strengthValue += baseline * primaryRatio;
        } else if (entry.exercise.category === '有氧') {
          cardioValue += baseline * primaryRatio;
        } else if (entry.exercise.category === '活动量') {
          activityValue += baseline * primaryRatio;
        }

        if (hasSplit) {
          if (entry.exercise.splitCategory === '力量') {
            strengthValue += baseline * secondaryRatio;
          } else if (entry.exercise.splitCategory === '有氧') {
            cardioValue += baseline * secondaryRatio;
          } else if (entry.exercise.splitCategory === '活动量') {
            activityValue += baseline * secondaryRatio;
          }
        }
      }
    }

    const settings = await this.getAllUserSettings();
    const strengthWeight = parseFloat(settings['strengthWeight'] ?? '50') / 100;
    const cardioWeight = parseFloat(settings['cardioWeight'] ?? '30') / 100;
    const activityWeight = parseFloat(settings['activityWeight'] ?? '20') / 100;
    const totalBaselineValue = strengthValue * strengthWeight + cardioValue * cardioWeight + activityValue * activityWeight;

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalBaselineValue,
      entryCount,
      strengthValue,
      cardioValue,
      activityValue,
    };
  }

  async getAllWeeklyStats(): Promise<WeeklyStats[]> {
    const allEntries = await this.db.select().from(workoutEntries);
    if (allEntries.length === 0) return [];

    // 找到最早和最晚的记录
    const dates = allEntries.map(e => new Date(e.date).getTime());
    const earliestDate = new Date(Math.min(...dates));
    const latestDate = new Date(Math.max(...dates));

    // 获取最早记录所在周的周一
    const firstWeekStart = this.getWeekStart(earliestDate);
    
    // 获取最晚记录所在周的周日
    const lastWeekEnd = this.getWeekEnd(latestDate);

    // 生成所有周的统计
    const weeklyStats: WeeklyStats[] = [];
    let currentWeekStart = new Date(firstWeekStart);

    while (currentWeekStart <= lastWeekEnd) {
      const currentWeekEnd = this.getWeekEnd(currentWeekStart);
      const stats = await this.getWeeklyStats(currentWeekStart, currentWeekEnd);
      weeklyStats.push(stats);

      // 移动到下一周
      currentWeekStart = new Date(currentWeekStart);
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return weeklyStats;
  }

  async getCurrentWeekDetails() {
    const rankingData = await this.getRankingData();
    const weekStart = new Date(rankingData.currentWeek.weekStart);
    const weekEnd = new Date(rankingData.currentWeek.weekEnd);

    const result = await this.db
      .select({
        exerciseId: exercises.id,
        exerciseName: exercises.name,
        exerciseUnit: exercises.unit,
        exerciseCategory: exercises.category,
        weightFactor: exercises.weightFactor,
        intensityFactor: exercises.intensityFactor,
        count: sql<number>`cast(count(${workoutEntries.id}) as int)`,
        totalValue: sql<number>`cast(sum(${workoutEntries.value} * coalesce(${workoutEntries.sets}, 1)) as float)`,
        baselineValue: sql<number>`cast(sum(coalesce(${workoutEntries.baselineValue}, ${workoutEntries.value} * coalesce(${workoutEntries.sets}, 1) * ${exercises.weightFactor})) as float)`,
      })
      .from(workoutEntries)
      .innerJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
      .where(
        and(
          gte(workoutEntries.date, weekStart),
          lte(workoutEntries.date, weekEnd)
        )
      )
      .groupBy(exercises.id, exercises.name, exercises.unit, exercises.category, exercises.weightFactor, exercises.intensityFactor);

    const details = result
      .map(r => ({ ...r, intensityFactor: r.intensityFactor ?? 1 }))
      .sort((a, b) => b.baselineValue - a.baselineValue);

    const totalBaselineValue = details.reduce((sum, d) => sum + d.baselineValue, 0);

    const entryCountResult = await this.db
      .select({
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(workoutEntries)
      .where(
        and(
          gte(workoutEntries.date, weekStart),
          lte(workoutEntries.date, weekEnd)
        )
      );

    const entryCount = entryCountResult[0]?.count || 0;

    const weeklyStats = await this.getWeeklyStats(weekStart, weekEnd);
    const settings = await this.getAllUserSettings();
    const strengthWeightPct = parseFloat(settings['strengthWeight'] ?? '50');
    const cardioWeightPct = parseFloat(settings['cardioWeight'] ?? '30');
    const activityWeightPct = parseFloat(settings['activityWeight'] ?? '20');

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalBaselineValue,
      weightedTotal: weeklyStats.totalBaselineValue,
      strengthValue: weeklyStats.strengthValue,
      cardioValue: weeklyStats.cardioValue,
      activityValue: weeklyStats.activityValue,
      strengthWeight: strengthWeightPct,
      cardioWeight: cardioWeightPct,
      activityWeight: activityWeightPct,
      entryCount,
      details,
    };
  }

  async getRankingData(): Promise<RankingData> {
    const allWeeklyStats = await this.getAllWeeklyStats();
    
    if (allWeeklyStats.length === 0) {
      const now = new Date();
      const weekStart = this.getWeekStart(now);
      const weekEnd = this.getWeekEnd(now);
      
      return {
        currentWeek: {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          totalBaselineValue: 0,
          entryCount: 0,
          strengthValue: 0,
          cardioValue: 0,
          activityValue: 0,
        },
        bestWeek: null,
        worstWeek: null,
        averageWeeklyValue: 0,
        averageStrengthValue: 0,
        averageCardioValue: 0,
        averageActivityValue: 0,
        rank: 0,
        totalWeeks: 0,
        strengthRank: 0,
        cardioRank: 0,
        activityRank: 0,
        topWeekTotalValue: 0,
        topWeekStrengthValue: 0,
        topWeekCardioValue: 0,
        topWeekActivityValue: 0,
      };
    }

    // 当前周（最后一周）
    const currentWeek = allWeeklyStats[allWeeklyStats.length - 1];

    // 找出最佳周、最差周
    let bestWeek = allWeeklyStats[0];
    let worstWeek = allWeeklyStats[0];

    for (const week of allWeeklyStats) {
      if (week.totalBaselineValue > bestWeek.totalBaselineValue) {
        bestWeek = week;
      }
      if (week.totalBaselineValue < worstWeek.totalBaselineValue) {
        worstWeek = week;
      }
    }

    // 计算各指标平均值
    const totalValue = allWeeklyStats.reduce((sum, week) => sum + week.totalBaselineValue, 0);
    const averageWeeklyValue = totalValue / allWeeklyStats.length;
    
    const totalStrength = allWeeklyStats.reduce((sum, week) => sum + week.strengthValue, 0);
    const averageStrengthValue = totalStrength / allWeeklyStats.length;
    
    const totalCardio = allWeeklyStats.reduce((sum, week) => sum + week.cardioValue, 0);
    const averageCardioValue = totalCardio / allWeeklyStats.length;
    
    const totalActivity = allWeeklyStats.reduce((sum, week) => sum + week.activityValue, 0);
    const averageActivityValue = totalActivity / allWeeklyStats.length;

    // 计算总排名（降序，值越大排名越高）
    const sorted = [...allWeeklyStats].sort((a, b) => b.totalBaselineValue - a.totalBaselineValue);
    const rank = sorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    ) + 1;

    // 计算分类排名
    const strengthSorted = [...allWeeklyStats].sort((a, b) => b.strengthValue - a.strengthValue);
    const strengthRank = strengthSorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    ) + 1;

    const cardioSorted = [...allWeeklyStats].sort((a, b) => b.cardioValue - a.cardioValue);
    const cardioRank = cardioSorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    ) + 1;

    const activitySorted = [...allWeeklyStats].sort((a, b) => b.activityValue - a.activityValue);
    const activityRank = activitySorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    ) + 1;

    // 获取各分类第一名的数值
    const topWeekTotalValue = sorted[0].totalBaselineValue;
    const topWeekStrengthValue = strengthSorted[0].strengthValue;
    const topWeekCardioValue = cardioSorted[0].cardioValue;
    const topWeekActivityValue = activitySorted[0].activityValue;

    return {
      currentWeek,
      bestWeek,
      worstWeek,
      averageWeeklyValue,
      averageStrengthValue,
      averageCardioValue,
      averageActivityValue,
      rank,
      totalWeeks: allWeeklyStats.length,
      strengthRank,
      cardioRank,
      activityRank,
      topWeekTotalValue,
      topWeekStrengthValue,
      topWeekCardioValue,
      topWeekActivityValue,
    };
  }

  async getRankingDetail(metric: 'total' | 'strength' | 'cardio' | 'activity'): Promise<RankingDetailResponse> {
    const allWeeklyStats = await this.getAllWeeklyStats();
    
    if (allWeeklyStats.length === 0) {
      const now = new Date();
      const weekStart = this.getWeekStart(now);
      const weekEnd = this.getWeekEnd(now);
      const thursday = new Date(weekStart);
      thursday.setDate(thursday.getDate() + 3);
      const year = this.getISOYear(thursday);
      const weekNumber = this.getWeekNumber(weekStart);
      
      return {
        metric,
        current: {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          year,
          weekNumber,
          rank: 0,
          value: 0,
        },
        surrounding: [],
        careerAverage: 0,
      };
    }

    // 根据metric选择要排序的字段
    const getValue = (week: WeeklyStats) => {
      switch (metric) {
        case 'total': return week.totalBaselineValue;
        case 'strength': return week.strengthValue;
        case 'cardio': return week.cardioValue;
        case 'activity': return week.activityValue;
      }
    };

    // 计算生涯平均值（基于所有历史周数据）
    const totalValue = allWeeklyStats.reduce((sum, week) => sum + getValue(week), 0);
    const careerAverage = totalValue / allWeeklyStats.length;

    // 按指定metric降序排序
    const sorted = [...allWeeklyStats].sort((a, b) => getValue(b) - getValue(a));
    
    // 当前周（最后一周）
    const currentWeek = allWeeklyStats[allWeeklyStats.length - 1];
    
    // 找到当前周在排序后的索引
    const currentIndex = sorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    );
    
    // 计算当前周的排名
    const currentRank = currentIndex + 1;
    
    // 获取当前周的ISO周信息
    const currentWeekStart = new Date(currentWeek.weekStart);
    const currentThursday = new Date(currentWeekStart);
    currentThursday.setDate(currentThursday.getDate() + 3);
    const currentYear = this.getISOYear(currentThursday);
    const currentWeekNumber = this.getWeekNumber(currentWeekStart);
    
    // 计算要显示的范围：前2名到后2名
    const startIdx = Math.max(0, currentIndex - 2);
    const endIdx = Math.min(sorted.length, currentIndex + 3);
    const surroundingWeeks = sorted.slice(startIdx, endIdx);
    
    // 构建结果
    const current = {
      weekStart: currentWeek.weekStart,
      weekEnd: currentWeek.weekEnd,
      year: currentYear,
      weekNumber: currentWeekNumber,
      rank: currentRank,
      value: getValue(currentWeek),
    };
    
    const surrounding = surroundingWeeks.map((week, idx) => {
      const weekStart = new Date(week.weekStart);
      const thursday = new Date(weekStart);
      thursday.setDate(thursday.getDate() + 3);
      const year = this.getISOYear(thursday);
      const weekNumber = this.getWeekNumber(weekStart);
      
      return {
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        year,
        weekNumber,
        rank: startIdx + idx + 1,
        value: getValue(week),
      };
    });
    
    return {
      metric,
      current,
      surrounding,
      careerAverage,
    };
  }

  async getExerciseWeeklyAverage(exerciseId: string): Promise<number | null> {
    // 从数据库获取该运动类型的所有记录
    const entries = await this.db
      .select()
      .from(workoutEntries)
      .where(eq(workoutEntries.exerciseId, exerciseId));

    if (entries.length === 0) {
      return null;
    }

    // 按周分组计算
    const weeklyTotals = new Map<string, number>();

    for (const entry of entries) {
      const entryDate = new Date(entry.date);
      const weekStart = this.getWeekStart(entryDate);
      const weekKey = weekStart.toISOString();

      weeklyTotals.set(
        weekKey,
        (weeklyTotals.get(weekKey) || 0) + entry.value
      );
    }

    // 计算平均值
    const totalWeeks = weeklyTotals.size;
    const sumOfWeeklyTotals = Array.from(weeklyTotals.values()).reduce((sum, val) => sum + val, 0);
    
    return sumOfWeeklyTotals / totalWeeks;
  }

  async getWeeklyProgress() {
    const allExercises = await this.getExercises();
    const weekDetails = await this.getCurrentWeekDetails();
    const now = new Date();
    
    const exercisesProgress: Array<{
      exerciseId: string;
      exerciseName: string;
      exerciseUnit: string;
      exerciseCategory: string | null;
      currentWeekValue: number;
      weeklyAverage: number | null;
      difference: number | null;
      differencePercentage: number | null;
      daysSinceLastWorkout: number | null;
    }> = [];
    
    for (const exercise of allExercises) {
      const weekDetail = weekDetails.details.find(d => d.exerciseId === exercise.id);
      const currentWeekValue = weekDetail?.totalValue || 0;
      const weeklyAverage = await this.getExerciseWeeklyAverage(exercise.id);
      
      let difference = null;
      let differencePercentage = null;
      
      if (weeklyAverage !== null && weeklyAverage > 0) {
        difference = currentWeekValue - weeklyAverage;
        differencePercentage = (difference / weeklyAverage) * 100;
      }
      
      // 计算距离上次锻炼的天数
      const exerciseEntries = await this.db
        .select()
        .from(workoutEntries)
        .where(eq(workoutEntries.exerciseId, exercise.id))
        .orderBy(desc(workoutEntries.date))
        .limit(1);
      
      let daysSinceLastWorkout: number | null = null;
      if (exerciseEntries.length > 0) {
        const lastWorkoutDate = new Date(exerciseEntries[0].date);
        const nowTaipei = this.getTaipeiComponents(now);
        const lastTaipei = this.getTaipeiComponents(lastWorkoutDate);
        
        // getTaipeiComponents返回的month已经是0基索引，直接使用
        const nowDateOnly = new Date(nowTaipei.year, nowTaipei.month, nowTaipei.day);
        const lastDateOnly = new Date(lastTaipei.year, lastTaipei.month, lastTaipei.day);
        daysSinceLastWorkout = Math.floor((nowDateOnly.getTime() - lastDateOnly.getTime()) / (24 * 60 * 60 * 1000));
      }
      
      exercisesProgress.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        exerciseUnit: exercise.unit,
        exerciseCategory: exercise.category,
        currentWeekValue,
        weeklyAverage,
        difference,
        differencePercentage,
        daysSinceLastWorkout,
      });
    }
    
    // 推荐逻辑（DbStorage）：
    // 1. 最优先：推荐能锻炼到组数落后肌群的运动项目
    // 2. 其次：按距离上次锻炼天数排序，推荐很久没练的运动
    // 注意：排除"每周平均步数"，因为它是特殊的统计项目
    const recommendations: Array<{
      exerciseId: string;
      exerciseName: string;
      exerciseUnit: string;
      reason: string;
    }> = [];
    
    // 获取本周肌群训练数据
    const muscleGroupStats = await this.getMuscleGroupWeeklyStats();
    
    // 定义肌群字段映射
    const muscleFieldMap: Array<{ field: string; name: string }> = [
      { field: 'muscleChest', name: '胸' },
      { field: 'muscleBack', name: '背' },
      { field: 'muscleLegs', name: '腿' },
      { field: 'muscleShoulders', name: '肩' },
      { field: 'muscleArms', name: '二头肌' },
      { field: 'muscleCore', name: '核心' },
      { field: 'muscleGlutes', name: '臀' },
      { field: 'muscleFullBody', name: '三头肌' },
    ];
    
    // 找出组数落后的肌群（< 4组为低于维持量）
    const trainedMuscleMap = new Map<string, number>();
    for (const mg of muscleGroupStats.muscleGroups) {
      trainedMuscleMap.set(mg.muscleGroup, mg.totalSets);
    }
    
    // 找出所有肌群及其组数（未训练的为0）
    const allMuscleSetCounts: Array<{ name: string; sets: number }> = muscleFieldMap.map(m => ({
      name: m.name,
      sets: trainedMuscleMap.get(m.name) || 0,
    }));
    
    // 按组数排序，组数最少的排前面
    allMuscleSetCounts.sort((a, b) => a.sets - b.sets);
    
    // 找出组数落后的肌群（< 4组）
    const laggingMuscles = allMuscleSetCounts.filter(m => m.sets < 4);
    
    // 找出能锻炼落后肌群的运动（排除"每周平均步数"）
    if (laggingMuscles.length > 0) {
      for (const laggingMuscle of laggingMuscles) {
        const fieldInfo = muscleFieldMap.find(m => m.name === laggingMuscle.name);
        if (!fieldInfo) continue;
        
        // 找出能锻炼这个肌群的运动
        const exercisesForMuscle = allExercises.filter(ex => {
          const muscleValue = (ex as Record<string, unknown>)[fieldInfo.field] as number | null;
          return muscleValue && muscleValue > 0 && ex.name !== '每周平均步数';
        });
        
        if (exercisesForMuscle.length > 0) {
          // 优先推荐本周还没练过的
          const notDoneExercises = exercisesForMuscle.filter(ex => {
            const progress = exercisesProgress.find(p => p.exerciseId === ex.id);
            return progress && progress.currentWeekValue === 0;
          });
          
          // 按肌群百分比排序，选择对该肌群锻炼效果最好的
          const sortedExercises = (notDoneExercises.length > 0 ? notDoneExercises : exercisesForMuscle)
            .sort((a, b) => {
              const aValue = ((a as Record<string, unknown>)[fieldInfo.field] as number) || 0;
              const bValue = ((b as Record<string, unknown>)[fieldInfo.field] as number) || 0;
              return bValue - aValue;
            });
          
          const bestExercise = sortedExercises[0];
          if (bestExercise && !recommendations.find(r => r.exerciseId === bestExercise.id)) {
            const setsText = laggingMuscle.sets === 0 ? '未训练' : `仅${laggingMuscle.sets.toFixed(0)}组`;
            recommendations.push({
              exerciseId: bestExercise.id,
              exerciseName: bestExercise.name,
              exerciseUnit: bestExercise.unit,
              reason: `${laggingMuscle.name}肌群${setsText}，建议加强`,
            });
            
            // 最多推荐3个基于肌群落后的运动
            if (recommendations.length >= 3) break;
          }
        }
      }
    }
    
    // 其次按距离上次锻炼天数推荐（排除"每周平均步数"）
    const byDaysSinceLastWorkout = exercisesProgress
      .filter(e => 
        e.exerciseName !== '每周平均步数' &&
        e.daysSinceLastWorkout !== null &&
        e.daysSinceLastWorkout > 7 && // 超过一周没练
        !recommendations.find(r => r.exerciseId === e.exerciseId)
      )
      .sort((a, b) => (b.daysSinceLastWorkout || 0) - (a.daysSinceLastWorkout || 0));
    
    for (const exercise of byDaysSinceLastWorkout) {
      if (recommendations.length >= 5) break;
      recommendations.push({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        exerciseUnit: exercise.exerciseUnit,
        reason: `已${exercise.daysSinceLastWorkout}天未训练`,
      });
    }
    
    // 如果还没有推荐，找出低于历史平均的运动
    if (recommendations.length === 0) {
      const belowAverage = exercisesProgress.filter(e => 
        e.differencePercentage !== null && 
        e.differencePercentage < -10 && 
        e.exerciseName !== '每周平均步数'
      );
      if (belowAverage.length > 0) {
        belowAverage.sort((a, b) => (a.differencePercentage || 0) - (b.differencePercentage || 0));
        recommendations.push({
          exerciseId: belowAverage[0].exerciseId,
          exerciseName: belowAverage[0].exerciseName,
          exerciseUnit: belowAverage[0].exerciseUnit,
          reason: `低于平均值${Math.abs(belowAverage[0].differencePercentage!).toFixed(0)}%，需加强`,
        });
      }
    }
    
    return {
      weekStart: weekDetails.weekStart,
      weekEnd: weekDetails.weekEnd,
      exercises: exercisesProgress,
      recommendations,
    };
  }

  async getDailyContributions() {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = this.getWeekEnd(weekStart);
    
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dailyData: Array<{
      date: string;
      dayOfWeek: number;
      dayName: string;
      baselineValue: number;
      percentage: number;
      entryCount: number;
    }> = [];
    
    let weekTotal = 0;
    const dailyTotals: { date: Date; baselineValue: number; entryCount: number }[] = [];
    
    // DbStorage: 先计算本周"每周平均步数"的总基准值，用于平均分配到每天
    const weekEndTime = new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000);
    const weeklyStepsEntries = await this.db
      .select({
        value: workoutEntries.value,
        sets: workoutEntries.sets,
        baselineValue: workoutEntries.baselineValue,
        weightFactor: exercises.weightFactor,
      })
      .from(workoutEntries)
      .innerJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
      .where(
        and(
          gte(workoutEntries.date, weekStart),
          lt(workoutEntries.date, weekEndTime),
          eq(exercises.name, '每周平均步数')
        )
      );
    
    let weeklyStepsBaselineTotal = 0;
    for (const entry of weeklyStepsEntries) {
      // 直接使用已保存的基准值
      weeklyStepsBaselineTotal += entry.baselineValue ?? (entry.value * (entry.sets || 1) * entry.weightFactor);
    }
    const dailyStepsBaseline = weeklyStepsBaselineTotal / 7;
    
    // 遍历本周每一天
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      
      // 从数据库获取当天的记录（排除"每周平均步数"）
      const dayEntries = await this.db
        .select({
          value: workoutEntries.value,
          sets: workoutEntries.sets,
          baselineValue: workoutEntries.baselineValue,
          weightFactor: exercises.weightFactor,
          exerciseName: exercises.name,
        })
        .from(workoutEntries)
        .innerJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
        .where(
          and(
            gte(workoutEntries.date, dayStart),
            lte(workoutEntries.date, dayEnd)
          )
        );
      
      // 计算当天的基准值（排除"每周平均步数"，加上平均分配的步数基准值）
      let dayBaselineValue = dailyStepsBaseline;
      for (const entry of dayEntries) {
        if (entry.exerciseName !== '每周平均步数') {
          // 直接使用已保存的基准值
          dayBaselineValue += entry.baselineValue ?? (entry.value * (entry.sets || 1) * entry.weightFactor);
        }
      }
      
      dailyTotals.push({
        date: dayStart,
        baselineValue: dayBaselineValue,
        entryCount: dayEntries.length,
      });
      
      weekTotal += dayBaselineValue;
    }
    
    // 计算百分比
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      const taipeiComponents = this.getTaipeiComponents(dayStart);
      const dayOfWeek = taipeiComponents.dayOfWeek;
      
      dailyData.push({
        date: dayStart.toISOString(),
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        baselineValue: dailyTotals[i].baselineValue,
        percentage: weekTotal > 0 ? (dailyTotals[i].baselineValue / weekTotal) * 100 : 0,
        entryCount: dailyTotals[i].entryCount,
      });
    }
    
    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      dailyData,
      weekTotal,
    };
  }

  async getEntriesByDate(dateStr: string) {
    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    // 计算本周每周平均步数的分配基准值
    const weekStart = this.getWeekStart(dayStart);
    const weekEnd = this.getWeekEnd(weekStart);
    const weekEndTime = new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000);
    
    const weeklyStepsEntries = await this.db
      .select({
        value: workoutEntries.value,
        sets: workoutEntries.sets,
        baselineValue: workoutEntries.baselineValue,
        weightFactor: exercises.weightFactor,
      })
      .from(workoutEntries)
      .innerJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
      .where(
        and(
          gte(workoutEntries.date, weekStart),
          lt(workoutEntries.date, weekEndTime),
          eq(exercises.name, '每周平均步数')
        )
      );
    
    let weeklyStepsBaselineTotal = 0;
    for (const entry of weeklyStepsEntries) {
      // 直接使用已保存的基准值
      weeklyStepsBaselineTotal += entry.baselineValue ?? (entry.value * (entry.sets || 1) * entry.weightFactor);
    }
    const dailyStepsBaseline = weeklyStepsBaselineTotal / 7;
    
    const entries = await this.db
      .select({
        id: workoutEntries.id,
        exerciseName: exercises.name,
        exerciseUnit: exercises.unit,
        exerciseCategory: exercises.category,
        value: workoutEntries.value,
        sets: workoutEntries.sets,
        baselineValue: workoutEntries.baselineValue,
        weightFactor: exercises.weightFactor,
      })
      .from(workoutEntries)
      .innerJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
      .where(
        and(
          gte(workoutEntries.date, dayStart),
          lt(workoutEntries.date, dayEnd)
        )
      );
    
    let totalBaselineValue = 0;
    const result = entries.map(entry => {
      // 直接使用已保存的基准值
      const entryBaselineValue = entry.baselineValue ?? (entry.value * (entry.sets || 1) * entry.weightFactor);
      totalBaselineValue += entryBaselineValue;
      return {
        id: entry.id,
        exerciseName: entry.exerciseName,
        exerciseUnit: entry.exerciseUnit,
        exerciseCategory: entry.exerciseCategory,
        value: entry.value,
        sets: entry.sets,
        baselineValue: entryBaselineValue,
        weightFactor: entry.weightFactor,
      };
    });
    
    return {
      date: dateStr,
      entries: result,
      totalBaselineValue,
      dailyStepsBaseline,
    };
  }

  async getWeekDetails(weekStartStr: string) {
    const weekStart = new Date(weekStartStr);
    const weekEnd = this.getWeekEnd(weekStart);

    const result = await this.db
      // 直接使用已保存的基准值
      .select({
        exerciseId: exercises.id,
        exerciseName: exercises.name,
        exerciseUnit: exercises.unit,
        exerciseCategory: exercises.category,
        weightFactor: exercises.weightFactor,
        count: sql<number>`cast(count(${workoutEntries.id}) as int)`,
        totalValue: sql<number>`cast(sum(${workoutEntries.value} * coalesce(${workoutEntries.sets}, 1)) as float)`,
        baselineValue: sql<number>`cast(sum(coalesce(${workoutEntries.baselineValue}, ${workoutEntries.value} * coalesce(${workoutEntries.sets}, 1) * ${exercises.weightFactor})) as float)`,
      })
      .from(workoutEntries)
      .innerJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
      .where(
        and(
          gte(workoutEntries.date, weekStart),
          lte(workoutEntries.date, weekEnd)
        )
      )
      .groupBy(exercises.id, exercises.name, exercises.unit, exercises.category, exercises.weightFactor);

    const detailsWithAverage = [];
    for (const stat of result) {
      const weeklyAverage = await this.getExerciseWeeklyAverage(stat.exerciseId);
      
      let difference = null;
      let differencePercentage = null;
      
      if (weeklyAverage !== null && weeklyAverage > 0) {
        difference = stat.totalValue - weeklyAverage;
        differencePercentage = (difference / weeklyAverage) * 100;
      }

      detailsWithAverage.push({
        ...stat,
        weeklyAverage,
        difference,
        differencePercentage,
      });
    }

    const details = detailsWithAverage.sort((a, b) => b.baselineValue - a.baselineValue);
    const totalBaselineValue = details.reduce((sum, d) => sum + d.baselineValue, 0);

    const entryCountResult = await this.db
      .select({
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(workoutEntries)
      .where(
        and(
          gte(workoutEntries.date, weekStart),
          lte(workoutEntries.date, weekEnd)
        )
      );

    const entryCount = entryCountResult[0]?.count || 0;
    const year = this.getISOYear(weekStart);
    const weekNumber = this.getWeekNumber(weekStart);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      year,
      weekNumber,
      totalBaselineValue,
      entryCount,
      details,
    };
  }

  // 辅助方法：获取周一（基于UTC+8时区）
  private getWeekStart(date: Date): Date {
    // 获取台北时区的日期组件
    const taipei = this.getTaipeiComponents(date);
    const diff = taipei.dayOfWeek === 0 ? -6 : 1 - taipei.dayOfWeek; // 周日是0，需要-6天；其他日子到周一
    
    // 直接从台北时区的date计算周一的毫秒时间戳
    // 方法：在当前日期基础上加/减天数得到周一，然后设为00:00:00
    const taipeiMondayTimestamp = date.getTime() + this.TAIPEI_OFFSET + diff * 24 * 60 * 60 * 1000;
    const taipeiMonday = new Date(taipeiMondayTimestamp);
    
    // 获取周一在台北时区的年月日
    const mondayYear = taipeiMonday.getUTCFullYear();
    const mondayMonth = taipeiMonday.getUTCMonth();
    const mondayDay = taipeiMonday.getUTCDate();
    
    // 返回周一00:00:00（台北时间）对应的UTC时间
    return this.createUTCFromTaipei(mondayYear, mondayMonth, mondayDay, 0, 0, 0, 0);
  }

  // 辅助方法：获取周日（基于UTC+8时区）
  private getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(date);
    
    // 周日是周一+6天
    const taipeiSundayTimestamp = weekStart.getTime() + this.TAIPEI_OFFSET + 6 * 24 * 60 * 60 * 1000;
    const taipeiSunday = new Date(taipeiSundayTimestamp);
    
    // 获取周日在台北时区的年月日
    const sundayYear = taipeiSunday.getUTCFullYear();
    const sundayMonth = taipeiSunday.getUTCMonth();
    const sundayDay = taipeiSunday.getUTCDate();
    
    // 返回周日23:59:59.999（台北时间）对应的UTC时间
    return this.createUTCFromTaipei(sundayYear, sundayMonth, sundayDay, 23, 59, 59, 999);
  }

  // 辅助方法：计算ISO周数（基于UTC+8时区）
  private getWeekNumber(date: Date): number {
    const taipei = this.getTaipeiComponents(date);
    // ISO周数计算：找到包含当年第一个周四的那一周
    const tempDate = new Date(Date.UTC(taipei.year, taipei.month, taipei.day));
    tempDate.setUTCDate(tempDate.getUTCDate() + 3 - (tempDate.getUTCDay() + 6) % 7);
    const week1 = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getUTCDay() + 6) % 7) / 7);
  }

  // 辅助方法：计算ISO年份（基于UTC+8时区）
  private getISOYear(date: Date): number {
    const taipei = this.getTaipeiComponents(date);
    const tempDate = new Date(Date.UTC(taipei.year, taipei.month, taipei.day));
    // 调整到周四（周一+3天）
    tempDate.setUTCDate(tempDate.getUTCDate() + 3 - (tempDate.getUTCDay() + 6) % 7);
    return tempDate.getUTCFullYear();
  }

  async getCareerOverview() {
    const allWeeklyStats = await this.getAllWeeklyStats();
    
    if (allWeeklyStats.length === 0) {
      return { weeks: [], totalStars: 0, averageStars: 0 };
    }

    // 计算各项平均值
    const avgTotal = allWeeklyStats.reduce((sum, w) => sum + w.totalBaselineValue, 0) / allWeeklyStats.length;
    const avgStrength = allWeeklyStats.reduce((sum, w) => sum + w.strengthValue, 0) / allWeeklyStats.length;
    const avgCardio = allWeeklyStats.reduce((sum, w) => sum + w.cardioValue, 0) / allWeeklyStats.length;
    const avgActivity = allWeeklyStats.reduce((sum, w) => sum + w.activityValue, 0) / allWeeklyStats.length;

    // 按总分排序计算百分比
    const sortedByTotal = [...allWeeklyStats].sort((a, b) => b.totalBaselineValue - a.totalBaselineValue);

    const weeks = allWeeklyStats.map((week) => {
      const weekStart = new Date(week.weekStart);
      const year = this.getISOYear(weekStart);
      const weekNumber = this.getWeekNumber(weekStart);

      // 计算百分位排名
      const rank = sortedByTotal.findIndex(w => w.weekStart === week.weekStart && w.weekEnd === week.weekEnd) + 1;
      const percentile = (rank / allWeeklyStats.length) * 100;

      // 计算星星数量（5个里程碑）
      let stars = 0;
      const inTop70 = percentile <= 70;
      const inTop10 = percentile <= 10;
      const totalAbove = week.totalBaselineValue >= avgTotal;
      const strengthAbove = week.strengthValue >= avgStrength && avgStrength > 0;
      const cardioAbove = week.cardioValue >= avgCardio && avgCardio > 0;
      const activityAbove = week.activityValue >= avgActivity && avgActivity > 0;
      const threeAbove = strengthAbove && cardioAbove && activityAbove;

      if (inTop70) stars++;
      if (totalAbove) stars++;
      if (threeAbove) stars++;
      if (threeAbove && totalAbove) stars++;
      if (inTop10) stars++;

      return {
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        year,
        weekNumber,
        totalScore: week.totalBaselineValue,
        strengthScore: week.strengthValue,
        cardioScore: week.cardioValue,
        activityScore: week.activityValue,
        stars,
        percentile,
      };
    });

    // 按时间倒序排列（最新的在前）
    weeks.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());

    const totalStars = weeks.reduce((sum, w) => sum + w.stars, 0);
    const averageStars = weeks.length > 0 ? totalStars / weeks.length : 0;

    // 计算年度统计
    const yearlyMap = new Map<number, { weeksRecorded: number; totalStars: number }>();
    for (const week of weeks) {
      const existing = yearlyMap.get(week.year) || { weeksRecorded: 0, totalStars: 0 };
      existing.weeksRecorded += 1;
      existing.totalStars += week.stars;
      yearlyMap.set(week.year, existing);
    }

    const yearlyStats = Array.from(yearlyMap.entries())
      .map(([year, stats]) => {
        // ISO年可能有52或53周，计算该年的实际ISO周数
        const isoWeeksInYear = this.getISOWeeksInYear(year);
        // 取得率改为：已取得星星 / 已记录周数能取得的最多星星
        const maxStarsRecorded = stats.weeksRecorded * 5;
        const completionRate = maxStarsRecorded > 0 ? stats.totalStars / maxStarsRecorded : 0;
        return {
          year,
          weeksRecorded: stats.weeksRecorded,
          isoWeeksInYear,
          totalStars: stats.totalStars,
          maxStarsRecorded,
          completionRate,
        };
      })
      .sort((a, b) => b.year - a.year); // 按年份倒序

    return { weeks, totalStars, averageStars, yearlyStats };
  }

  // 辅助方法：计算某年的ISO周数（52或53）
  private getISOWeeksInYear(year: number): number {
    // ISO年的最后一周包含12月28日
    const dec28 = new Date(Date.UTC(year, 11, 28));
    return this.getWeekNumber(dec28);
  }

  async getMuscleGroupWeeklyStats() {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = this.getWeekEnd(now);

    const entries = await this.db
      .select({
        value: workoutEntries.value,
        sets: workoutEntries.sets,
        baselineValue: workoutEntries.baselineValue,
        weightFactor: exercises.weightFactor,
        muscleChest: exercises.muscleChest,
        muscleBack: exercises.muscleBack,
        muscleLegs: exercises.muscleLegs,
        muscleShoulders: exercises.muscleShoulders,
        muscleArms: exercises.muscleArms,
        muscleCore: exercises.muscleCore,
        muscleGlutes: exercises.muscleGlutes,
        muscleFullBody: exercises.muscleFullBody,
      })
      .from(workoutEntries)
      .innerJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
      .where(
        and(
          gte(workoutEntries.date, weekStart),
          lte(workoutEntries.date, weekEnd)
        )
      );

    const muscleGroupMap = new Map<string, { totalSets: number; totalVolume: number }>();
    const muscleFields = [
      { field: 'muscleChest', name: '胸' },
      { field: 'muscleBack', name: '背' },
      { field: 'muscleLegs', name: '腿' },
      { field: 'muscleShoulders', name: '肩' },
      { field: 'muscleArms', name: '二头肌' },
      { field: 'muscleCore', name: '核心' },
      { field: 'muscleGlutes', name: '臀' },
      { field: 'muscleFullBody', name: '三头肌' },
    ] as const;

    for (const entry of entries) {
      // 直接使用已保存的基准值
      const baseSets = entry.sets || 1;
      const baseVolume = entry.baselineValue ?? (entry.value * baseSets * entry.weightFactor);

      for (const { field, name } of muscleFields) {
        const percentage = (entry[field] as number) || 0;
        if (percentage <= 0) continue;

        const existing = muscleGroupMap.get(name) || { totalSets: 0, totalVolume: 0 };
        existing.totalSets += baseSets * (percentage / 100);
        existing.totalVolume += baseVolume * (percentage / 100);
        muscleGroupMap.set(name, existing);
      }
    }

    const muscleGroups = Array.from(muscleGroupMap.entries())
      .map(([muscleGroup, stats]) => ({
        muscleGroup,
        totalSets: Math.round(stats.totalSets * 10) / 10,
        totalVolume: stats.totalVolume,
      }))
      .filter(g => g.totalVolume > 0)
      .sort((a, b) => b.totalVolume - a.totalVolume);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      muscleGroups,
    };
  }

  async updateWeeklyMuscleStats(weekStartStr: string): Promise<void> {
    const weekStart = new Date(weekStartStr);
    const weekEnd = this.getWeekEnd(weekStart);
    const weekEndTime = new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000);

    const entries = await this.db
      .select({
        value: workoutEntries.value,
        sets: workoutEntries.sets,
        baselineValue: workoutEntries.baselineValue,
        weightFactor: exercises.weightFactor,
        muscleChest: exercises.muscleChest,
        muscleBack: exercises.muscleBack,
        muscleLegs: exercises.muscleLegs,
        muscleShoulders: exercises.muscleShoulders,
        muscleArms: exercises.muscleArms,
        muscleCore: exercises.muscleCore,
        muscleGlutes: exercises.muscleGlutes,
        muscleFullBody: exercises.muscleFullBody,
      })
      .from(workoutEntries)
      .innerJoin(exercises, eq(workoutEntries.exerciseId, exercises.id))
      .where(
        and(
          gte(workoutEntries.date, weekStart),
          lt(workoutEntries.date, weekEndTime)
        )
      );

    let chestValue = 0, backValue = 0, legsValue = 0, shouldersValue = 0;
    let armsValue = 0, coreValue = 0, glutesValue = 0, fullBodyValue = 0;

    for (const entry of entries) {
      const baseVolume = entry.baselineValue ?? (entry.value * (entry.sets || 1) * entry.weightFactor);

      chestValue += baseVolume * ((entry.muscleChest || 0) / 100);
      backValue += baseVolume * ((entry.muscleBack || 0) / 100);
      legsValue += baseVolume * ((entry.muscleLegs || 0) / 100);
      shouldersValue += baseVolume * ((entry.muscleShoulders || 0) / 100);
      armsValue += baseVolume * ((entry.muscleArms || 0) / 100);
      coreValue += baseVolume * ((entry.muscleCore || 0) / 100);
      glutesValue += baseVolume * ((entry.muscleGlutes || 0) / 100);
      fullBodyValue += baseVolume * ((entry.muscleFullBody || 0) / 100);
    }

    const weekStartFormatted = this.formatTaipeiDate(weekStart);
    
    await this.db
      .insert(weeklyMuscleStats)
      .values({
        weekStart: weekStartFormatted,
        chestValue,
        backValue,
        legsValue,
        shouldersValue,
        armsValue,
        coreValue,
        glutesValue,
        fullBodyValue,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: weeklyMuscleStats.weekStart,
        set: {
          chestValue,
          backValue,
          legsValue,
          shouldersValue,
          armsValue,
          coreValue,
          glutesValue,
          fullBodyValue,
          updatedAt: new Date(),
        },
      });
  }

  async getWeeklyMuscleStatsHistory(): Promise<Array<{
    weekStart: string;
    chestValue: number;
    backValue: number;
    legsValue: number;
    shouldersValue: number;
    armsValue: number;
    coreValue: number;
    glutesValue: number;
    fullBodyValue: number;
    updatedAt: Date;
  }>> {
    const result = await this.db
      .select()
      .from(weeklyMuscleStats)
      .orderBy(desc(weeklyMuscleStats.weekStart));
    
    return result;
  }

  async getMuscleGroupAverages(): Promise<{
    chestAvg: number;
    backAvg: number;
    legsAvg: number;
    shouldersAvg: number;
    armsAvg: number;
    coreAvg: number;
    glutesAvg: number;
    fullBodyAvg: number;
    weekCount: number;
  }> {
    const result = await this.db
      .select({
        chestAvg: sql<number>`coalesce(avg(${weeklyMuscleStats.chestValue}), 0)`,
        backAvg: sql<number>`coalesce(avg(${weeklyMuscleStats.backValue}), 0)`,
        legsAvg: sql<number>`coalesce(avg(${weeklyMuscleStats.legsValue}), 0)`,
        shouldersAvg: sql<number>`coalesce(avg(${weeklyMuscleStats.shouldersValue}), 0)`,
        armsAvg: sql<number>`coalesce(avg(${weeklyMuscleStats.armsValue}), 0)`,
        coreAvg: sql<number>`coalesce(avg(${weeklyMuscleStats.coreValue}), 0)`,
        glutesAvg: sql<number>`coalesce(avg(${weeklyMuscleStats.glutesValue}), 0)`,
        fullBodyAvg: sql<number>`coalesce(avg(${weeklyMuscleStats.fullBodyValue}), 0)`,
        weekCount: sql<number>`count(*)`,
      })
      .from(weeklyMuscleStats);

    return result[0] || {
      chestAvg: 0,
      backAvg: 0,
      legsAvg: 0,
      shouldersAvg: 0,
      armsAvg: 0,
      coreAvg: 0,
      glutesAvg: 0,
      fullBodyAvg: 0,
      weekCount: 0,
    };
  }

  async migrateHistoricalMuscleStats(): Promise<{ migratedWeeks: number }> {
    // 获取所有运动记录的日期，找出所有涉及的周
    const allEntries = await this.db
      .select({
        date: workoutEntries.date,
      })
      .from(workoutEntries);

    const weekStartsSet = new Set<string>();
    for (const entry of allEntries) {
      const weekStart = this.getWeekStart(entry.date);
      weekStartsSet.add(this.formatTaipeiDate(weekStart));
    }

    // 为每个周更新肌群统计
    const weekStarts = Array.from(weekStartsSet);
    for (const weekStartStr of weekStarts) {
      await this.updateWeeklyMuscleStats(weekStartStr);
    }

    return { migratedWeeks: weekStarts.length };
  }

  async recalculateAllBaselines(): Promise<{ updatedEntries: number; updatedWeeks: number; updatedExercises: number }> {
    const exerciseCoefficients: Record<string, { movementCoefficient: number; intensityFactor: number }> = {
      '啞鈴深蹲': { movementCoefficient: 1.2, intensityFactor: 1 },
      '弓步蹲': { movementCoefficient: 1.2, intensityFactor: 1 },
      '深蹲': { movementCoefficient: 1.2, intensityFactor: 1 },
      '硬舉': { movementCoefficient: 1.2, intensityFactor: 1 },
      '二頭肌彎舉': { movementCoefficient: 0.8, intensityFactor: 1 },
      '捲腹': { movementCoefficient: 0.8, intensityFactor: 1 },
      '超人式': { movementCoefficient: 0.8, intensityFactor: 1 },
      '雙槓捲腹': { movementCoefficient: 0.8, intensityFactor: 1 },
      '伏地起身': { movementCoefficient: 1, intensityFactor: 1 },
      '反向划船': { movementCoefficient: 1, intensityFactor: 1 },
      '引體吊掛': { movementCoefficient: 1, intensityFactor: 1 },
      '站立肩推': { movementCoefficient: 1, intensityFactor: 1 },
      '雙槓臂屈伸': { movementCoefficient: 1, intensityFactor: 1 },
      '跑步': { movementCoefficient: 1, intensityFactor: 1 },
      '跑步機負重': { movementCoefficient: 1, intensityFactor: 2 },
      '開合跳': { movementCoefficient: 1, intensityFactor: 1.5 },
      '每周平均步数': { movementCoefficient: 1, intensityFactor: 1 },
    };

    let updatedExercises = 0;
    const allExercises = await this.db.select().from(exercises);
    for (const ex of allExercises) {
      const coeffs = exerciseCoefficients[ex.name];
      if (coeffs) {
        await this.db
          .update(exercises)
          .set({
            movementCoefficient: coeffs.movementCoefficient,
            intensityFactor: coeffs.intensityFactor,
          })
          .where(eq(exercises.id, ex.id));
        updatedExercises++;
      }
    }

    const allEntries = await this.db
      .select({
        entryId: workoutEntries.id,
        value: workoutEntries.value,
        sets: workoutEntries.sets,
        entryWeightFactor: workoutEntries.weightFactor,
        date: workoutEntries.date,
        exerciseCategory: exercises.category,
        exerciseWeightFactor: exercises.weightFactor,
        exerciseMovementCoefficient: exercises.movementCoefficient,
        exerciseIntensityFactor: exercises.intensityFactor,
        exerciseName: exercises.name,
        exerciseUnit: exercises.unit,
      })
      .from(workoutEntries)
      .innerJoin(exercises, eq(workoutEntries.exerciseId, exercises.id));

    let updatedEntries = 0;
    const weekStartsSet = new Set<string>();

    for (const entry of allEntries) {
      const wf = entry.entryWeightFactor ?? entry.exerciseWeightFactor;
      const sets = entry.sets ?? 1;
      const coeffs = exerciseCoefficients[entry.exerciseName];
      const mc = coeffs?.movementCoefficient ?? entry.exerciseMovementCoefficient ?? 1;
      const intf = coeffs?.intensityFactor ?? entry.exerciseIntensityFactor ?? 1;

      let newBaseline: number;
      if (entry.exerciseCategory === '有氧' && entry.exerciseUnit === 'KM') {
        newBaseline = entry.value * 10 * intf;
      } else {
        newBaseline = calculateBaseline(
          entry.value, sets, wf,
          entry.exerciseCategory, mc, intf, entry.exerciseName
        );
      }

      await this.db
        .update(workoutEntries)
        .set({ baselineValue: newBaseline })
        .where(eq(workoutEntries.id, entry.entryId));

      updatedEntries++;
      const weekStart = this.getWeekStart(entry.date);
      weekStartsSet.add(this.formatTaipeiDate(weekStart));
    }

    for (const ws of weekStartsSet) {
      await this.updateWeeklyMuscleStats(ws);
    }

    return { updatedEntries, updatedWeeks: weekStartsSet.size, updatedExercises };
  }

  async getUserSetting(key: string): Promise<string | null> {
    const result = await this.db
      .select({ value: userSettings.value })
      .from(userSettings)
      .where(eq(userSettings.key, key));
    return result[0]?.value ?? null;
  }

  async setUserSetting(key: string, value: string): Promise<void> {
    await this.db
      .insert(userSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: userSettings.key,
        set: { value },
      });
  }

  async getAllUserSettings(): Promise<Record<string, string>> {
    const result = await this.db
      .select()
      .from(userSettings);
    const settings: Record<string, string> = {};
    for (const row of result) {
      settings[row.key] = row.value;
    }
    return settings;
  }
}

export const storage = process.env.DATABASE_URL ? new DbStorage() : new MemStorage();
