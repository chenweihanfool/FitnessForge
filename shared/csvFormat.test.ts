import assert from "node:assert/strict";
import { test } from "node:test";
import { CSV_HEADERS, parseCsvRow } from "./csvFormat";

const expected = { name: "深蹲", unit: "次", weightFactor: 70, value: 8, date: "2026-10-20 12:00", notes: "腿" };

test("匯出的表頭可以直接匯入", () => {
  const row = Object.fromEntries(Object.entries(CSV_HEADERS).map(([key, header]) => [header, String(expected[key as keyof typeof expected])]));
  assert.deepEqual(parseCsvRow(row), expected);
});

test("舊版簡體表頭與英文表頭都接受", () => {
  assert.deepEqual(parseCsvRow({ "运动名称": "深蹲", "单位": "次", "重量系数": "70", "数据值": "8", "日期": "2026-10-20 12:00", "备注": "腿" }), expected);
  assert.deepEqual(parseCsvRow({ name: "深蹲", unit: "次", weightFactor: "70", value: "8", date: "2026-10-20 12:00", notes: "腿" }), expected);
});

test("缺必要欄位回 null，重量係數預設 1", () => {
  assert.equal(parseCsvRow({ "運動名稱": "深蹲" }), null);
  assert.equal(parseCsvRow({ "運動名稱": "深蹲", "單位": "次", "資料值": "abc", "日期": "2026-10-20" }), null);
  assert.equal(parseCsvRow({ "運動名稱": "深蹲", "單位": "次", "資料值": "8", "日期": "2026-10-20" })?.weightFactor, 1);
});
