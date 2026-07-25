// 各肌群「週維持組數」基準 — 取代原本所有肌群統一套用的 SETS_MAINTENANCE = 4。
// 大肌群（胸/背/腿）在多關節複合動作裡本身就承受較大訓練量，直接組數基準較高；
// 小肌群（二頭/三頭）在推/拉類複合動作中已經有相當程度的間接刺激，直接組數
// 基準較低；肩/核心/臀則介於中間。這組數字是常見肌力訓練文獻裡「維持」
// （非增肌）等級週訓練量的概略區間，非精確醫學/科學結論，可依個人訓練哲學調整。
export const MUSCLE_SETS_MAINTENANCE: Record<string, number> = {
  '胸': 6,
  '背': 6,
  '腿': 6,
  '肩': 4,
  '二头肌': 3,
  '核心': 4,
  '臀': 4,
  '三头肌': 3,
};

export function getMuscleSetsMaintenance(muscleName: string): number {
  return MUSCLE_SETS_MAINTENANCE[muscleName] ?? 4;
}

export interface MuscleCompositeScore {
  setsPct: number;
  volumePct: number | null;
  composite: number;
}

// 組數分 40% + 容量分 60%（若有個人歷史容量資料可比對），否則單純看組數分。
export function computeMuscleCompositeScore(
  muscleName: string,
  sets: number,
  volume: number,
  avgVolume: number,
): MuscleCompositeScore {
  const setsMaintenance = getMuscleSetsMaintenance(muscleName);
  const setsPct = Math.min(Math.round((sets / setsMaintenance) * 100), 150);
  const volumePct = avgVolume > 0 ? Math.min(Math.round((volume / avgVolume) * 100), 150) : null;
  const composite = volumePct !== null
    ? Math.round(0.4 * setsPct + 0.6 * volumePct)
    : setsPct;

  return { setsPct, volumePct, composite };
}

// 均衡度分數 = 最弱肌群複合分 ÷ 最強肌群複合分。
// 用「最弱/最強比值」而非平均或標準差，是因為均衡度的痛點通常是那條最短的
// 木板（哪個肌群被嚴重忽略），不是整體離散程度——只有一兩個肌群落後很多，
// 其餘都接近滿分時，標準差可能還好看，但體感上是「明顯不均衡」，比值能
// 直接反映這件事。只計入有歷史容量資料（avgVolume > 0）可比對的肌群，跟
// 「系統建議：最需加強的肌群」使用相同的篩選條件，避免把「還沒有基準可比」
// 的肌群當成拉低分數的異常值。
export function computeBalanceScore(
  composites: { name: string; composite: number; hasVolumeHistory: boolean }[],
): number | null {
  const comparable = composites.filter(c => c.hasVolumeHistory);
  if (comparable.length < 2) return null;

  const values = comparable.map(c => c.composite);
  const max = Math.max(...values);
  if (max <= 0) return null;
  const min = Math.min(...values);

  return Math.round((min / max) * 100);
}
