import { createHash, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";

// /api/public/summary 的存取金鑰：環境變數 SUMMARY_API_KEY 有設，就要求請求帶
// `x-summary-key`（或 `Authorization: Bearer`）且相符；沒設則維持舊行為並在啟動時
// 警告——讓「先部署程式、後設金鑰」的順序不會中斷 Aiportal 的拉取。
export function summaryKeyGuard(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.SUMMARY_API_KEY;
  if (!expected) return next();
  const bearer = /^Bearer (.+)$/i.exec(req.get("authorization") ?? "")?.[1];
  const got = req.get("x-summary-key") ?? bearer ?? "";
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) return res.status(401).json({ message: "unauthorized" });
  next();
}

if (!process.env.SUMMARY_API_KEY) {
  console.warn("[summary] SUMMARY_API_KEY 未設定：/api/public/summary 目前不需要金鑰");
}
