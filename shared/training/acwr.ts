import { dayIndexToKey, taipeiDayIndex } from "./time";

// ACWR（Acute:Chronic Workload Ratio，急慢性負荷比）：
//   急性負荷 = 最近 7 天的訓練量加總
//   慢性負荷 = 最近 28 天訓練量加總 ÷ 4（= 過去四週的「週平均」）
//   ACWR     = 急性 ÷ 慢性
// 本週比身體已適應的程度高越多，受傷/過度疲勞風險越高。分區採運動科學文獻常用門檻
// （Gabbett 2016）：<0.8 訓練不足、0.8–1.3 甜蜜點、1.3–1.5 注意、>1.5 高風險。
// 這是風險「參考」不是診斷，所以 UI 上一律用建議語氣。

export const ACUTE_DAYS = 7;
export const CHRONIC_DAYS = 28;
export const ACWR_SWEET_LOW = 0.8;
export const ACWR_SWEET_HIGH = 1.3;
export const ACWR_DANGER = 1.5;

export type AcwrZone = "insufficient" | "low" | "optimal" | "caution" | "danger";

export interface DailyLoadInput {
  date: Date | string;
  load: number;
}

export interface AcwrPoint {
  date: string; // YYYY-MM-DD（台北）
  acute: number;
  chronic: number; // 週平均
  /** 站穩前（歷史 < 28 天）或慢性負荷為 0 時為 null */
  ratio: number | null;
}

export interface AcwrResult {
  acute: number;
  chronic: number;
  ratio: number | null;
  zone: AcwrZone;
  /** 從第一筆記錄到今天共幾天；不足 28 天時慢性負荷還沒「站穩」，比值只能參考 */
  historyDays: number;
  /** 在不超過 1.3 的前提下，這 7 天最多還能再加多少訓練量（>= 0） */
  headroom: number | null;
  series: AcwrPoint[];
}

export function classifyAcwr(ratio: number | null, reliable: boolean): AcwrZone {
  if (ratio === null || !reliable) return "insufficient";
  if (ratio < ACWR_SWEET_LOW) return "low";
  if (ratio <= ACWR_SWEET_HIGH) return "optimal";
  if (ratio <= ACWR_DANGER) return "caution";
  return "danger";
}

/**
 * @param loads    逐筆訓練量（同一天可以有多筆，內部會加總成日負荷）
 * @param today    計算基準日（預設現在）
 * @param seriesDays 回傳趨勢線的天數（含今天）
 */
export function computeAcwr(
  loads: DailyLoadInput[],
  today: Date = new Date(),
  seriesDays = 56,
): AcwrResult {
  const todayIdx = taipeiDayIndex(today);
  const daily = new Map<number, number>();
  let firstIdx: number | null = null;
  for (const { date, load } of loads) {
    if (!(load > 0)) continue;
    const idx = taipeiDayIndex(date);
    if (idx > todayIdx) continue; // 未來日期的記錄不算
    daily.set(idx, (daily.get(idx) ?? 0) + load);
    if (firstIdx === null || idx < firstIdx) firstIdx = idx;
  }

  const sumRange = (endIdx: number, days: number) => {
    let s = 0;
    for (let i = endIdx - days + 1; i <= endIdx; i++) s += daily.get(i) ?? 0;
    return s;
  };
  const snapshot = (idx: number) => {
    const acute = sumRange(idx, ACUTE_DAYS);
    const chronic = sumRange(idx, CHRONIC_DAYS) / (CHRONIC_DAYS / ACUTE_DAYS);
    const reliable = firstIdx !== null && idx - firstIdx + 1 >= CHRONIC_DAYS;
    const ratio = chronic > 0 ? acute / chronic : null;
    return { acute, chronic, ratio, reliable };
  };

  const series: AcwrPoint[] = [];
  for (let idx = todayIdx - seriesDays + 1; idx <= todayIdx; idx++) {
    if (firstIdx === null || idx < firstIdx) continue;
    const s = snapshot(idx);
    series.push({
      date: dayIndexToKey(idx),
      acute: round1(s.acute),
      chronic: round1(s.chronic),
      // 歷史還不到 28 天時慢性負荷沒站穩，比值會被放大得很誇張，趨勢線不畫這段
      ratio: s.ratio === null || !s.reliable ? null : round2(s.ratio),
    });
  }

  const now = snapshot(todayIdx);
  const historyDays = firstIdx === null ? 0 : todayIdx - firstIdx + 1;
  return {
    acute: round1(now.acute),
    chronic: round1(now.chronic),
    ratio: now.ratio === null ? null : round2(now.ratio),
    zone: classifyAcwr(now.ratio, now.reliable),
    historyDays,
    headroom:
      now.reliable && now.chronic > 0
        ? Math.max(0, round1(now.chronic * ACWR_SWEET_HIGH - now.acute))
        : null,
    series,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
