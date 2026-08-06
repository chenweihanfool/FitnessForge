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
//
// weekProgress（預設 1 = 不調整，維持既有呼叫端行為不變）：把整週基準
// （setsMaintenance／avgVolume）依「本週已過幾分之幾」等比縮小再比較，這樣
// 才是跟「配速」比，不是跟「整週終點」比。只有 storage.ts 的
// getPublicSummary()（餵給 Aiportal 幸福指數卡片的 habitIndex）會傳入實際
// 配速值；其餘呼叫端（雷達快照、前端即時雷達圖）維持看「本週至今相對整週
// 基準」的原始語意，沒有一併改。
export function computeMuscleCompositeScore(
  muscleName: string,
  sets: number,
  volume: number,
  avgVolume: number,
  weekProgress: number = 1,
): MuscleCompositeScore {
  const setsMaintenance = getMuscleSetsMaintenance(muscleName) * weekProgress;
  const pacedAvgVolume = avgVolume * weekProgress;
  const setsPct = Math.min(Math.round((sets / setsMaintenance) * 100), 150);
  const volumePct = pacedAvgVolume > 0 ? Math.min(Math.round((volume / pacedAvgVolume) * 100), 150) : null;
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

// 覆蓋分數 = 雷達圖多邊形面積 ÷ 「每軸都剛好 100%」時的面積，越接近/超過 100%
// 代表整體訓練量越飽滿。用真正的多邊形面積公式（½ × sin(2π/N) × Σ相鄰軸相乘），
// 不是簡單平均——這樣才會跟你視覺上看到的雷達圖形狀大小直接對應：兩個肌群
// 都是 75% 的面積，會小於一個 100% 一個 50% 的面積（因為面積跟相鄰軸的乘積
// 有關，不是線性的），這跟均衡度分數（只看最弱/最強比值，不管整體大小）是
// 互補的兩個指標，不是同一件事的兩種算法。
//
// 用全部肌群（包含還沒有歷史容量資料、composite 退回只看組數分的），因為
// 雷達圖本身畫的就是全部軸，覆蓋分數要跟畫面上看到的形狀一致。陣列順序必須
// 跟雷達圖畫的順序一致，因為面積公式看的是「相鄰軸」的乘積。
export function computeCoverageScore(compositesInChartOrder: number[]): number | null {
  const n = compositesInChartOrder.length;
  if (n < 3) return null; // 面積公式至少需要三個軸才有意義

  const angleStep = (2 * Math.PI) / n;
  const sinStep = Math.sin(angleStep);

  const actualArea = compositesInChartOrder.reduce((sum, r, i) => {
    const rNext = compositesInChartOrder[(i + 1) % n];
    return sum + r * rNext;
  }, 0) * 0.5 * sinStep;

  const baselineArea = 0.5 * sinStep * n * (100 * 100); // 每軸都剛好 100%（維持基準）時的面積
  if (baselineArea <= 0) return null;

  return Math.round((actualArea / baselineArea) * 100);
}
