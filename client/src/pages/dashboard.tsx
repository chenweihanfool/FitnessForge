import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { StatsCard } from "@/components/stats-card";
import { RankingMetricCard } from "@/components/ranking-metric-card";
import { RankingDetailDialog } from "@/components/ranking-detail-dialog";
import { TrendChart } from "@/components/trend-chart";
import { Activity, TrendingUp, Calendar, Award, X, TrendingDown, Dumbbell, Heart, Footprints, Plus, Check, Minus } from "lucide-react";
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

type WeeklyProgress = {
  weekStart: string;
  weekEnd: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    currentWeekValue: number;
    weeklyAverage: number | null;
    difference: number | null;
    differencePercentage: number | null;
    daysSinceLastWorkout: number | null;
  }>;
  recommendations: Array<{
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    reason: string;
  }>;
};

type DailyContributions = {
  weekStart: string;
  weekEnd: string;
  dailyData: Array<{
    date: string;
    dayOfWeek: number;
    dayName: string;
    baselineValue: number;
    percentage: number;
    entryCount: number;
  }>;
  weekTotal: number;
};

type DayEntriesData = {
  date: string;
  entries: Array<{
    id: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    value: number;
    baselineValue: number;
    weightFactor: number;
  }>;
  totalBaselineValue: number;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showWeekRecordsDialog, setShowWeekRecordsDialog] = useState(false);
  const [showBestWeekDialog, setShowBestWeekDialog] = useState(false);
  const [rankingDetailMetric, setRankingDetailMetric] = useState<'total' | 'strength' | 'cardio' | 'activity' | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [selectedDayName, setSelectedDayName] = useState<string>("");
  
  const handleAddEntry = (exerciseId: string) => {
    setLocation(`/entries?addExercise=${exerciseId}`);
  };

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

  const { data: weeklyProgress, isLoading: weeklyProgressLoading } = useQuery<WeeklyProgress>({
    queryKey: ["/api/stats/weekly-progress"],
  });

  const { data: bestWeekDetails, isLoading: bestWeekLoading } = useQuery<BestWeekDetails>({
    queryKey: [`/api/stats/week-details?weekStart=${rankingData?.bestWeek?.weekStart}`],
    enabled: showBestWeekDialog && !!rankingData?.bestWeek?.weekStart,
  });

  const { data: dailyContributions, isLoading: dailyContributionsLoading } = useQuery<DailyContributions>({
    queryKey: ["/api/stats/daily-contributions"],
  });

  const { data: dayEntriesData, isLoading: dayEntriesLoading } = useQuery<DayEntriesData>({
    queryKey: ["/api/stats/entries-by-date", selectedDayDate],
    queryFn: async () => {
      const response = await fetch(`/api/stats/entries-by-date?date=${encodeURIComponent(selectedDayDate!)}`);
      if (!response.ok) throw new Error('Failed to fetch day entries');
      return response.json();
    },
    enabled: !!selectedDayDate,
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

  // 计算阶段性目标状态
  const milestones = (() => {
    if (!rankingData || !categoryBreakdown) return null;
    
    const currentStrength = categoryBreakdown.find(c => c.category === "力量")?.value || 0;
    const currentCardio = categoryBreakdown.find(c => c.category === "有氧")?.value || 0;
    const currentActivity = categoryBreakdown.find(c => c.category === "活动量")?.value || 0;
    const currentTotal = rankingData.currentWeek?.totalBaselineValue || 0;
    
    const avgStrength = rankingData.averageStrengthValue || 0;
    const avgCardio = rankingData.averageCardioValue || 0;
    const avgActivity = rankingData.averageActivityValue || 0;
    const avgTotal = rankingData.averageWeeklyValue || 0;
    
    const strengthAbove = currentStrength >= avgStrength && avgStrength > 0;
    const cardioAbove = currentCardio >= avgCardio && avgCardio > 0;
    const activityAbove = currentActivity >= avgActivity && avgActivity > 0;
    const totalAbove = currentTotal >= avgTotal && avgTotal > 0;
    
    const totalWeeks = rankingData.totalWeeks || 1;
    const rank = rankingData.rank || totalWeeks;
    const percentile = ((totalWeeks - rank + 1) / totalWeeks) * 100;
    const inTop60 = percentile >= 40; // 前60%意味着百分位 >= 40%
    
    return {
      allAbove: strengthAbove && cardioAbove && activityAbove,
      threeAbove: strengthAbove && cardioAbove && activityAbove,
      totalAbove,
      inTop60,
      strengthAbove,
      cardioAbove,
      activityAbove,
      percentile,
    };
  })();

  // 确定达成的最高阶段
  const getHighestMilestone = () => {
    if (!milestones) return 0;
    if (milestones.allAbove) return 4;
    if (milestones.threeAbove) return 3;
    if (milestones.totalAbove) return 2;
    if (milestones.inTop60) return 1;
    return 0;
  };

  const highestMilestone = getHighestMilestone();

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <div>
        <h1 className="text-3xl font-bold">仪表板</h1>
        <p className="text-muted-foreground mt-2">查看您的运动数据和进展</p>
      </div>

      {/* 本周评语 - 阶段性目标 */}
      {rankingData && milestones && (
        <Card data-testid="card-weekly-assessment">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              本周评语
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 当前状态总结 */}
              <div className="text-center py-2">
                {highestMilestone === 4 ? (
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    全面超越！所有项目均超过历史平均
                  </p>
                ) : highestMilestone === 3 ? (
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    三项达标！力量、有氧、活动量均超过平均
                  </p>
                ) : highestMilestone === 2 ? (
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    总分达标！继续努力提升各项指标
                  </p>
                ) : highestMilestone === 1 ? (
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    进入前60%！离平均水平还有一步之遥
                  </p>
                ) : (
                  <p className="text-lg font-bold text-muted-foreground">
                    继续加油！向前60%目标迈进
                  </p>
                )}
              </div>

              {/* 4个阶段性目标 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 目标4: 所有项目超过平均 */}
                <div 
                  className={`p-3 rounded-lg border ${milestones.allAbove ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/30 border-muted'}`}
                  data-testid="milestone-all-above"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${milestones.allAbove ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                      4
                    </div>
                    <span className={`text-sm font-medium ${milestones.allAbove ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`}>
                      全项超越
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-8">所有项目皆超过平均</p>
                </div>

                {/* 目标3: 力量/有氧/活动量超过平均 */}
                <div 
                  className={`p-3 rounded-lg border ${milestones.threeAbove ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/30 border-muted'}`}
                  data-testid="milestone-three-above"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${milestones.threeAbove ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                      3
                    </div>
                    <span className={`text-sm font-medium ${milestones.threeAbove ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`}>
                      三项达标
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground ml-8">
                    <span className="flex items-center gap-0.5">
                      力量{milestones.strengthAbove ? <Check className="h-3 w-3 text-green-500" /> : <Minus className="h-3 w-3" />}
                    </span>
                    <span className="flex items-center gap-0.5">
                      有氧{milestones.cardioAbove ? <Check className="h-3 w-3 text-green-500" /> : <Minus className="h-3 w-3" />}
                    </span>
                    <span className="flex items-center gap-0.5">
                      活动量{milestones.activityAbove ? <Check className="h-3 w-3 text-green-500" /> : <Minus className="h-3 w-3" />}
                    </span>
                  </div>
                </div>

                {/* 目标2: 总分超过平均 */}
                <div 
                  className={`p-3 rounded-lg border ${milestones.totalAbove ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' : 'bg-muted/30 border-muted'}`}
                  data-testid="milestone-total-above"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${milestones.totalAbove ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                      2
                    </div>
                    <span className={`text-sm font-medium ${milestones.totalAbove ? 'text-blue-700 dark:text-blue-300' : 'text-muted-foreground'}`}>
                      总分达标
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-8">总分超过历史平均</p>
                </div>

                {/* 目标1: 总分在前60% */}
                <div 
                  className={`p-3 rounded-lg border ${milestones.inTop60 ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' : 'bg-muted/30 border-muted'}`}
                  data-testid="milestone-top-60"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${milestones.inTop60 ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                      1
                    </div>
                    <span className={`text-sm font-medium ${milestones.inTop60 ? 'text-orange-700 dark:text-orange-300' : 'text-muted-foreground'}`}>
                      前60%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-8">
                    当前: 前{milestones.percentile.toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 本周训练进度 - 置顶显示 */}
      {!weeklyProgressLoading && weeklyProgress && weeklyProgress.exercises.filter(e => e.weeklyAverage !== null && e.weeklyAverage > 0).length > 0 && (
        <Card data-testid="card-weekly-progress">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              本周训练进度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {weeklyProgress.exercises
                .filter((e) => e.weeklyAverage !== null && e.weeklyAverage > 0)
                .sort((a, b) => {
                  // 按距上次锻炼天数降序排列，null值排最后
                  const daysA = a.daysSinceLastWorkout ?? -1;
                  const daysB = b.daysSinceLastWorkout ?? -1;
                  return daysB - daysA;
                })
                .map((ex) => {
                  const percentage = ex.differencePercentage || 0;
                  const isAbove = percentage >= 0;
                  const displayPercentage = Math.abs(percentage);
                  const progressValue = Math.min(displayPercentage, 100);

                  return (
                    <div
                      key={ex.exerciseId}
                      className="space-y-2 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer group"
                      data-testid={`progress-${ex.exerciseId}`}
                      onClick={() => handleAddEntry(ex.exerciseId)}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{ex.exerciseName}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          {isAbove ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-orange-500" />
                          )}
                          <span
                            className={
                              isAbove ? "text-green-600 dark:text-green-400 font-semibold" : "text-orange-600 dark:text-orange-400 font-semibold"
                            }
                          >
                            {isAbove ? "+" : ""}
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>
                            本周: {ex.currentWeekValue.toFixed(1)} {ex.exerciseUnit}
                          </span>
                          <span>|</span>
                          <span>
                            平均: {ex.weeklyAverage?.toFixed(1)} {ex.exerciseUnit}
                          </span>
                        </div>
                        {ex.daysSinceLastWorkout !== null && (
                          <span className={ex.daysSinceLastWorkout >= 7 ? "text-orange-500 font-medium" : ""}>
                            {ex.daysSinceLastWorkout === 0 ? "今天" : `${ex.daysSinceLastWorkout}天前`}
                          </span>
                        )}
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
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

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
                  const mainCategories = ["力量", "有氧", "活动量"];
                  const categoryMap = new Map(categoryBreakdown.map(cat => [cat.category, cat]));
                  
                  const allCategories = new Map<string, CategoryBreakdown>();
                  
                  categoryBreakdown.forEach(cat => {
                    allCategories.set(cat.category, cat);
                  });
                  
                  mainCategories.forEach(category => {
                    if (!allCategories.has(category)) {
                      allCategories.set(category, {
                        category,
                        value: 0,
                        percentage: 0,
                      });
                    }
                  });
                  
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
          
          {/* 本周每日锻炼热点图 */}
          {!dailyContributionsLoading && dailyContributions && (
            <Card data-testid="card-daily-heatmap">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  本周每日贡献
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1">
                  {dailyContributions.dailyData.map((day) => {
                    const maxPercentage = Math.max(...dailyContributions.dailyData.map(d => d.percentage));
                    const intensity = maxPercentage > 0 ? day.percentage / maxPercentage : 0;
                    const hasEntries = day.entryCount > 0;
                    
                    return (
                      <div
                        key={day.date}
                        className={`flex flex-col items-center gap-1 ${hasEntries ? 'cursor-pointer' : ''}`}
                        data-testid={`heatmap-day-${day.dayOfWeek}`}
                        onClick={() => {
                          if (hasEntries) {
                            setSelectedDayDate(day.date);
                            setSelectedDayName(day.dayName);
                          }
                        }}
                      >
                        <span className="text-xs text-muted-foreground">{day.dayName}</span>
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-medium transition-colors ${hasEntries ? 'hover-elevate' : ''}`}
                          style={{
                            backgroundColor: day.baselineValue > 0
                              ? `hsl(var(--primary) / ${0.2 + intensity * 0.8})`
                              : 'hsl(var(--muted))',
                            color: intensity > 0.5 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                          }}
                          title={`${day.dayName}: ${day.baselineValue.toFixed(1)} (${day.percentage.toFixed(1)}%)`}
                        >
                          {day.entryCount > 0 ? day.entryCount : ""}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {day.percentage > 0 ? `${day.percentage.toFixed(0)}%` : "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {dailyContributions.weekTotal > 0 && (
                  <div className="mt-4 pt-3 border-t text-sm text-muted-foreground text-center">
                    本周总计: {dailyContributions.weekTotal.toFixed(1)} 基准值
                  </div>
                )}
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

      {/* 每日锻炼记录详情对话框 */}
      <Dialog open={!!selectedDayDate} onOpenChange={(open) => !open && setSelectedDayDate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedDayName}锻炼记录</DialogTitle>
            <DialogDescription>
              当日共 {dayEntriesData?.entries.length || 0} 条记录
            </DialogDescription>
          </DialogHeader>
          
          {dayEntriesLoading ? (
            <div className="flex items-center justify-center h-24">
              <p className="text-muted-foreground">加载中...</p>
            </div>
          ) : dayEntriesData && dayEntriesData.entries.length > 0 ? (
            <div className="space-y-3">
              {dayEntriesData.entries.map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  data-testid={`day-entry-${entry.id}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{entry.exerciseName}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.exerciseCategory || "未分类"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-semibold">
                      {entry.value} {entry.exerciseUnit}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      基准值: {entry.baselineValue.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
              
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">当日总计</span>
                  <span className="font-bold">{dayEntriesData.totalBaselineValue.toFixed(1)} 基准值</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">暂无锻炼记录</p>
          )}
          
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setSelectedDayDate(null)}
              data-testid="button-close-day-entries"
            >
              关闭
            </Button>
          </div>
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
