import { pgTable, text, varchar, real, timestamp, boolean, json, index } from "drizzle-orm/pg-core";
import { z } from "zod";
import { sql } from "drizzle-orm";

// 运动类型表
export const exercises = pgTable("exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // 单位，如 "次"、"公斤"、"分钟"等
  weightFactor: real("weight_factor").notNull().default(1), // 重量转换系数，用于标准化计算
  category: text("category"), // 运动分类，如 "力量"、"有氧"、"柔韧性"等
  splitCategory: text("split_category"), // 次要分类，用于混合运动（如"跑步機負重"需要分配部分基准值到力量）
  splitRatio: real("split_ratio").default(0), // 分配给次要分类的比例（0-1），默认0表示不分配
  muscleChest: real("muscle_chest").default(0), // 胸部肌群百分比 (0-100)
  muscleBack: real("muscle_back").default(0), // 背部肌群百分比 (0-100)
  muscleLegs: real("muscle_legs").default(0), // 腿部肌群百分比 (0-100)
  muscleShoulders: real("muscle_shoulders").default(0), // 肩部肌群百分比 (0-100)
  muscleArms: real("muscle_arms").default(0), // 手臂肌群百分比 (0-100)
  muscleCore: real("muscle_core").default(0), // 核心肌群百分比 (0-100)
  muscleGlutes: real("muscle_glutes").default(0), // 臀部肌群百分比 (0-100)
  muscleFullBody: real("muscle_full_body").default(0), // 全身肌群百分比 (0-100)
  movementCoefficient: real("movement_coefficient").default(1.0), // 动作系数（复合1.2/孤立0.8/徒手1.0）
  intensityFactor: real("intensity_factor").default(1.0), // 强度因子（有氧用：轻松1.0/节奏1.5/高强度2.0）
});

// 定义camelCase的insert schema
export const insertExerciseSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  weightFactor: z.number().default(1),
  category: z.string().optional(),
  splitCategory: z.string().optional(),
  splitRatio: z.number().min(0).max(1).default(0),
  muscleChest: z.number().min(0).max(100).default(0),
  muscleBack: z.number().min(0).max(100).default(0),
  muscleLegs: z.number().min(0).max(100).default(0),
  muscleShoulders: z.number().min(0).max(100).default(0),
  muscleArms: z.number().min(0).max(100).default(0),
  muscleCore: z.number().min(0).max(100).default(0),
  muscleGlutes: z.number().min(0).max(100).default(0),
  muscleFullBody: z.number().min(0).max(100).default(0),
  movementCoefficient: z.number().min(0.1).max(5).default(1.0),
  intensityFactor: z.number().min(0.1).max(5).default(1.0),
});

// 运动记录表
export const workoutEntries = pgTable("workout_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: varchar("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  value: real("value").notNull(), // 运动数据值
  sets: real("sets"), // 组数（可选）
  weightFactor: real("weight_factor"), // 本次记录使用的权重因子（可能与运动默认权重不同）
  baselineValue: real("baseline_value"), // 基准值（创建时计算并固定：value × sets × weightFactor）
  date: timestamp("date").notNull().defaultNow(), // 记录日期时间
  notes: text("notes"), // 可选备注
});

