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
