import { useQuery } from "@tanstack/react-query";
import type { RankingData, WeeklyStats } from "@shared/schema";
import { MUSCLE_FIELDS } from "@shared/training/recovery";
import { RADAR_AXIS_AVG_KEYS } from "@shared/muscleGroupStats";
import { computeMilestones } from "@shared/training/milestones";
import type { DailyContributions, MuscleGroupAverages, MuscleGroupWeeklyStats } from "@/components/dashboard/types";

// 本週里程碑：儀表板與側邊欄共用同一份計算，星數才不會對不上。
// 資料都走 React Query 快取，同一頁重複呼叫不會多打 API。
export function useWeekMilestones() {
  const { data: ranking } = useQuery<RankingData>({ queryKey: ["/api/stats/ranking"] });
  const { data: trends } = useQuery<WeeklyStats[]>({ queryKey: ["/api/stats/trends"] });
  const { data: daily } = useQuery<DailyContributions>({ queryKey: ["/api/stats/daily-contributions"] });
  const { data: muscleStats } = useQuery<MuscleGroupWeeklyStats>({ queryKey: ["/api/stats/muscle-group-weekly"] });
  const { data: averages } = useQuery<MuscleGroupAverages>({ queryKey: ["/api/stats/muscle-group-averages"] });

  if (!ranking) return null;

  const muscles = MUSCLE_FIELDS.map(({ name }) => {
    const group = muscleStats?.muscleGroups.find((g) => g.muscleGroup === name);
    const avgKey = RADAR_AXIS_AVG_KEYS[name] as keyof MuscleGroupAverages;
    return {
      name,
      sets: group?.totalSets ?? 0,
      volume: group?.totalVolume ?? 0,
      avgVolume: averages ? Number(averages[avgKey]) || 0 : 0,
    };
  });

  const currentTotal = ranking.currentWeek?.totalBaselineValue || 0;
  const avgTotal = ranking.averageWeeklyValue || 0;

  return {
    ...computeMilestones({
      trainingDays: daily?.dailyData.filter((d) => d.entryCount > 0).length ?? 0,
      totalScore: currentTotal,
      careerAvgTotal: avgTotal,
      rank: ranking.rank || ranking.totalWeeks || 1,
      totalWeeks: ranking.totalWeeks || 1,
      prevFourTotals: (trends ?? []).slice(-5, -1).map((w) => w.totalBaselineValue),
      muscles,
    }),
    currentTotal,
    avgTotal,
  };
}
