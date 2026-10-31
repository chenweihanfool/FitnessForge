import { useState } from "react";
import { Award, Dumbbell, Footprints, Heart } from "lucide-react";
import type { RankingData } from "@shared/schema";
import { RankingDetailDialog, fetchRankingDetail } from "@/components/ranking-detail-dialog";
import { RankingMetricCard } from "@/components/ranking-metric-card";
import { queryClient } from "@/lib/queryClient";

export function RankingTab({ rankingData }: { rankingData?: RankingData }) {
  const [rankingDetailMetric, setRankingDetailMetric] = useState<'total' | 'strength' | 'cardio' | 'activity' | null>(null);

  const prefetchRankingDetail = (metric: 'total' | 'strength' | 'cardio' | 'activity') => {
    queryClient.prefetchQuery({ queryKey: ['/api/stats/ranking-detail', metric], queryFn: fetchRankingDetail(metric) });
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="grid-rankings">
              {rankingData && rankingData.totalWeeks > 0 && (
                <>
                  <RankingMetricCard
                    title="總分排名"
                    icon={Award}
                    rank={rankingData.rank}
                    totalWeeks={rankingData.totalWeeks}
                    currentValue={rankingData.currentWeek.totalBaselineValue}
                    averageValue={rankingData.averageWeeklyValue}
                    topValue={rankingData.topWeekTotalValue}
                    onClick={() => setRankingDetailMetric('total')}
                    onMouseEnter={() => prefetchRankingDetail('total')}
                    testId="card-total-rank"
                  />
                  <RankingMetricCard
                    title="力量排名"
                    icon={Dumbbell}
                    rank={rankingData.strengthRank}
                    totalWeeks={rankingData.totalWeeks}
                    currentValue={rankingData.currentWeek.strengthValue}
                    averageValue={rankingData.averageStrengthValue}
                    topValue={rankingData.topWeekStrengthValue}
                    onClick={() => setRankingDetailMetric('strength')}
                    onMouseEnter={() => prefetchRankingDetail('strength')}
                    testId="card-strength-rank"
                  />
                  <RankingMetricCard
                    title="有氧排名"
                    icon={Heart}
                    rank={rankingData.cardioRank}
                    totalWeeks={rankingData.totalWeeks}
                    currentValue={rankingData.currentWeek.cardioValue}
                    averageValue={rankingData.averageCardioValue}
                    topValue={rankingData.topWeekCardioValue}
                    onClick={() => setRankingDetailMetric('cardio')}
                    onMouseEnter={() => prefetchRankingDetail('cardio')}
                    testId="card-cardio-rank"
                  />
                  <RankingMetricCard
                    title="活動量排名"
                    icon={Footprints}
                    rank={rankingData.activityRank}
                    totalWeeks={rankingData.totalWeeks}
                    currentValue={rankingData.currentWeek.activityValue}
                    averageValue={rankingData.averageActivityValue}
                    topValue={rankingData.topWeekActivityValue}
                    onClick={() => setRankingDetailMetric('activity')}
                    onMouseEnter={() => prefetchRankingDetail('activity')}
                    testId="card-activity-rank"
                  />
                </>
              )}
      </div>
      {rankingDetailMetric && (
        <RankingDetailDialog
          open={!!rankingDetailMetric}
          onOpenChange={(open) => !open && setRankingDetailMetric(null)}
          metric={rankingDetailMetric}
        />
      )}
    </>
  );
}
