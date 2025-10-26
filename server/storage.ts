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
      exerciseName: string;
      exerciseUnit: string;
      weightFactor: number;
      count: number;
      totalValue: number;
      baselineValue: number;
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
    for (const entry of entries) {
      const exercise = this.exercises.get(entry.exerciseId);
      if (exercise) {
        totalBaselineValue += entry.value * exercise.weightFactor;
      }
    }

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalBaselineValue,
      entryCount: entries.length,
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
      exerciseName: string;
      exerciseUnit: string;
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
          exerciseName: exercise.name,
          exerciseUnit: exercise.unit,
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
        },
        bestWeek: null,
        worstWeek: null,
        averageWeeklyValue: 0,
        rank: 0,
        totalWeeks: 0,
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

    // 计算排名（降序，值越大排名越高）
    const sorted = [...allWeeklyStats].sort((a, b) => b.totalBaselineValue - a.totalBaselineValue);
    const rank = sorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    ) + 1;

    return {
      currentWeek,
      bestWeek,
      worstWeek,
      averageWeeklyValue,
      rank,
      totalWeeks: allWeeklyStats.length,
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
    let entryCount = 0;

    for (const entry of entries) {
      if (entry.exercise) {
        totalBaselineValue += entry.value * entry.exercise.weightFactor;
        entryCount++;
      }
    }

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalBaselineValue,
      entryCount,
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
        exerciseName: exercises.name,
        exerciseUnit: exercises.unit,
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
      .groupBy(exercises.id, exercises.name, exercises.unit, exercises.weightFactor);

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
        },
        bestWeek: null,
        worstWeek: null,
        averageWeeklyValue: 0,
        rank: 0,
        totalWeeks: 0,
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

    // 计算排名（降序，值越大排名越高）
    const sorted = [...allWeeklyStats].sort((a, b) => b.totalBaselineValue - a.totalBaselineValue);
    const rank = sorted.findIndex(w => 
      w.weekStart === currentWeek.weekStart && w.weekEnd === currentWeek.weekEnd
    ) + 1;

    return {
      currentWeek,
      bestWeek,
      worstWeek,
      averageWeeklyValue,
      rank,
      totalWeeks: allWeeklyStats.length,
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
