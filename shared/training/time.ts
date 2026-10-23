// 台北時區（UTC+8）的「日」計算。訓練量統計（ACWR、久未訓練）都以台北日曆日為單位，
// 這裡用「自 1970-01-01 起的天數」當日索引，日期加減直接做整數運算，不用處理月底/閏年。
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function taipeiDayIndex(date: Date | string | number): number {
  return Math.floor((new Date(date).getTime() + TAIPEI_OFFSET_MS) / DAY_MS);
}

export function dayIndexToKey(dayIndex: number): string {
  return new Date(dayIndex * DAY_MS).toISOString().slice(0, 10);
}
