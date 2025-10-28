import {
  type Exercise,
  type InsertExercise,
  type WorkoutEntry,
  type InsertWorkoutEntry,
  type WorkoutEntryWithExercise,
  type WeeklyStats,
  type RankingData,
  exercises,
  workoutEntries,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, gte, lte, desc, sql, sum, count } from "drizzle-orm";
import { Pool } from "pg";

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
  deleteWorkoutEntry(id: string): Promise<boolean>;

  // 统计和分析
  getWeeklyStats(weekStart: Date, weekEnd: Date): Promise<WeeklyStats>;
  getAllWeeklyStats(): Promise<WeeklyStats[]>;
  getRankingData(): Promise<RankingData>;
  getCurrentWeekDetails(): Promise<{
    weekStart: string;
    weekEnd: string;
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
    }>;
    recommendations: Array<{
      exerciseId: string;
      exerciseName: string;
      exerciseUnit: string;
      reason: string;
    }>;
  }>;
}

export class MemStorage implements IStorage {
  private exercises: Map<string, Exercise>;
  private workoutEntries: Map<string, WorkoutEntry>;

  constructor() {
    this.exercises = new Map();
    this.workoutEntries = new Map();
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
    const exercise: Exercise = { ...insertExercise, id, category: insertExercise.category ?? null };
    this.exercises.set(id, exercise);
    return exercise;
  }

  async updateExercise(id: string, insertExercise: InsertExercise): Promise<Exercise | undefined> {
    const existing = this.exercises.get(id);
    if (!existing) return undefined;

    const updated: Exercise = { ...insertExercise, id, category: insertExercise.category ?? null };
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
    
    const entry: WorkoutEntry = {
      id,
      exerciseId: insertEntry.exerciseId,
      value: insertEntry.value,
      date,
      notes: insertEntry.notes || null,
    };

    this.workoutEntries.set(id, entry);
    return entry;
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

    let totalBaselineValue = 0;
    let strengthValue = 0;
    let cardioValue = 0;
    let activityValue = 0;

    for (const entry of entries) {
      const exercise = this.exercises.get(entry.exerciseId);
      if (exercise) {
        const baseline = entry.value * exercise.weightFactor;
        totalBaselineValue += baseline;

        if (exercise.category === '力量') {
          strengthValue += baseline;
        } else if (exercise.category === '有氧') {
          cardioValue += baseline;
        } else if (exercise.category === '活动量') {
          activityValue += baseline;
        }
      }
    }

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
      count: number;
      totalValue: number;
      baselineValue: number;
    }>();

    for (const entry of entries) {
      const exercise = this.exercises.get(entry.exerciseId);
      if (!exercise) continue;

      const existing = exerciseStats.get(entry.exerciseId);
      if (existing) {
        existing.count++;
        existing.totalValue += entry.value;
        existing.baselineValue += entry.value * exercise.weightFactor;
      } else {
        exerciseStats.set(entry.exerciseId, {
          exerciseId: entry.exerciseId,
          exerciseName: exercise.name,
          exerciseUnit: exercise.unit,
          exerciseCategory: exercise.category,
          weightFactor: exercise.weightFactor,
          count: 1,
          totalValue: entry.value,
          baselineValue: entry.value * exercise.weightFactor,
        });
      }
    }

    const details = Array.from(exerciseStats.values())
      .sort((a, b) => b.baselineValue - a.baselineValue);

    const totalBaselineValue = details.reduce((sum, d) => sum + d.baselineValue, 0);

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalBaselineValue,
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

    // 计算平均值
    const totalValue = allWeeklyStats.reduce((sum, week) => sum + week.totalBaselineValue, 0);
    const averageWeeklyValue = totalValue / allWeeklyStats.length;

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
    
    const exercisesProgress = [];
    
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
      
