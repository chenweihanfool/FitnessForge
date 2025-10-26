import {
  type Exercise,
  type InsertExercise,
  type WorkoutEntry,
  type InsertWorkoutEntry,
  type WorkoutEntryWithExercise,
  type WeeklyStats,
  type RankingData,
} from "@shared/schema";
import { randomUUID } from "crypto";

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
    const exercise: Exercise = { ...insertExercise, id };
    this.exercises.set(id, exercise);
    return exercise;
  }

  async updateExercise(id: string, insertExercise: InsertExercise): Promise<Exercise | undefined> {
    const existing = this.exercises.get(id);
    if (!existing) return undefined;

    const updated: Exercise = { ...insertExercise, id };
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

export const storage = new MemStorage();
