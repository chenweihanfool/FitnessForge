import { pgTable, text, varchar, real, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";
import { sql } from "drizzle-orm";

// 运动类型表
export const exercises = pgTable("exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // 单位，如 "次"、"公斤"、"分钟"等
  weightFactor: real("weight_factor").notNull().default(1), // 重量转换系数，用于标准化计算
  category: text("category"), // 运动分类，如 "力量"、"有氧"、"柔韧性"等
});

// 定义camelCase的insert schema
export const insertExerciseSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  weightFactor: z.number().default(1),
  category: z.string().optional(),
});

// 运动记录表
export const workoutEntries = pgTable("workout_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: varchar("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  value: real("value").notNull(), // 运动数据值
  date: timestamp("date").notNull().defaultNow(), // 记录日期时间
  notes: text("notes"), // 可选备注
});

export const insertWorkoutEntrySchema = z.object({
  exerciseId: z.string(),
  value: z.number(),
  date: z.string().optional(), // 允许从前端传递ISO日期字符串
  notes: z.string().optional(),
});

// 类型定义
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercises.$inferSelect;

export type InsertWorkoutEntry = z.infer<typeof insertWorkoutEntrySchema>;
export type WorkoutEntry = typeof workoutEntries.$inferSelect;

// 扩展类型：带有运动信息的记录
export type WorkoutEntryWithExercise = WorkoutEntry & {
  exercise: Exercise;
};

// 周统计数据类型
export type WeeklyStats = {
  weekStart: string; // ISO日期字符串
  weekEnd: string;
  totalBaselineValue: number; // 基准值总和（数据 × 重量系数）
  entryCount: number; // 记录数量
  strengthValue: number; // 力量分类基准值
  cardioValue: number; // 有氧分类基准值
  activityValue: number; // 活动量分类基准值
};

// 排名数据类型
export type RankingData = {
  currentWeek: WeeklyStats;
  bestWeek: WeeklyStats | null;
  worstWeek: WeeklyStats | null;
  averageWeeklyValue: number;
  averageStrengthValue: number; // 力量分类平均值
  averageCardioValue: number; // 有氧分类平均值
  averageActivityValue: number; // 活动量分类平均值
  rank: number; // 当前周在历史中的排名（1=最好）
  totalWeeks: number; // 总周数
  strengthRank: number; // 力量分类排名
  cardioRank: number; // 有氧分类排名
  activityRank: number; // 活动量分类排名
  topWeekTotalValue: number; // 总分第一名的数值
  topWeekStrengthValue: number; // 力量第一名的数值
  topWeekCardioValue: number; // 有氧第一名的数值
  topWeekActivityValue: number; // 活动量第一名的数值
};

// 排名快照类型（用于排名详情）
export type RankingSnapshot = {
  weekStart: string;
  weekEnd: string;
  year: number;
  weekNumber: number;
  rank: number;
  value: number;
};

// 排名详情响应类型
export type RankingDetailResponse = {
  metric: 'total' | 'strength' | 'cardio' | 'activity';
  current: RankingSnapshot;
  surrounding: RankingSnapshot[];
};
