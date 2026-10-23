import type { ChangelogEntry } from "@/data/changelog";

// 版本歷程的分類與搜尋（純函式）。changelog 沒有 type 欄位，依版號與標題推：
//   x.0 = 重大；標題是修 bug／修正類 = 修正；其餘 = 新功能。
export type ChangeType = "major" | "minor" | "patch";

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = { major: "重大", minor: "新功能", patch: "修正" };

const FIX_PATTERN = /修|bug|錯誤|失敗|不會|問題/i;
const FEATURE_PATTERN = /新增|改版|升級|重構|整理|移除|設計/;

export function changeType(entry: Pick<ChangelogEntry, "version" | "title">): ChangeType {
  const [, minor = "0"] = entry.version.replace(/^v/, "").split(".");
  if (minor === "0") return "major";
  return FIX_PATTERN.test(entry.title) && !FEATURE_PATTERN.test(entry.title) ? "patch" : "minor";
}

export function filterVersions(entries: ChangelogEntry[], query: string, type: ChangeType | "all"): ChangelogEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (type === "all" || changeType(e) === type) &&
      (!q ||
        e.version.toLowerCase().includes(q) ||
        e.date.includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.items.some((item) => item.toLowerCase().includes(q))),
  );
}
