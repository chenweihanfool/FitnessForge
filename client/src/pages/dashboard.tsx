import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/stats-card";
import { RankingCard } from "@/components/ranking-card";
import { TrendChart } from "@/components/trend-chart";
import { Activity, TrendingUp, Calendar, Award, X } from "lucide-react";
import { RankingData, WeeklyStats } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type WeekDetails = {
  weekStart: string;
  weekEnd: string;
  totalBaselineValue: number;
  entryCount: number;
  details: Array<{
    exerciseName: string;
    exerciseUnit: string;
    weightFactor: number;
    count: number;
    totalValue: number;
    baselineValue: number;
  }>;
};

type CategoryBreakdown = {
  category: string;
  value: number;
  percentage: number;
};

export default function Dashboard() {
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const { data: rankingData, isLoading: rankingLoading } = useQuery<RankingData>({
    queryKey: ["/api/stats/ranking"],
  });

  const { data: trendData, isLoading: trendLoading } = useQuery<WeeklyStats[]>({
    queryKey: ["/api/stats/trends"],
  });

  const { data: weekDetails } = useQuery<WeekDetails>({
    queryKey: ["/api/stats/current-week-details"],
    enabled: showDetailsDialog,
  });

  const { data: categoryBreakdown, isLoading: categoryLoading } = useQuery<CategoryBreakdown[]>({
    queryKey: ["/api/stats/category-breakdown"],
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
          clickable={true}
          onClick={() => setShowDetailsDialog(true)}
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
        
        <div className="space-y-6">
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

          {!categoryLoading && categoryBreakdown && categoryBreakdown.length > 0 && (
            <Card data-testid="card-category-breakdown">
              <CardHeader>
                <CardTitle>分类统计</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {categoryBreakdown
                  .filter(cat => ["力量", "有氧", "活动量"].includes(cat.category))
                  .map((cat) => (
                    <div key={cat.category} className="space-y-2" data-testid={`category-stat-${cat.category}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{cat.category}</span>
                        <span className="text-sm font-bold" data-testid={`percentage-${cat.category}`}>
                          {cat.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground" data-testid={`value-${cat.category}`}>
                        基准值: {cat.value.toFixed(1)}
                      </p>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>本周基准值计算详情</DialogTitle>
            <DialogDescription>
              基准值 = Σ(运动数据 × 权重系数)
            </DialogDescription>
          </DialogHeader>
          
          {weekDetails ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h3 className="font-semibold mb-2">计算公式</h3>
                <p className="text-sm text-muted-foreground">
                  基准值 = {weekDetails.details.map((d, i) => 
                    `${i > 0 ? ' + ' : ''}(${d.exerciseName}: ${d.totalValue.toFixed(1)} × ${d.weightFactor})`
                  ).join('')}
                </p>
                <p className="text-sm font-semibold mt-2">
                  = {weekDetails.totalBaselineValue.toFixed(1)}
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">详细计算过程</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>运动项目</TableHead>
                      <TableHead className="text-right">记录数</TableHead>
                      <TableHead className="text-right">总数值</TableHead>
                      <TableHead className="text-right">权重系数</TableHead>
                      <TableHead className="text-right">基准值</TableHead>
                      <TableHead className="text-right">占比</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekDetails.details.map((detail, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {detail.exerciseName}
                          <span className="text-xs text-muted-foreground ml-2">
                            ({detail.exerciseUnit})
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{detail.count}</TableCell>
                        <TableCell className="text-right">{detail.totalValue.toFixed(1)}</TableCell>
                        <TableCell className="text-right">× {detail.weightFactor}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {detail.baselineValue.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {((detail.baselineValue / weekDetails.totalBaselineValue) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>合计</TableCell>
                      <TableCell className="text-right">{weekDetails.entryCount}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="text-right">{weekDetails.totalBaselineValue.toFixed(1)}</TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDetailsDialog(false)}
                  data-testid="button-close-details"
                >
                  关闭
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-muted-foreground">加载中...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
