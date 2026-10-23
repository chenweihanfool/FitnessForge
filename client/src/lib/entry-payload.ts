import type { Exercise, InsertWorkoutEntry } from "@shared/schema";

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

// 把表單資料轉成送給 API 的記錄：
//  - 「每周平均步数」表單輸入的是每日平均，記錄存的是週總步數，所以乘 7
//  - 表單的日期是 datetime-local（沒有時區）、代表台北時間，要換成真正的 UTC ISO 字串
export function toEntryPayload(data: InsertWorkoutEntry, exercise: Exercise | undefined): InsertWorkoutEntry {
  const payload = { ...data };
  if (exercise?.name === "每周平均步数") {
    payload.value = data.value * 7;
  }
  if (payload.date) {
    // 先當成 UTC 解析（補上秒與 Z），再減 8 小時才是真正的 UTC 時間
    const taipeiAsUtc = new Date(payload.date + ":00.000Z");
    payload.date = new Date(taipeiAsUtc.getTime() - TAIPEI_OFFSET_MS).toISOString();
  }
  return payload;
}
