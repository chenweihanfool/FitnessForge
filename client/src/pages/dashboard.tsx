import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/stats-card";
import { RankingCard } from "@/components/ranking-card";
import { TrendChart } from "@/components/trend-chart";
import { Activity, TrendingUp, Calendar, Award } from "lucide-react";
import { RankingData, WeeklyStats } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const { data: rankingData, isLoading: rankingLoading } = useQuery<RankingData>({
    queryKey: ["/api/stats/ranking"],
  });

  const { data: trendData, isLoading: trendLoading } = useQuery<WeeklyStats[]>({
    queryKey: ["/api/stats/trends"],
  });

  if (rankingLoading || trendLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">仪表板</h1>
          <p className="text-muted-foreground mt-2">查看您的运动数据和进展</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const currentWeekValue = rankingData?.currentWeek?.totalBaselineValue || 0;
  const previousWeekValue = trendData && trendData.length > 1 
    ? trendData[trendData.length - 2].totalBaselineValue 
    : 0;
  const weeklyChange = previousWeekValue > 0
    ? ((currentWeekValue - previousWeekValue) / previousWeekValue) * 100
    : 0;

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <div>
        <h1 className="text-3xl font-bold">仪表板</h1>
        <p className="text-muted-foreground mt-2">查看您的运动数据和进展</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="本周基准值"
          value={currentWeekValue.toFixed(1)}
          subtitle="数据 × 重量系数总和"
          icon={Activity}
          trend={{
            value: Math.abs(weeklyChange),
            isPositive: weeklyChange >= 0,
          }}
          testId="card-current-week"
        />
        <StatsCard
          title="本周记录数"
          value={rankingData?.currentWeek?.entryCount || 0}
          subtitle="运动记录次数"
          icon={Calendar}
          testId="card-entry-count"
        />
        <StatsCard
          title="历史最佳"
          value={rankingData?.bestWeek?.totalBaselineValue?.toFixed(1) || "暂无"}
          subtitle="个人最高周总值"
          icon={TrendingUp}
          testId="card-best-record"
        />
        <StatsCard
          title="当前排名"
          value={rankingData ? `${rankingData.rank}/${rankingData.totalWeeks}` : "暂无"}
          subtitle="历史周排名"
          icon={Award}
          testId="card-rank"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {trendData && trendData.length > 0 ? (
            <TrendChart data={trendData} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>趋势分析</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  暂无数据，开始记录您的运动吧！
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div>
          {rankingData && rankingData.totalWeeks > 0 ? (
            <RankingCard
              currentWeekValue={rankingData.currentWeek.totalBaselineValue}
              bestWeekValue={rankingData.bestWeek?.totalBaselineValue || null}
              worstWeekValue={rankingData.worstWeek?.totalBaselineValue || null}
              averageValue={rankingData.averageWeeklyValue}
              rank={rankingData.rank}
              totalWeeks={rankingData.totalWeeks}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>本周排名</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  暂无排名数据
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
