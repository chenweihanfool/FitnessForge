import { pgTable, text, varchar, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// 运动类型表
export const exercises = pgTable("exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // 单位，如 "次"、"公斤"、"分钟"等
  weightFactor: real("weight_factor").notNull().default(1), // 重量转换系数，用于标准化计算
});

// 运动记录表
export const workoutEntries = pgTable("workout_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: varchar("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  value: real("value").notNull(), // 运动数据值
  date: timestamp("date").notNull().defaultNow(), // 记录日期时间
  notes: text("notes"), // 可选备注
});

// 插入schemas
export const insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
});

export const insertWorkoutEntrySchema = createInsertSchema(workoutEntries).omit({
  id: true,
}).extend({
  date: z.string().optional(), // 允许从前端传递ISO日期字符串
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
};

// 排名数据类型
export type RankingData = {
  currentWeek: WeeklyStats;
  bestWeek: WeeklyStats | null;
  worstWeek: WeeklyStats | null;
  averageWeeklyValue: number;
  rank: number; // 当前周在历史中的排名（1=最好）
  totalWeeks: number; // 总周数
};
