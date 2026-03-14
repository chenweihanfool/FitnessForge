import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { StatsCard } from "@/components/stats-card";
import { RankingMetricCard } from "@/components/ranking-metric-card";
import { RankingDetailDialog } from "@/components/ranking-detail-dialog";
import { ScaleProgressBar } from "@/components/scale-progress-bar";
import { TrendChart } from "@/components/trend-chart";
import { Activity, TrendingUp, Calendar, Award, X, TrendingDown, Dumbbell, Heart, Footprints, Plus, Check, Minus, Star } from "lucide-react";
import { RankingData, WeeklyStats, RankingDetailResponse, Exercise } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
  weightedTotal: number;
  strengthValue: number;
  cardioValue: number;
  activityValue: number;
  strengthWeight: number;
  cardioWeight: number;
  activityWeight: number;
  entryCount: number;
  details: Array<{
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    weightFactor: number;
    intensityFactor: number;
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

type MuscleGroupWeeklyStats = {
  weekStart: string;
  weekEnd: string;
  muscleGroups: Array<{
    muscleGroup: string;
    totalSets: number;
    totalVolume: number;
  }>;
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
    currentWeekKm: number | null;
    weeklyAverageKm: number | null;
    bestWeekKm: number | null;
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

type MuscleGroupAverages = {
  chestAvg: number;
  backAvg: number;
  legsAvg: number;
  shouldersAvg: number;
  armsAvg: number;
  coreAvg: number;
  glutesAvg: number;
  fullBodyAvg: number;
  weekCount: number;
};

type MuscleGroupHistoryRecord = {
  weekStart: string;
  chestValue: number;
  backValue: number;
  legsValue: number;
  shouldersValue: number;
  armsValue: number;
  coreValue: number;
  glutesValue: number;
  fullBodyValue: number;
  updatedAt: string;
};

type DayEntriesData = {
  date: string;
  entries: Array<{
    id: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    value: number;
    sets: number | null;
    baselineValue: number;
    weightFactor: number;
  }>;
  totalBaselineValue: number;
  dailyStepsBaseline: number;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
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

  const { data: muscleGroupStats, isLoading: muscleGroupLoading } = useQuery<MuscleGroupWeeklyStats>({
    queryKey: ["/api/stats/muscle-group-weekly"],
  });

  const { data: exercises } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
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

  const { data: muscleGroupAverages } = useQuery<MuscleGroupAverages>({
    queryKey: ["/api/stats/muscle-group-averages"],
  });

  const { data: muscleGroupHistory } = useQuery<MuscleGroupHistoryRecord[]>({
    queryKey: ["/api/stats/muscle-group-history"],
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

  const trendDirection = (() => {
    if (!trendData || trendData.length < 3) return 'stable' as const;
    const recent = trendData.slice(-3);
    const diffs = recent.slice(1).map((w, i) => w.totalBaselineValue - recent[i].totalBaselineValue);
    const allUp = diffs.every(d => d > 0);
    const allDown = diffs.every(d => d < 0);
    if (allUp) return 'up' as const;
    if (allDown) return 'down' as const;
    return 'stable' as const;
  })();

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

  const muscleVolumeMap = (() => {
    const nameToAvgKey: Record<string, keyof MuscleGroupAverages> = {
      '胸': 'chestAvg', '背': 'backAvg', '腿': 'legsAvg', '肩': 'shouldersAvg',
      '二头肌': 'armsAvg', '核心': 'coreAvg', '臀': 'glutesAvg', '三头肌': 'fullBodyAvg',
    };
    const nameToHistKey: Record<string, keyof MuscleGroupHistoryRecord> = {
      '胸': 'chestValue', '背': 'backValue', '腿': 'legsValue', '肩': 'shouldersValue',
      '二头肌': 'armsValue', '核心': 'coreValue', '臀': 'glutesValue', '三头肌': 'fullBodyValue',
    };

    const result: Record<string, { avg: number; peak: number }> = {};
    for (const name of Object.keys(nameToAvgKey)) {
      const avgKey = nameToAvgKey[name];
      const histKey = nameToHistKey[name];
      const avg = muscleGroupAverages ? Number(muscleGroupAverages[avgKey]) || 0 : 0;
      const peak = muscleGroupHistory && muscleGroupHistory.length > 0
        ? Math.max(...muscleGroupHistory.map(r => Number(r[histKey]) || 0))
        : 0;
      result[name] = { avg, peak };
    }
    return result;
  })();

  const milestones = (() => {
    if (!rankingData) return null;

    const currentTotal = rankingData.currentWeek?.totalBaselineValue || 0;
    const avgTotal = rankingData.averageWeeklyValue || 0;

    const totalWeeks = rankingData.totalWeeks || 1;
    const rank = rankingData.rank || totalWeeks;
    const percentile = (rank / totalWeeks) * 100;
    const inTop10 = percentile <= 10;

    const trainingDays = dailyContributions?.dailyData.filter(d => d.entryCount > 0).length || 0;
    const hasEntry = trainingDays >= 1;
    const hasDiscipline = trainingDays >= 3;
    const totalAbove = currentTotal >= avgTotal && avgTotal > 0;

    const muscleGroupsWithTraining = muscleGroupStats?.muscleGroups.filter(g => g.totalSets > 0) || [];
    const muscleStatsLoaded = muscleGroupStats !== undefined;
    const hasVolumeData = muscleGroupAverages !== undefined && muscleGroupAverages.weekCount > 0;

    const muscleIntensityDetails = muscleGroupsWithTraining.map(g => {
      const setsOk = g.totalSets >= 4;
      const volData = muscleVolumeMap[g.muscleGroup];
      const volumeOk = !hasVolumeData || (volData && volData.avg > 0 ? g.totalVolume >= volData.avg : true);
      return { name: g.muscleGroup, setsOk, volumeOk, bothOk: setsOk && volumeOk };
    });

    const musclesMetCount = muscleIntensityDetails.filter(m => m.bothOk).length;
    const muscleMetRatio = muscleGroupsWithTraining.length > 0 ? musclesMetCount / muscleGroupsWithTraining.length : 0;
    const allMusclesAtMaintenance = muscleStatsLoaded && muscleGroupsWithTraining.length > 0 &&
      muscleMetRatio >= 0.5;

    const isFourWeekHigh = (() => {
      if (!trendData || trendData.length < 2) return false;
      const previousWeeks = trendData.slice(-5, -1);
      if (previousWeeks.length === 0) return false;
      const maxPrevious = Math.max(...previousWeeks.map(w => w.totalBaselineValue));
      return currentTotal > 0 && currentTotal > maxPrevious;
    })();

    const breakthrough = inTop10 || isFourWeekHigh;

    let achievedCount = 0;
    if (hasEntry) {
      achievedCount++;
      if (hasDiscipline) {
        achievedCount++;
        if (totalAbove) {
          achievedCount++;
          if (allMusclesAtMaintenance) {
            achievedCount++;
            if (breakthrough) {
              achievedCount++;
            }
          }
        }
      }
    }

    return {
      hasEntry,
      hasDiscipline,
      trainingDays,
      totalAbove,
      allMusclesAtMaintenance,
      muscleIntensityDetails,
      musclesFullyMetCount: muscleIntensityDetails.filter(m => m.bothOk).length,
      musclesSetsOnlyCount: muscleIntensityDetails.filter(m => m.setsOk).length,
      musclesVolumeOnlyCount: muscleIntensityDetails.filter(m => m.volumeOk).length,
      musclesTotalCount: muscleGroupsWithTraining.length,
      inTop10,
      isFourWeekHigh,
      breakthrough,
      percentile,
      currentTotal,
      avgTotal,
      achievedCount,
    };
  })();

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <div>
        <h1 className="text-3xl font-bold">仪表板</h1>
        <p className="text-muted-foreground mt-2">查看您的运动数据和进展</p>
      </div>

      {/* 本周綜合摘要 */}
      {rankingData && milestones && (
        <Card data-testid="card-weekly-assessment">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                本周綜合摘要
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${star <= milestones.achievedCount ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`}
                      data-testid={`star-${star}`}
                    />
                  ))}
                  <span className="text-sm font-medium ml-1" data-testid="text-milestone-count">{milestones.achievedCount}/5</span>
                </div>
                {trendDirection !== 'stable' && (
                  <Badge 
                    variant="secondary"
                    className={
                      trendDirection === 'up' 
                        ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' 
                        : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                    }
                    data-testid="badge-trend-direction"
                  >
                    {trendDirection === 'up' ? (
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />连续上升</span>
                    ) : (
                      <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" />连续下降</span>
                    )}
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 综合得分 vs 均值 */}
              <div className="space-y-2" data-testid="section-composite-score">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">综合得分</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold" data-testid="text-current-total">
                      {milestones.currentTotal.toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">/ 均 {milestones.avgTotal.toFixed(1)}</span>
                    {milestones.avgTotal > 0 && (
                      <span className={`text-sm font-semibold ${
                        milestones.currentTotal >= milestones.avgTotal 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`} data-testid="text-total-diff">
                        {milestones.currentTotal >= milestones.avgTotal ? '+' : ''}
                        {((milestones.currentTotal - milestones.avgTotal) / milestones.avgTotal * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      milestones.currentTotal >= milestones.avgTotal ? 'bg-green-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${Math.min((milestones.currentTotal / Math.max(milestones.avgTotal, 1)) * 100, 150)}%`, maxWidth: '100%' }}
                    data-testid="bar-total-progress"
                  />
                </div>
              </div>

              {/* 三大类 progress bars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2" data-testid="section-category-bars">
                {[
                  { label: '力量', current: rankingData.currentWeek?.strengthValue || 0, avg: rankingData.averageStrengthValue, icon: Dumbbell, rank: rankingData.strengthRank },
                  { label: '有氧', current: rankingData.currentWeek?.cardioValue || 0, avg: rankingData.averageCardioValue, icon: Heart, rank: rankingData.cardioRank },
                  { label: '活动量', current: rankingData.currentWeek?.activityValue || 0, avg: rankingData.averageActivityValue, icon: Footprints, rank: rankingData.activityRank },
                ].map((cat) => {
                  const pct = cat.avg > 0 ? ((cat.current - cat.avg) / cat.avg * 100) : 0;
                  const isAbove = cat.current >= cat.avg;
                  return (
                    <div key={cat.label} className="p-3 rounded-lg bg-muted/50 space-y-2" data-testid={`category-bar-${cat.label}`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium flex items-center gap-1">
                          <cat.icon className="h-3 w-3" />
                          {cat.label}
                        </span>
                        <span className="text-xs text-muted-foreground">#{cat.rank}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold">{cat.current.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">/ {cat.avg.toFixed(1)}</span>
                        {cat.avg > 0 && (
                          <span className={`text-xs font-semibold ${isAbove ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isAbove ? '+' : ''}{pct.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isAbove ? 'bg-green-500' : 'bg-orange-500'}`}
                          style={{ width: `${Math.min((cat.current / Math.max(cat.avg, 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 排名 + 里程碑简要 */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t flex-wrap" data-testid="section-rank-milestones">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">本周排名</span>
                  <span className="text-sm font-bold" data-testid="text-current-rank">
                    #{rankingData.rank} / {rankingData.totalWeeks} 周
                  </span>
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-next-milestone">
                  {milestones.achievedCount < 5 ? (
                    <span>
                      下一阶段: {
                        milestones.achievedCount === 0 ? '参与 (记录1次训练)'
                        : milestones.achievedCount === 1 ? `纪律 (训练${milestones.trainingDays}/3天)`
                        : milestones.achievedCount === 2 ? '容量 (总分超过均值)'
                        : milestones.achievedCount === 3 ? `强度 (${milestones.musclesFullyMetCount}/${milestones.musclesTotalCount}肌群达标)`
                        : '突破 (前10%或4周新高)'
                      }
                    </span>
                  ) : (
                    <span className="text-green-600 dark:text-green-400 font-medium">全部达成</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 本周训练进度 - 置顶显示 */}
      {!weeklyProgressLoading && weeklyProgress && weeklyProgress.exercises.length > 0 && (
        <Card data-testid="card-weekly-progress">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              本周训练进度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {/* 推荐训练项目 - 放在最前面 */}
              {weeklyProgress.recommendations && weeklyProgress.recommendations.length > 0 && (
                <>
                  {weeklyProgress.recommendations.map((rec) => {
                    const exerciseInfo = exercises?.find(e => e.id === rec.exerciseId);
                    const muscleFieldMap: { field: keyof Exercise; name: string }[] = [
                      { field: 'muscleChest', name: '胸' },
                      { field: 'muscleBack', name: '背' },
                      { field: 'muscleLegs', name: '腿' },
                      { field: 'muscleShoulders', name: '肩' },
                      { field: 'muscleArms', name: '二头肌' },
                      { field: 'muscleCore', name: '核心' },
                      { field: 'muscleGlutes', name: '臀' },
                      { field: 'muscleFullBody', name: '三头肌' },
                    ];
                    const targetMuscles = exerciseInfo ? muscleFieldMap
                      .filter(m => {
                        const value = exerciseInfo[m.field] as number | null;
                        return value && value > 0;
                      })
                      .map(m => m.name)
                    : [];
                    
                    return (
                      <div
                        key={`rec-${rec.exerciseId}`}
                        className="space-y-2 p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover-elevate cursor-pointer group"
                        data-testid={`recommendation-${rec.exerciseId}`}
                        onClick={() => handleAddEntry(rec.exerciseId)}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate">{rec.exerciseName}</span>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Plus className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        {targetMuscles.length > 0 && (
                          <div className="text-xs text-primary/80">
                            {targetMuscles.join(' / ')}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate">{rec.reason}</span>
                          <span className="text-primary font-medium shrink-0 ml-2">建议</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full bg-primary/50"
                            style={{ width: '0%' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {/* 运动项目列表 - 按距离锻炼时间排序 */}
              {weeklyProgress.exercises
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
                  
                  // 获取运动的主要锻炼肌群
                  const exerciseInfo = exercises?.find(e => e.id === ex.exerciseId);
                  const muscleFieldMap: { field: keyof Exercise; name: string }[] = [
                    { field: 'muscleChest', name: '胸' },
                    { field: 'muscleBack', name: '背' },
                    { field: 'muscleLegs', name: '腿' },
                    { field: 'muscleShoulders', name: '肩' },
                    { field: 'muscleArms', name: '二头肌' },
                    { field: 'muscleCore', name: '核心' },
                    { field: 'muscleGlutes', name: '臀' },
                    { field: 'muscleFullBody', name: '三头肌' },
                  ];
                  const primaryMuscles = exerciseInfo ? muscleFieldMap
                    .filter(m => {
                      const value = exerciseInfo[m.field] as number | null;
                      return value && value > 0;
                    })
                    .sort((a, b) => {
                      const valueA = (exerciseInfo[a.field] as number) || 0;
                      const valueB = (exerciseInfo[b.field] as number) || 0;
                      return valueB - valueA;
                    })
                    .slice(0, 3)
                    .map(m => m.name)
                  : [];

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
                          {ex.weeklyAverage !== null && ex.weeklyAverage > 0 ? (
                            <>
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
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">新</span>
                          )}
                        </div>
                      </div>
                      {primaryMuscles.length > 0 && (
                        <div className="text-xs text-primary/80">
                          {primaryMuscles.join(' / ')}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>
                            本周: {ex.currentWeekValue.toFixed(1)} {ex.exerciseUnit}
                          </span>
                          {ex.weeklyAverage !== null && ex.weeklyAverage > 0 && (
                            <>
                              <span>|</span>
                              <span>
                                平均: {ex.weeklyAverage.toFixed(1)} {ex.exerciseUnit}
                              </span>
                            </>
                          )}
                        </div>
                        {ex.daysSinceLastWorkout !== null && (
                          <span className={ex.daysSinceLastWorkout >= 7 ? "text-orange-500 font-medium" : ""}>
                            {ex.daysSinceLastWorkout === 0 ? "今天" : `${ex.daysSinceLastWorkout}天前`}
                          </span>
                        )}
                      </div>
                      {ex.currentWeekKm !== null && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>
                            本周: {ex.currentWeekKm.toFixed(1)} km
                          </span>
                          {ex.weeklyAverageKm !== null && ex.weeklyAverageKm > 0 && (
                            <>
                              <span>|</span>
                              <span>平均: {ex.weeklyAverageKm.toFixed(1)} km</span>
                            </>
                          )}
                          {ex.bestWeekKm !== null && ex.bestWeekKm > 0 && (
                            <>
                              <span>|</span>
                              <span className="text-primary/80">冠: {ex.bestWeekKm.toFixed(1)} km</span>
                            </>
                          )}
                        </div>
                      )}
                      {ex.weeklyAverage !== null && ex.weeklyAverage > 0 && (
                        <div className="pt-4">
                          <ScaleProgressBar
                            currentValue={ex.currentWeekValue}
                            maxValue={Math.max(ex.currentWeekValue, ex.weeklyAverage)}
                            markers={[
                              { value: ex.weeklyAverage, label: '均', colorClass: 'bg-primary', textColorClass: 'text-primary' }
                            ]}
                            barColorClass={isAbove ? 'bg-chart-3' : 'bg-destructive'}
                            height="h-2"
                            showLabels={false}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 本周肌群训练量 - 紧跟本周训练进度 */}
      {!muscleGroupLoading && muscleGroupStats && muscleGroupStats.muscleGroups.length > 0 && (
        <Card data-testid="card-muscle-group-stats">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              本周肌群训练
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(() => {
                const maxVolume = Math.max(...muscleGroupStats.muscleGroups.map(g => g.totalVolume));
                
                const getSetStatus = (sets: number) => {
                  if (sets < 4) return { color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', label: '低于维持量' };
                  if (sets <= 8) return { color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', label: '维持中' };
                  if (sets <= 15) return { color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: '最佳区间' };
                  if (sets <= 20) return { color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: '高强度' };
                  return { color: 'bg-purple-500', textColor: 'text-purple-600 dark:text-purple-400', label: '超量警示' };
                };
                
                return muscleGroupStats.muscleGroups.map((group) => {
                  const status = getSetStatus(group.totalSets);
                  const maxSets = 20;
                  const volData = muscleVolumeMap[group.muscleGroup];
                  const volAvg = volData?.avg || 0;
                  const volPeak = volData?.peak || 0;
                  const hasVolHistory = volAvg > 0;
                  const volumeAboveAvg = hasVolHistory && group.totalVolume >= volAvg;
                  const volumeAbovePeak = volPeak > 0 && group.totalVolume >= volPeak;

                  const getVolumeStatus = () => {
                    if (!hasVolHistory) return { textColor: 'text-muted-foreground', label: '--' };
                    if (volumeAbovePeak) return { textColor: 'text-green-600 dark:text-green-400', label: '超越高峰' };
                    if (volumeAboveAvg) return { textColor: 'text-green-600 dark:text-green-400', label: '达标' };
                    return { textColor: 'text-red-600 dark:text-red-400', label: '低于均值' };
                  };
                  const volStatus = getVolumeStatus();

                  return (
                    <div key={group.muscleGroup} className="space-y-2 p-3 rounded-lg bg-muted/50" data-testid={`muscle-group-stat-${group.muscleGroup}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{group.muscleGroup}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground" data-testid={`sets-${group.muscleGroup}`}>
                            {group.totalSets} 组
                          </span>
                          <span className="text-sm font-bold" data-testid={`volume-${group.muscleGroup}`}>
                            {group.totalVolume.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="pt-4">
                        <ScaleProgressBar
                          currentValue={group.totalSets}
                          maxValue={Math.max(group.totalSets, maxSets)}
                          markers={[
                            { value: 4, label: '维', colorClass: 'bg-yellow-500', textColorClass: 'text-yellow-600 dark:text-yellow-400' },
                            { value: 15, label: '优', colorClass: 'bg-chart-3', textColorClass: 'text-chart-3' }
                          ]}
                          barColorClass={status.color}
                          height="h-2"
                          showLabels={false}
                        />
                      </div>
                      {hasVolHistory && (
                        <div className="pt-2">
                          <ScaleProgressBar
                            currentValue={group.totalVolume}
                            maxValue={Math.max(group.totalVolume, volPeak, volAvg * 1.5)}
                            markers={[
                              { value: volAvg, label: '均', colorClass: 'bg-blue-500', textColorClass: 'text-blue-600 dark:text-blue-400' },
                              ...(volPeak > volAvg ? [{ value: volPeak, label: '冠', colorClass: 'bg-green-500', textColorClass: 'text-green-600 dark:text-green-400' }] : [])
                            ]}
                            barColorClass={volumeAbovePeak ? 'bg-green-500' : volumeAboveAvg ? 'bg-blue-500' : 'bg-red-500'}
                            height="h-1.5"
                            showLabels={false}
                          />
                        </div>
                      )}
                      <div className="flex justify-between items-center gap-1">
                        <span className={`text-xs ${status.textColor}`} data-testid={`status-${group.muscleGroup}`}>
                          {status.label}
                        </span>
                        {hasVolHistory && (
                          <span className={`text-xs ${volStatus.textColor}`} data-testid={`volume-status-${group.muscleGroup}`}>
                            {volStatus.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 独立推荐卡片 - 当本周训练进度卡片不显示时显示 */}
      {(!weeklyProgress || weeklyProgress.exercises.length === 0) && 
        exercises && exercises.length > 0 && (() => {
          const muscleFieldMap: { field: keyof Exercise; name: string }[] = [
            { field: 'muscleChest', name: '胸' },
            { field: 'muscleBack', name: '背' },
            { field: 'muscleLegs', name: '腿' },
            { field: 'muscleShoulders', name: '肩' },
            { field: 'muscleArms', name: '二头肌' },
            { field: 'muscleCore', name: '核心' },
            { field: 'muscleGlutes', name: '臀' },
            { field: 'muscleFullBody', name: '三头肌' },
          ];
          
          const trainedMuscles = new Set(
            muscleGroupStats?.muscleGroups?.map(g => g.muscleGroup) || []
          );
          const untrainedMuscles = muscleFieldMap.filter(m => !trainedMuscles.has(m.name));
          
          if (untrainedMuscles.length === 0) return null;
          
          const recommendedExercises = exercises
            .filter(ex => {
              return untrainedMuscles.some(um => {
                const value = ex[um.field] as number | null;
                return value && value > 0;
              });
            })
            .map(ex => {
              const targetMuscles = untrainedMuscles
                .filter(um => {
                  const value = ex[um.field] as number | null;
                  return value && value > 0;
                })
                .map(um => um.name);
              return { exercise: ex, targetMuscles };
            })
            .slice(0, 5);
          
          if (recommendedExercises.length === 0) return null;
          
          return (
            <Card data-testid="card-muscle-recommendations">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5" />
                  建议训练
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  未锻炼肌群: {untrainedMuscles.map(m => m.name).join('、')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {recommendedExercises.map(({ exercise, targetMuscles }) => (
                    <div
                      key={`rec-${exercise.id}`}
                      className="space-y-2 p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover-elevate cursor-pointer group"
                      data-testid={`recommendation-${exercise.id}`}
                      onClick={() => handleAddEntry(exercise.id)}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{exercise.name}</span>
                        <Plus className="h-4 w-4 text-primary shrink-0 ml-2" />
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        锻炼: {targetMuscles.join('、')}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })()
      }

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
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${Math.min(cat.percentage, 100)}%` }}
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
              加权总分 = 力量 x {weekDetails?.strengthWeight ?? 50}% + 有氧 x {weekDetails?.cardioWeight ?? 30}% + 活动量 x {weekDetails?.activityWeight ?? 20}%
            </DialogDescription>
          </DialogHeader>
          
          {weekDetails ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">加权计算公式</h3>
                  <p className="text-sm text-muted-foreground">
                    力量基准值合计 = {weekDetails.strengthValue.toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    有氧基准值合计 = {weekDetails.cardioValue.toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    活动量基准值合计 = {weekDetails.activityValue.toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    加权总分 = {weekDetails.strengthValue.toFixed(1)} x {weekDetails.strengthWeight}% + {weekDetails.cardioValue.toFixed(1)} x {weekDetails.cardioWeight}% + {weekDetails.activityValue.toFixed(1)} x {weekDetails.activityWeight}%
                  </p>
                  <p className="text-sm font-semibold mt-1">
                    = {weekDetails.weightedTotal.toFixed(1)}
                  </p>
                </div>
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">
                    原始基准值总和（未加权）: {weekDetails.totalBaselineValue.toFixed(1)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">详细计算过程</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>运动项目</TableHead>
                      <TableHead className="text-right">记录数</TableHead>
                      <TableHead className="text-right">总数值</TableHead>
                      <TableHead className="text-right">系数</TableHead>
                      <TableHead className="text-right">基准值</TableHead>
                      <TableHead className="text-right">占比</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekDetails.details.map((detail, index) => {
                      const isCardioOrActivity = detail.exerciseCategory === '有氧' || detail.exerciseCategory === '活动量';
                      const factorLabel = isCardioOrActivity 
                        ? `强度 ${detail.intensityFactor ?? 1}` 
                        : `x ${detail.weightFactor}`;
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {detail.exerciseName}
                            <span className="text-xs text-muted-foreground ml-2">
                              ({detail.exerciseUnit})
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{detail.count}</TableCell>
                          <TableCell className="text-right">{detail.totalValue.toFixed(1)}</TableCell>
                          <TableCell className="text-right">{factorLabel}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {detail.baselineValue.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {weekDetails.totalBaselineValue > 0 ? ((detail.baselineValue / weekDetails.totalBaselineValue) * 100).toFixed(1) : '0.0'}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
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
            <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
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
                      {entry.sets && entry.sets > 0 && (
                        <span className="text-muted-foreground font-normal">
                          {(entry.exerciseName === '跑步' || entry.exerciseName === '跑步機負重')
                            ? ` / ${entry.sets}km`
                            : entry.sets > 1 ? ` x ${entry.sets}组` : ''}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      基准值: {entry.baselineValue.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
              
              <div className="pt-3 border-t space-y-2">
                {dayEntriesData.dailyStepsBaseline > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">每周平均步数(分配)</span>
                    <span className="font-medium">{dayEntriesData.dailyStepsBaseline.toFixed(1)} 基准值</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">当日总计</span>
                  <span className="font-bold">
                    {(dayEntriesData.totalBaselineValue - 
                      (dayEntriesData.entries.find(e => e.exerciseName === '每周平均步数')?.baselineValue || 0) + 
                      dayEntriesData.dailyStepsBaseline).toFixed(1)} 基准值
                  </span>
                </div>
              </div>
            </div>
          ) : dayEntriesData && dayEntriesData.dailyStepsBaseline > 0 ? (
            <div className="space-y-3">
              <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">每周平均步数(分配)</span>
                  <span className="font-medium">{dayEntriesData.dailyStepsBaseline.toFixed(1)} 基准值</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">当日总计</span>
                  <span className="font-bold">{dayEntriesData.dailyStepsBaseline.toFixed(1)} 基准值</span>
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