export const insertWorkoutEntrySchema = z.object({
  exerciseId: z.string(),
  value: z.number(),
  sets: z.number().optional(), // 组数（可选）
  weightFactor: z.number().optional(), // 动态权重（可选，覆盖运动类型的默认权重）
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

// 每周肌群训练统计表
export const weeklyMuscleStats = pgTable("weekly_muscle_stats", {
  weekStart: varchar("week_start").primaryKey(), // ISO日期字符串，如 "2024-01-15"
  chestValue: real("chest_value").notNull().default(0), // 胸部肌群训练基准值
  backValue: real("back_value").notNull().default(0), // 背部肌群训练基准值
  legsValue: real("legs_value").notNull().default(0), // 腿部肌群训练基准值
  shouldersValue: real("shoulders_value").notNull().default(0), // 肩部肌群训练基准值
  armsValue: real("arms_value").notNull().default(0), // 手臂肌群训练基准值
  coreValue: real("core_value").notNull().default(0), // 核心肌群训练基准值
  glutesValue: real("glutes_value").notNull().default(0), // 臀部肌群训练基准值
  fullBodyValue: real("full_body_value").notNull().default(0), // 全身/三头肌训练基准值
  updatedAt: timestamp("updated_at").notNull().defaultNow(), // 最后更新时间
});

export const insertWeeklyMuscleStatsSchema = z.object({
  weekStart: z.string(),
  chestValue: z.number().default(0),
  backValue: z.number().default(0),
  legsValue: z.number().default(0),
  shouldersValue: z.number().default(0),
  armsValue: z.number().default(0),
  coreValue: z.number().default(0),
  glutesValue: z.number().default(0),
  fullBodyValue: z.number().default(0),
});

export type InsertWeeklyMuscleStats = z.infer<typeof insertWeeklyMuscleStatsSchema>;
export type WeeklyMuscleStats = typeof weeklyMuscleStats.$inferSelect;

// 用户设置表（用于存储权重比例等配置）
export const userSettings = pgTable("user_settings", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull(),
});

export type UserSetting = typeof userSettings.$inferSelect;

// 每周训练计划表
export const weeklyPlans = pgTable("weekly_plans", {
  weekStart: varchar("week_start").primaryKey(),
  mode: text("mode").notNull(), // 'recovery' | 'normal'
  planJson: text("plan_json").notNull(), // JSON array of daily plan items
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const insertWeeklyPlanSchema = z.object({
  weekStart: z.string(),
  mode: z.enum(['recovery', 'normal']),
  planJson: z.string(),
});

export type InsertWeeklyPlan = z.infer<typeof insertWeeklyPlanSchema>;
export type WeeklyPlan = typeof weeklyPlans.$inferSelect;

export type PlanDayItem = {
  day: number;
  dayName: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    targetValue: number;
    targetSets: number;
    unit: string;
    category: string | null;
    weeklyContrib?: number;
    reason?: string;
    historyRef?: string;
  }>;
};

export type PlanItemStatus = 'met' | 'partial' | 'not_met';

export type PlanProgress = {
  weekStart: string;
  mode: string;
  generatedAt: string;
  days: Array<PlanDayItem & {
    exercises: Array<{
      exerciseId: string;
      exerciseName: string;
      targetValue: number;
      targetSets: number;
      unit: string;
      category: string | null;
      weeklyContrib?: number;
      reason?: string;
      historyRef?: string;
      targetItemBaseline?: number;
      weightFactor?: number;
      actualValue: number;
      actualSets: number;
      actualBaselineValue?: number;
      status: PlanItemStatus;
    }>;
  }>;
  totalPlanned: number;
  totalMet: number;
  completionPercentage: number;
  targetBaseline: number;
  actualBaseline: number;
  baselinePercentage: number;
};

// ==================== 用戶認證表 ====================

export const users = pgTable("users", {
  replitUserId: varchar("replit_user_id").primaryKey(),
  username: text("username").notNull(),
  role: text("role").notNull().default("user"), // 'admin' | 'user'
  profileImage: text("profile_image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 白名單表
export const whitelist = pgTable("whitelist", {
  username: varchar("username").primaryKey(),
  addedBy: text("added_by").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  note: text("note"),
});

export type WhitelistEntry = typeof whitelist.$inferSelect;
export type InsertWhitelistEntry = typeof whitelist.$inferInsert;

// 雷達圖快照表
export const radarSnapshots = pgTable("radar_snapshots", {
  weekStart: varchar("week_start").primaryKey(),
  scoresJson: text("scores_json").notNull(), // JSON: { [muscleName]: compositeScore }
  recommendationsJson: text("recommendations_json").notNull(), // JSON: string[]
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type RadarSnapshot = typeof radarSnapshots.$inferSelect;
export type InsertRadarSnapshot = typeof radarSnapshots.$inferInsert;

export type RadarScores = Record<string, number>;

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
  careerAverage: number; // 生涯平均值（基于所有历史周数据）
};

// Session 表 — 由 connect-pg-simple 讀寫，由 Drizzle 管理建立
// 欄位型別必須與 connect-pg-simple 預期完全一致
export const sessionTable = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (t) => [
  index("IDX_session_expire").on(t.expire),
]);
