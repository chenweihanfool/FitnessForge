import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/stats-card";
import { RankingMetricCard } from "@/components/ranking-metric-card";
import { RankingDetailDialog } from "@/components/ranking-detail-dialog";
import { TrendChart } from "@/components/trend-chart";
import { Activity, TrendingUp, Calendar, Award, X, TrendingDown, Dumbbell, Heart, Footprints } from "lucide-react";
import { RankingData, WeeklyStats, RankingDetailResponse } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
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
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    weightFactor: number;
    count: number;
    totalValue: number;
    baselineValue: number;
  }>;
};

type BestWeekDetails = {
  weekStart: string;
  weekEnd: string;
  year: number;
  weekNumber: number;
  totalBaselineValue: number;
  entryCount: number;
  details: Array<{
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    weightFactor: number;
    count: number;
    totalValue: number;
    baselineValue: number;
    weeklyAverage: number | null;
    difference: number | null;
    differencePercentage: number | null;
  }>;
};

type CategoryBreakdown = {
  category: string;
  value: number;
  percentage: number;
};

export default function Dashboard() {
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showWeekRecordsDialog, setShowWeekRecordsDialog] = useState(false);
  const [showBestWeekDialog, setShowBestWeekDialog] = useState(false);
  const [rankingDetailMetric, setRankingDetailMetric] = useState<'total' | 'strength' | 'cardio' | 'activity' | null>(null);

  const { data: rankingData, isLoading: rankingLoading } = useQuery<RankingData>({
    queryKey: ["/api/stats/ranking"],
  });

  const { data: trendData, isLoading: trendLoading } = useQuery<WeeklyStats[]>({
    queryKey: ["/api/stats/trends"],
  });

  const { data: weekDetails } = useQuery<WeekDetails>({
    queryKey: ["/api/stats/current-week-details"],
    enabled: showDetailsDialog || showWeekRecordsDialog,
  });

  const { data: categoryBreakdown, isLoading: categoryLoading } = useQuery<CategoryBreakdown[]>({
    queryKey: ["/api/stats/category-breakdown"],
  });

  const { data: bestWeekDetails, isLoading: bestWeekLoading } = useQuery<BestWeekDetails>({
    queryKey: [`/api/stats/week-details?weekStart=${rankingData?.bestWeek?.weekStart}`],
    enabled: showBestWeekDialog && !!rankingData?.bestWeek?.weekStart,
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

  const prefetchRankingDetail = (metric: 'total' | 'strength' | 'cardio' | 'activity') => {
    queryClient.prefetchQuery({
      queryKey: ['/api/stats/ranking-detail', metric],
      queryFn: async () => {
        const response = await fetch(`/api/stats/ranking-detail?metric=${metric}`);
        if (!response.ok) throw new Error('Failed to fetch ranking detail');
        return response.json() as Promise<RankingDetailResponse>;
      },
    });
  };

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
          clickable={true}
          onClick={() => setShowWeekRecordsDialog(true)}
        />
        <StatsCard
          title="历史最佳"
          value={rankingData?.bestWeek?.totalBaselineValue?.toFixed(1) || "暂无"}
          subtitle="个人最高周总值"
          icon={TrendingUp}
          testId="card-best-record"
          clickable={!!rankingData?.bestWeek}
          onClick={() => rankingData?.bestWeek && setShowBestWeekDialog(true)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {rankingData && rankingData.totalWeeks > 0 && (
          <>
            <RankingMetricCard
              title="总分排名"
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
              title="活动量排名"
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
          {!categoryLoading && categoryBreakdown && (
            <Card data-testid="card-category-breakdown">
              <CardHeader>
                <CardTitle>分类统计</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  // 主要分类应始终显示（即使为0）
                  const mainCategories = ["力量", "有氧", "活动量"];
                  const categoryMap = new Map(categoryBreakdown.map(cat => [cat.category, cat]));
                  
                  // 合并所有分类：API返回的 + 缺失的主要分类（填充0值）
                  const allCategories = new Map<string, CategoryBreakdown>();
                  
                  // 首先添加所有API返回的分类
                  categoryBreakdown.forEach(cat => {
                    allCategories.set(cat.category, cat);
                  });
                  
                  // 然后为缺失的主要分类填充0值
                  mainCategories.forEach(category => {
                    if (!allCategories.has(category)) {
                      allCategories.set(category, {
                        category,
                        value: 0,
                        percentage: 0,
                      });
                    }
                  });
                  
                  // 排序：主要分类优先，然后按基准值降序
                  const sortedCategories = Array.from(allCategories.values()).sort((a, b) => {
                    const aIsMain = mainCategories.includes(a.category);
                    const bIsMain = mainCategories.includes(b.category);
                    
                    if (aIsMain && !bIsMain) return -1;
                    if (!aIsMain && bIsMain) return 1;
                    if (aIsMain && bIsMain) {
                      return mainCategories.indexOf(a.category) - mainCategories.indexOf(b.category);
                    }
                    return b.value - a.value;
                  });
                  
                  return sortedCategories.map((cat) => (
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
                  ));
                })()}
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

      <Dialog open={showWeekRecordsDialog} onOpenChange={setShowWeekRecordsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>本周运动记录细节</DialogTitle>
            <DialogDescription>
              查看本周的运动表现和分类占比
            </DialogDescription>
          </DialogHeader>
          
          {weekDetails && categoryBreakdown && rankingData ? (
            <div className="space-y-6">
              {/* 运动记录表格 */}
              <div>
                <h3 className="font-semibold mb-3">运动记录明细</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>运动项目</TableHead>
                      <TableHead className="text-right">记录数</TableHead>
                      <TableHead className="text-right">总数值</TableHead>
                      <TableHead className="text-right">基准值</TableHead>
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
                        <TableCell className="text-right font-semibold">
                          {detail.baselineValue.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell>合计</TableCell>
                      <TableCell className="text-right">{weekDetails.entryCount}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{weekDetails.totalBaselineValue.toFixed(1)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* 分类占比 */}
              <div>
                <h3 className="font-semibold mb-3">分类占比</h3>
                <div className="space-y-4">
                  {(() => {
                    const mainCategories = ["力量", "有氧", "活动量"];
                    const categoryMap = new Map(categoryBreakdown.map(cat => [cat.category, cat]));
                    
                    return mainCategories.map((category) => {
                      const data = categoryMap.get(category) || { category, value: 0, percentage: 0 };
                      return (
                        <div key={category} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{category}</span>
                            <span className="text-sm font-bold">
                              {data.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-3">
                            <div
                              className="bg-primary rounded-full h-3 transition-all"
                              style={{ width: `${data.percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            基准值: {data.value.toFixed(1)}
                          </p>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 与生涯平均值对比 */}
              <div>
                <h3 className="font-semibold mb-3">与生涯平均值对比</h3>
                <div className="space-y-4">
                  {(() => {
                    const currentTotal = rankingData.currentWeek.totalBaselineValue;
                    const careerAvg = rankingData.averageWeeklyValue;
                    const diff = currentTotal - careerAvg;
                    const diffPercent = careerAvg > 0 ? (diff / careerAvg) * 100 : 0;
                    
                    const currentStrength = rankingData.currentWeek.strengthValue;
                    const currentCardio = rankingData.currentWeek.cardioValue;
                    const currentActivity = rankingData.currentWeek.activityValue;
                    
                    // 计算生涯平均值（从历史周数据估算）
                    const avgStrength = trendData && trendData.length > 0 
                      ? trendData.reduce((sum, w) => sum + w.strengthValue, 0) / trendData.length
                      : 0;
                    const avgCardio = trendData && trendData.length > 0
                      ? trendData.reduce((sum, w) => sum + w.cardioValue, 0) / trendData.length
                      : 0;
                    const avgActivity = trendData && trendData.length > 0
                      ? trendData.reduce((sum, w) => sum + w.activityValue, 0) / trendData.length
                      : 0;
                    
                    const strengthDiff = avgStrength > 0 ? ((currentStrength - avgStrength) / avgStrength) * 100 : 0;
                    const cardioDiff = avgCardio > 0 ? ((currentCardio - avgCardio) / avgCardio) * 100 : 0;
                    const activityDiff = avgActivity > 0 ? ((currentActivity - avgActivity) / avgActivity) * 100 : 0;
                    
                    const renderProgressBar = (label: string, current: number, avg: number, diffPercent: number) => {
                      const isPositive = diffPercent >= 0;
                      const barPercent = Math.min(Math.abs(diffPercent), 100);
                      
                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{label}</span>
                            <div className="text-sm">
                              <span className="font-bold">{current.toFixed(1)}</span>
                              <span className="text-muted-foreground mx-1">/</span>
                              <span className="text-muted-foreground">平均 {avg.toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 transition-all ${isPositive ? 'bg-green-500' : 'bg-orange-500'}`}
                                style={{ width: `${barPercent}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold min-w-[60px] text-right ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                              {isPositive ? '+' : ''}{diffPercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    };
                    
                    return (
                      <>
                        {renderProgressBar("总基准值", currentTotal, careerAvg, diffPercent)}
                        {renderProgressBar("力量", currentStrength, avgStrength, strengthDiff)}
                        {renderProgressBar("有氧", currentCardio, avgCardio, cardioDiff)}
                        {renderProgressBar("活动量", currentActivity, avgActivity, activityDiff)}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 评语 */}
              <div className="rounded-lg bg-primary/10 p-4 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Activity className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-primary mb-1">本周评价</h3>
                    <p className="text-sm">
                      {(() => {
                        const currentTotal = rankingData.currentWeek.totalBaselineValue;
                        const careerAvg = rankingData.averageWeeklyValue;
                        const diff = currentTotal - careerAvg;
                        const diffPercent = careerAvg > 0 ? (diff / careerAvg) * 100 : 0;
                        const rank = rankingData.rank;
                        const totalWeeks = rankingData.totalWeeks;
                        
                        if (rank === 1) {
                          return "太棒了！本周创造了新的个人纪录，继续保持这种状态！";
                        } else if (diffPercent >= 20) {
                          return "表现出色！本周表现远超平均水平，再接再厉！";
                        } else if (diffPercent >= 10) {
                          return "做得很好！本周表现优于平均水平，继续努力！";
                        } else if (diffPercent >= 0) {
                          return "不错！本周表现达到平均水平，保持稳定！";
                        } else if (diffPercent >= -10) {
                          return "稍微低于平均水平，再加把劲，相信你能做得更好！";
                        } else if (diffPercent >= -20) {
                          return "本周表现略显不足，加油努力，下周一定能更进一步！";
                        } else {
                          return "本周状态欠佳，休息调整后再出发，期待你的回归！";
                        }
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowWeekRecordsDialog(false)}
                  data-testid="button-close-week-records"
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

      {/* 历史最佳周对话框 */}
      <Dialog open={showBestWeekDialog} onOpenChange={setShowBestWeekDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-best-week">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              历史最佳周详情
            </DialogTitle>
            <DialogDescription>
              {bestWeekDetails && `${bestWeekDetails.year}年 第${bestWeekDetails.weekNumber}周 | 周总值: ${bestWeekDetails.totalBaselineValue.toFixed(1)}`}
            </DialogDescription>
          </DialogHeader>

          {bestWeekDetails ? (
            <div className="space-y-6">
              {/* 运动项目明细表格 */}
              <div>
                <h3 className="text-base font-semibold mb-3">运动项目明细</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>运动类型</TableHead>
                        <TableHead className="text-right">记录次数</TableHead>
                        <TableHead className="text-right">总数值</TableHead>
                        <TableHead className="text-right">基准值</TableHead>
                        <TableHead className="text-right">与平均值对比</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bestWeekDetails.details.map((detail) => {
                        const isAbove = detail.differencePercentage !== null && detail.differencePercentage >= 0;
                        const progressValue = detail.differencePercentage !== null 
                          ? Math.min(Math.abs(detail.differencePercentage), 100) 
                          : 0;

                        return (
                          <TableRow key={detail.exerciseId} data-testid={`row-exercise-${detail.exerciseId}`}>
                            <TableCell className="font-medium">
                              {detail.exerciseName}
                              {detail.exerciseCategory && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({detail.exerciseCategory})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{detail.count}</TableCell>
                            <TableCell className="text-right">
                              {detail.totalValue.toFixed(1)} {detail.exerciseUnit}
                            </TableCell>
                            <TableCell className="text-right">
                              {detail.baselineValue.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right">
                              {detail.weeklyAverage !== null ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-end gap-2 text-sm">
                                    {isAbove ? (
                                      <TrendingUp className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <TrendingDown className="h-4 w-4 text-orange-500" />
                                    )}
                                    <span className={isAbove ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}>
                                      {isAbove ? '+' : ''}{detail.differencePercentage?.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground text-right">
                                    <span>当周: {detail.totalValue.toFixed(1)} {detail.exerciseUnit}</span>
                                    <span className="mx-1">|</span>
                                    <span>平均: {detail.weeklyAverage.toFixed(1)} {detail.exerciseUnit}</span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                    <div
                                      className={`h-full transition-all ${
                                        isAbove ? "bg-green-500" : "bg-orange-500"
                                      }`}
                                      style={{ width: `${progressValue}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">无历史数据</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBestWeekDialog(false)}
                  data-testid="button-close-best-week"
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

      {/* 排名详情对话框 */}
      {rankingDetailMetric && (
        <RankingDetailDialog
          open={!!rankingDetailMetric}
          onOpenChange={(open) => !open && setRankingDetailMetric(null)}
          metric={rankingDetailMetric}
        />
      )}
    </div>
  );
}
