// 日期顯示一律帶年份（2026/10/23），避免跨年時只看月日分不出是哪一年。
// 記錄日期統一用臺北時區（UTC+8）換算日曆日。
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** ISO 時間或 YYYY-MM-DD → "2026/10/23" */
export function formatDateWithYear(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/-/g, "/");
  const d = new Date(new Date(value).getTime() + TAIPEI_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
}
