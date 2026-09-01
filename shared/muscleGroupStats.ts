// 各肌群「週維持組數」基準 — 取代原本所有肌群統一套用的 SETS_MAINTENANCE = 4。
// 大肌群（胸/背/腿）在多關節複合動作裡本身就承受較大訓練量，直接組數基準較高；
// 小肌群（二頭/三頭）在推/拉類複合動作中已經有相當程度的間接刺激，直接組數
// 基準較低；肩/核心/臀則介於中間。這組數字是常見肌力訓練文獻裡「維持」
// （非增肌）等級週訓練量的概略區間，非精確醫學/科學結論，可依個人訓練哲學調整。
// 「有氧」跟其他 8 項不是同一個單位——沒有「組數」概念，這裡借用同一個
// 「本週數值 ÷ 週基準」的比例算法，但基準換成「本週有氧分鐘數 ÷ 60 分鐘」
// （約每週 2 次 × 30 分鐘的維持量，非官方運動指引的最適量，是「維持」等級
// 的保守基準，跟其他肌群同樣走「維持」而非「最適」的定位）。
export const MUSCLE_SETS_MAINTENANCE: Record<string, number> = {
  '胸': 6,
  '背': 6,
  '腿': 6,
  '肩': 4,
  '二头肌': 3,
  '核心': 4,
  '臀': 4,
  '三头肌': 3,
  '有氧': 60,
};

// 雷達圖 9 軸的顯示順序（8 個肌群 + 有氧）。面積公式（computeCoverageScore）
// 看的是「相鄰軸」，順序必須跟畫面上雷達圖畫的軸序一致。
export const RADAR_AXIS_NAMES = ['胸', '背', '腿', '肩', '二头肌', '核心', '臀', '三头肌', '有氧'] as const;

// weeklyMuscleStats 資料表裡每個軸對應的欄位名稱。
export const RADAR_AXIS_STAT_KEYS: Record<string, string> = {
  '胸': 'chestValue', '背': 'backValue', '腿': 'legsValue', '肩': 'shouldersValue',
  '二头肌': 'armsValue', '核心': 'coreValue', '臀': 'glutesValue', '三头肌': 'fullBodyValue',
  '有氧': 'aerobicValue',
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

// 均衡度分數 = 後段（最弱 bottomN 個）肌群複合分平均 ÷ 最強肌群複合分。
// 原本用「最弱/最強比值」（只看單一最低值），實測回報：一週訓練循環
// （split）裡本來就常有一兩個肌群那幾天輪不到，單一最弱值一抓到 0 就直接把
// 整個均衡分砍到 0，而且是規律訓練也逃不掉的結構性問題，不是真的不均衡。
// 改成看「最弱 bottomN 個的平均」（預設 2 個）而非只看那一個最低值，單一
// 肌群剛好沒被這個窗口捕捉到不會再直接把分數砍到 0，但如果同時有兩個以上
// 肌群持續被忽略，分數還是會如實偏低——跟原本「找出最短木板」的精神一致，
// 只是不再對單一一塊木板的雜訊那麼敏感。bottomN 排除最強值本身（取
// values.length - 1 為上限），確保「最弱幾個」不會把最強值也算進去、稀釋掉
// 比較基準。只計入有歷史容量資料（avgVolume > 0）可比對的肌群，跟「系統建
// 議：最需加強的肌群」使用相同的篩選條件，避免把「還沒有基準可比」的肌群當
// 成拉低分數的異常值。
export function computeBalanceScore(
  composites: { name: string; composite: number; hasVolumeHistory: boolean }[],
  bottomN: number = 2,
): number | null {
  const comparable = composites.filter(c => c.hasVolumeHistory);
  if (comparable.length < 2) return null;

  const values = comparable.map(c => c.composite).sort((a, b) => a - b);
  const max = values[values.length - 1];
  if (max <= 0) return null;

  const n = Math.max(1, Math.min(bottomN, values.length - 1));
  const bottomAvg = values.slice(0, n).reduce((sum, v) => sum + v, 0) / n;

  return Math.round((bottomAvg / max) * 100);
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

// 活動量（例如「每周平均步數」）加成——不當成第 10 軸放進雷達圖本體（活動量
// 沒有「肌群」的同儕關係，硬塞進去會混淆雷達圖原本「肌群+有氧訓練分布」的
// 語意，均衡度也不該把它算進「最弱/最強比值」），而是讓它加成覆蓋分數，且
// 加成必須顯示在畫面上（標示「+X% 活動量」），不能是看不出來源的暗中加分。
//
// activityComposite 是「本週活動量 ÷ 歷史平均活動量」的達成率（0-100+），呼叫端
// 自行算好傳入；這裡封頂在 100（活動量再超標也不會多拿加成，因為它終究只是
// 加成不是本體，跟其他 9 軸可以衝到 150% 不同）。
export function applyActivityBonus(
  coverageScore: number | null,
  activityComposite: number,
  capPoints: number = 10,
): { adjustedCoverage: number | null; bonusPoints: number } {
  const cappedComposite = Math.max(0, Math.min(activityComposite, 100));
  const bonusPoints = Math.round((cappedComposite / 100) * capPoints);
  const adjustedCoverage = coverageScore === null ? null : coverageScore + bonusPoints;
  return { adjustedCoverage, bonusPoints };
}
