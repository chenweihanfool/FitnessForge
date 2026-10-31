import { DISCIPLINE_DAYS } from "./milestones";

// 連續達標：連續幾週訓練滿 3 天（里程碑的「紀律」門檻）。
// 進行中的週還沒達標時不算中斷，達標了就加一週。

export interface StreakWeek {
  trainingDays: number;
  inProgress?: boolean;
}

export interface StreakResult {
  current: number;
  best: number;
  /** 達標門檻（天） */
  target: number;
}

/** @param weeks 由舊到新、連續的週（中間沒練的週也要列） */
export function computeStreak(weeks: StreakWeek[]): StreakResult {
  let best = 0;
  let run = 0;
  for (const week of weeks) {
    if (week.trainingDays >= DISCIPLINE_DAYS) {
      run++;
      best = Math.max(best, run);
    } else if (!week.inProgress) {
      run = 0;
    }
  }
  return { current: run, best, target: DISCIPLINE_DAYS };
}