      exercisesProgress.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        exerciseUnit: exercise.unit,
        exerciseCategory: exercise.category,
        currentWeekValue,
        weeklyAverage,
        difference,
        differencePercentage,
      });
    }
    
    // 推荐逻辑：
    // 1. 优先推荐本周还没有做过的运动
    // 2. 其次推荐本周累积值距离历史平均值差距最大的（负方向）
    const recommendations = [];
    
    // 找出本周还没做过的运动
    const notDoneYet = exercisesProgress.filter(e => e.currentWeekValue === 0 && e.weeklyAverage !== null && e.weeklyAverage > 0);
    if (notDoneYet.length > 0) {
      // 按历史周平均值排序，推荐平均值最高的
      notDoneYet.sort((a, b) => (b.weeklyAverage || 0) - (a.weeklyAverage || 0));
      recommendations.push({
        exerciseId: notDoneYet[0].exerciseId,
        exerciseName: notDoneYet[0].exerciseName,
        exerciseUnit: notDoneYet[0].exerciseUnit,
        reason: "本周尚未训练，建议开始",
      });
    }
    
    // 找出差距最大的（负方向，即做得比平均少很多的）
    const belowAverage = exercisesProgress.filter(e => 
      e.differencePercentage !== null && 
      e.differencePercentage < -10 && 
      e.currentWeekValue > 0
    );
    if (belowAverage.length > 0) {
      // 按差距百分比排序，差距最大的排前面
      belowAverage.sort((a, b) => (a.differencePercentage || 0) - (b.differencePercentage || 0));
      
      // 避免重复推荐
      if (!recommendations.find(r => r.exerciseId === belowAverage[0].exerciseId)) {
        recommendations.push({
          exerciseId: belowAverage[0].exerciseId,
          exerciseName: belowAverage[0].exerciseName,
          exerciseUnit: belowAverage[0].exerciseUnit,
          reason: `低于平均值${Math.abs(belowAverage[0].differencePercentage!).toFixed(0)}%，需加强`,
        });
      }
    }
    
    // 如果以上都没有，找出做得比平均少的
    if (recommendations.length === 0) {
      const slightlyBelow = exercisesProgress.filter(e => 
        e.differencePercentage !== null && 
        e.differencePercentage < 0 &&
        e.currentWeekValue > 0
      );
      if (slightlyBelow.length > 0) {
        slightlyBelow.sort((a, b) => (a.differencePercentage || 0) - (b.differencePercentage || 0));
        recommendations.push({
          exerciseId: slightlyBelow[0].exerciseId,
          exerciseName: slightlyBelow[0].exerciseName,
          exerciseUnit: slightlyBelow[0].exerciseUnit,
          reason: "可以加强训练",
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

  // 辅助方法：获取周一
  private getWeekStart(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 周日是0，需要-6天；其他日子到周一
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  // 辅助方法：获取周日
  private getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(date);
    const result = new Date(weekStart);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);
    return result;
  }
}

export class DbStorage implements IStorage {
  private db;

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this.db = drizzle(pool);
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
    
    const result = await this.db
      .insert(workoutEntries)
      .values({
        exerciseId: insertEntry.exerciseId,
        value: insertEntry.value,
        date,
        notes: insertEntry.notes ?? null,
      })
      .returning();

    return result[0];
  }

  async deleteWorkoutEntry(id: string): Promise<boolean> {
    const result = await this.db.delete(workoutEntries).where(eq(workoutEntries.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // 统计和分析方法
  async getWeeklyStats(weekStart: Date, weekEnd: Date): Promise<WeeklyStats> {
    const entries = await this.db
      .select({
        id: workoutEntries.id,
        exerciseId: workoutEntries.exerciseId,
        value: workoutEntries.value,
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

    let totalBaselineValue = 0;
    let strengthValue = 0;
    let cardioValue = 0;
    let activityValue = 0;
    let entryCount = 0;

    for (const entry of entries) {
      if (entry.exercise) {
        const baseline = entry.value * entry.exercise.weightFactor;
        totalBaselineValue += baseline;
        entryCount++;

        if (entry.exercise.category === '力量') {
          strengthValue += baseline;
        } else if (entry.exercise.category === '有氧') {
          cardioValue += baseline;
        } else if (entry.exercise.category === '活动量') {
          activityValue += baseline;
        }
      }
    }

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
    // 获取排名数据以获得"当前周"（实际上是最后一周有数据的周）
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
        count: sql<number>`cast(count(${workoutEntries.id}) as int)`,
        totalValue: sql<number>`cast(sum(${workoutEntries.value}) as float)`,
        baselineValue: sql<number>`cast(sum(${workoutEntries.value} * ${exercises.weightFactor}) as float)`,
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

    const details = result.sort((a, b) => b.baselineValue - a.baselineValue);

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

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalBaselineValue,
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

    // 计算平均值
    const totalValue = allWeeklyStats.reduce((sum, week) => sum + week.totalBaselineValue, 0);
    const averageWeeklyValue = totalValue / allWeeklyStats.length;

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
    
    const exercisesProgress = [];
    
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
      
      exercisesProgress.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        exerciseUnit: exercise.unit,
        exerciseCategory: exercise.category,
        currentWeekValue,
        weeklyAverage,
        difference,
        differencePercentage,
      });
    }
    
    // 推荐逻辑：
    // 1. 优先推荐本周还没有做过的运动
    // 2. 其次推荐本周累积值距离历史平均值差距最大的（负方向）
    const recommendations = [];
    
    // 找出本周还没做过的运动
    const notDoneYet = exercisesProgress.filter(e => e.currentWeekValue === 0 && e.weeklyAverage !== null && e.weeklyAverage > 0);
    if (notDoneYet.length > 0) {
      // 按历史周平均值排序，推荐平均值最高的
      notDoneYet.sort((a, b) => (b.weeklyAverage || 0) - (a.weeklyAverage || 0));
      recommendations.push({
        exerciseId: notDoneYet[0].exerciseId,
        exerciseName: notDoneYet[0].exerciseName,
        exerciseUnit: notDoneYet[0].exerciseUnit,
        reason: "本周尚未训练，建议开始",
      });
    }
    
    // 找出差距最大的（负方向，即做得比平均少很多的）
    const belowAverage = exercisesProgress.filter(e => 
      e.differencePercentage !== null && 
      e.differencePercentage < -10 && 
      e.currentWeekValue > 0
    );
    if (belowAverage.length > 0) {
      // 按差距百分比排序，差距最大的排前面
      belowAverage.sort((a, b) => (a.differencePercentage || 0) - (b.differencePercentage || 0));
      
      // 避免重复推荐
      if (!recommendations.find(r => r.exerciseId === belowAverage[0].exerciseId)) {
        recommendations.push({
          exerciseId: belowAverage[0].exerciseId,
          exerciseName: belowAverage[0].exerciseName,
          exerciseUnit: belowAverage[0].exerciseUnit,
          reason: `低于平均值${Math.abs(belowAverage[0].differencePercentage!).toFixed(0)}%，需加强`,
        });
      }
    }
    
    // 如果以上都没有，找出做得比平均少的
    if (recommendations.length === 0) {
      const slightlyBelow = exercisesProgress.filter(e => 
        e.differencePercentage !== null && 
        e.differencePercentage < 0 &&
        e.currentWeekValue > 0
      );
      if (slightlyBelow.length > 0) {
        slightlyBelow.sort((a, b) => (a.differencePercentage || 0) - (b.differencePercentage || 0));
        recommendations.push({
          exerciseId: slightlyBelow[0].exerciseId,
          exerciseName: slightlyBelow[0].exerciseName,
          exerciseUnit: slightlyBelow[0].exerciseUnit,
          reason: "可以加强训练",
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

  // 辅助方法：获取周一
  private getWeekStart(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 周日是0，需要-6天；其他日子到周一
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  // 辅助方法：获取周日
  private getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(date);
    const result = new Date(weekStart);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);
    return result;
  }
}

export const storage = process.env.DATABASE_URL ? new DbStorage() : new MemStorage();
