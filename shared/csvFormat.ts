// 記錄 CSV 的欄位格式，匯出與匯入共用同一份，欄名才不會兩邊各改各的。
// 匯入同時接受舊版簡體表頭與英文表頭：使用者手上可能留著以前匯出的檔案。
export const CSV_HEADERS = {
  name: "運動名稱",
  unit: "單位",
  weightFactor: "重量係數",
  value: "資料值",
  date: "日期",
  notes: "備註",
} as const;

const LEGACY_HEADERS: Record<keyof typeof CSV_HEADERS, string> = {
  name: "运动名称",
  unit: "单位",
  weightFactor: "重量系数",
  value: "数据值",
  date: "日期",
  notes: "备注",
};

export interface CsvEntryRow {
  name: string;
  unit: string;
  weightFactor: number;
  value: number;
  date: string;
  notes: string;
}

/** 解析一列；缺必要欄位時回 null */
export function parseCsvRow(row: Record<string, string | undefined>): CsvEntryRow | null {
  const read = (key: keyof typeof CSV_HEADERS) => row[CSV_HEADERS[key]] || row[LEGACY_HEADERS[key]] || row[key];
  const name = read("name");
  const unit = read("unit");
  const value = parseFloat(read("value") ?? "");
  const date = read("date");
  if (!name || !unit || Number.isNaN(value) || !date) return null;
  const weightFactor = parseFloat(read("weightFactor") || "1");
  return { name, unit, weightFactor: Number.isNaN(weightFactor) ? 1 : weightFactor, value, date, notes: read("notes") ?? "" };
}
