import { getMuscleSetsMaintenance } from "../muscleGroupStats";

// 每週五星里程碑的單一定義處：儀表板、側邊欄、生涯全覽、週報告都走這裡。
// 先前三處各算各的（側邊欄甚至用「記錄筆數」代替訓練天數），同一週會出現不同星數。
// 星星是逐級累積的：必須完成第 N 級才算第 N+1 級。

export interface MilestoneMuscle {
  name: string;
  sets: number;
  volume: number;
  /** 該肌群的歷史週平均容量；0 = 還沒有比對基準，只看組數 */
  avgVolume: number;
}

export interface MilestoneInput {
  trainingDays: number;
  totalScore: number;
  careerAvgTotal: number;
  /** 這週排名（1 = 最好） */
  rank: number;
  totalWeeks: number;
  /** 這週之前最多 4 週的總分 */
  prevFourTotals: number[];
  /** 8 個肌群（不含有氧）的本週數據 */
  muscles: MilestoneMuscle[];
}

export interface MilestoneResult {
  hasEntry: boolean;
  hasDiscipline: boolean;
  totalAbove: boolean;
  allMusclesAtMaintenance: boolean;
  breakthrough: boolean;
  inTop10: boolean;
  isFourWeekHigh: boolean;
  percentile: number;
  trainingDays: number;
  musclesMetCount: number;
  musclesTotalCount: number;
  achievedCount: number;
}

export const DISCIPLINE_DAYS = 3;

export function computeMilestones(input: MilestoneInput): MilestoneResult {
  const { trainingDays, totalScore, careerAvgTotal, rank, totalWeeks, prevFourTotals, muscles } = input;

  const hasEntry = trainingDays >= 1;
  const hasDiscipline = trainingDays >= DISCIPLINE_DAYS;
  const totalAbove = careerAvgTotal > 0 && totalScore >= careerAvgTotal;

  const trained = muscles.filter((m) => m.sets > 0);
  const musclesMetCount = trained.filter(
    (m) => m.sets >= getMuscleSetsMaintenance(m.name) && (m.avgVolume <= 0 || m.volume >= m.avgVolume),
  ).length;
  const allMusclesAtMaintenance = trained.length > 0 && musclesMetCount / trained.length >= 0.5;

  const percentile = totalWeeks > 0 ? (rank / totalWeeks) * 100 : 100;
  const inTop10 = percentile <= 10;
  const isFourWeekHigh = totalScore > 0 && totalScore > Math.max(0, ...prevFourTotals);
  const breakthrough = inTop10 || isFourWeekHigh;

  const ladder = [hasEntry, hasDiscipline, totalAbove, allMusclesAtMaintenance, breakthrough];
  const firstMissed = ladder.indexOf(false);

  return {
    hasEntry,
    hasDiscipline,
    totalAbove,
    allMusclesAtMaintenance,
    breakthrough,
    inTop10,
    isFourWeekHigh,
    percentile,
    trainingDays,
    musclesMetCount,
    musclesTotalCount: trained.length,
    achievedCount: firstMissed === -1 ? ladder.length : firstMissed,
  };
}
