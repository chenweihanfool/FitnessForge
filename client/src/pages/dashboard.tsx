import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TrendChart } from "@/components/trend-chart";
import { useLocation } from "wouter";
import { RankingMetricCard } from "@/components/ranking-metric-card";
import { RankingDetailDialog } from "@/components/ranking-detail-dialog";
import { ScaleProgressBar } from "@/components/scale-progress-bar";
import { AcwrCard } from "@/components/training/acwr-card";
import { RecoveryCard } from "@/components/training/recovery-card";
import { AcwrAlert } from "@/components/training/acwr-alert";
import { ProgressTab } from "@/components/dashboard/progress-tab";
import { RadarHistoryCard } from "@/components/dashboard/radar-history-card";
import { BestWeekDialog } from "@/components/dashboard/best-week-dialog";
import { DayEntriesDialog } from "@/components/dashboard/day-entries-dialog";
import type {
  WeekDetails, CategoryBreakdown, MuscleGroupWeeklyStats, DailyContributions,
  MuscleGroupAverages, MuscleGroupHistoryRecord,
} from "@/components/dashboard/types";
import { formatWeekRange } from "@/components/dashboard/types";
import { HeartPulse, Activity, TrendingUp, Award, TrendingDown, Dumbbell, Heart, Footprints, Plus, Check, Minus, Star, Pencil, ChevronDown, ChevronRight, Trophy, Radar as RadarIcon, Lightbulb, Save, History } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { RankingData, WeeklyStats, RankingDetailResponse, Exercise } from "@shared/schema";
import { getMuscleSetsMaintenance, computeMuscleCompositeScore, computeBalanceScore, computeCoverageScore, applyActivityBonus } from "@shared/muscleGroupStats";
import { queryClient, apiRequest, invalidateWorkoutData } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("summary");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showWeekRecordsDialog, setShowWeekRecordsDialog] = useState(false);
  const [showBestWeekDialog, setShowBestWeekDialog] = useState(false);
  const [rankingDetailMetric, setRankingDetailMetric] = useState<'total' | 'strength' | 'cardio' | 'activity' | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [selectedDayName, setSelectedDayName] = useState<string>("");
  const [showMuscleDetail, setShowMuscleDetail] = useState(false);

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

  const { data: dailyContributions, isLoading: dailyContributionsLoading } = useQuery<DailyContributions>({
    queryKey: ["/api/stats/daily-contributions"],
  });

  const { data: muscleGroupAverages } = useQuery<MuscleGroupAverages>({
    queryKey: ["/api/stats/muscle-group-averages"],
  });

  const { data: muscleGroupHistory } = useQuery<MuscleGroupHistoryRecord[]>({
    queryKey: ["/api/stats/muscle-group-history"],
  });

  type StepsData = {
    id: string;
    exerciseId: string;
    value: number;
    dailyAverage: number;
    date: string;
    source: "manual" | "auto";
    sourceDays: number | null;
  } | null;

  const { data: stepsData, isSuccess: stepsLoaded } = useQuery<StepsData>({
    queryKey: ["/api/entries/current-week-steps"],
  });

  const stepsExerciseId = exercises?.find(e => e.name === '每周平均步数')?.id;

  const [showStepsDialog, setShowStepsDialog] = useState(false);
  const [stepsInput, setStepsInput] = useState("");

  const stepsMutation = useMutation({
    mutationFn: async (dailyAvg: number) => {
      const weeklyTotal = dailyAvg * 7;
      // 編輯一律存成 manual：若目前顯示的是系統自動估算值，改成新增一筆手動記錄
      // （而不是覆寫自動記錄），這樣自動同步仍可在背景持續更新，但本週畫面永遠優先顯示手動值。
      if (stepsData && stepsData.id && stepsData.source === "manual") {
        return apiRequest("PUT", `/api/entries/${stepsData.id}`, {
          exerciseId: stepsData.exerciseId,
          value: weeklyTotal,
          weightFactor: 1,
          source: "manual",
        });
      } else if (stepsExerciseId) {
        return apiRequest("POST", "/api/entries", {
          exerciseId: stepsExerciseId,
          value: weeklyTotal,
          weightFactor: 1,
          source: "manual",
        });
      }
    },
    onSuccess: () => {
      invalidateWorkoutData();
      setShowStepsDialog(false);
      setStepsInput("");
      toast({ title: "步数已更新" });
    },
    onError: () => {
      toast({ title: "更新失败", variant: "destructive" });
    },
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
      '有氧': 'aerobicAvg',
    };
    const nameToHistKey: Record<string, keyof MuscleGroupHistoryRecord> = {
      '胸': 'chestValue', '背': 'backValue', '腿': 'legsValue', '肩': 'shouldersValue',
      '二头肌': 'armsValue', '核心': 'coreValue', '臀': 'glutesValue', '三头肌': 'fullBodyValue',
      '有氧': 'aerobicValue',
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
    <div className="space-y-4 xl:space-y-5 mx-auto w-full max-w-[1600px]" data-testid="page-dashboard">
      {/* 標頭列：標題 + 本周步數快速更新（桌面同一列，省一整排高度） */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl xl:text-3xl font-bold tracking-tight">仪表板</h1>
            {rankingData?.currentWeek && (
              <Badge variant="outline" className="rounded-full px-3 py-1 font-normal tabular-nums" data-testid="badge-current-week-range">
                本周 {formatWeekRange(rankingData.currentWeek.weekStart, rankingData.currentWeek.weekEnd)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">查看您的运动数据和进展</p>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[24rem] empty:hidden">
              {stepsLoaded && stepsExerciseId && (
                <Card data-testid="card-steps-quick-update">
                  <CardContent className="flex items-center justify-between gap-4 py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Footprints className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">本周每日平均步数</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {stepsData ? (
                        <>
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-medium" data-testid="text-steps-daily-avg">
                              {stepsData.dailyAverage.toLocaleString()} 步/天
                            </span>
                            {stepsData.source === "auto" && (
                              <span className="text-[10px] text-muted-foreground" data-testid="text-steps-auto-badge">
                                🤖 自動估算{stepsData.sourceDays ? `（基於${stepsData.sourceDays}天資料）` : ""}
                              </span>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setStepsInput(String(stepsData.dailyAverage));
                              setShowStepsDialog(true);
                            }}
                            data-testid="button-steps-quick-edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setStepsInput("");
                            setShowStepsDialog(true);
                          }}
                          data-testid="button-steps-quick-edit"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          記錄步數
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
        </div>
      </div>

      {/* 第一屏：歷史趨勢 + 肌群雷達並排，不用往下捲就能看到兩個主圖 */}
      <div className="flex flex-col gap-4 xl:gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 space-y-4 empty:hidden lg:flex-[11_1_0%]">
                {/* 歷史趨勢圖 */}
                {trendData && trendData.length > 1 && (
                  <TrendChart data={trendData} title="歷史趨勢" />
                )}
        </div>
        <div className="min-w-0 space-y-4 empty:hidden lg:flex-[10_1_0%]">
                {/* 本周肌群均衡度 雷達圖（組數+容量複合分，8 肌群 + 有氧） */}
                {(() => {
                  const muscleNames = ['胸', '背', '腿', '肩', '二头肌', '核心', '臀', '三头肌', '有氧'];
                  const hasAnyAvg = muscleNames.some(name => (muscleVolumeMap[name]?.avg ?? 0) > 0);
                  if (!hasAnyAvg) return null;

                  const radarData = muscleNames.map(name => {
                    const volData = muscleVolumeMap[name];
                    const g = muscleGroupStats?.muscleGroups.find(g => g.muscleGroup === name);
                    const sets = g?.totalSets ?? 0;
                    const volume = g?.totalVolume ?? 0;
                    const avgVolume = volData?.avg ?? 0;

                    // 各肌群各自的維持組數基準（大肌群基準較高、小肌群較低）；「有氧」沒有
                    // 組數概念，這裡的 sets 其實是本週有氧分鐘數，基準是週 60 分鐘，見
                    // @shared/muscleGroupStats 的 MUSCLE_SETS_MAINTENANCE 說明
                    const { setsPct, volumePct, composite } = computeMuscleCompositeScore(name, sets, volume, avgVolume);

                    return { name, pct: composite, setsPct, volumePct, baseline: 100, sets, volume, avgVolume };
                  });

                  // Recommendations: weakest muscles with composite < 80 that have volume history
                  const recommendations = radarData
                    .filter(d => d.avgVolume > 0 && d.pct < 80)
                    .sort((a, b) => a.pct - b.pct)
                    .slice(0, 3);

                  // 均衡度分數：最弱/最強肌群複合分的比值，見 @shared/muscleGroupStats
                  const balanceScore = computeBalanceScore(
                    radarData.map(d => ({ name: d.name, composite: d.pct, hasVolumeHistory: d.avgVolume > 0 }))
                  );

                  // 覆蓋分數：雷達圖多邊形面積 ÷ 每軸都 100% 時的面積，見 @shared/muscleGroupStats
                  const rawCoverageScore = computeCoverageScore(radarData.map(d => d.pct));

                  // 活動量（例如步數）不當成獨立軸放進雷達圖——沒有「肌群」的同儕關係，
                  // 改成幫覆蓋分數加成（封頂 +10%），且必須顯示加成來源，見
                  // @shared/muscleGroupStats 的 applyActivityBonus 說明
                  const activityAvg = rankingData?.averageActivityValue ?? 0;
                  const activityComposite = activityAvg > 0
                    ? ((rankingData?.currentWeek?.activityValue ?? 0) / activityAvg) * 100
                    : 0;
                  const { adjustedCoverage: coverageScore, bonusPoints: activityBonusPoints } =
                    applyActivityBonus(rawCoverageScore, activityComposite);

                  const weekStart = muscleGroupStats?.weekStart;
                  const scores = Object.fromEntries(radarData.map(d => [d.name, d.pct]));

                  return (
                    <>
                      <Card data-testid="card-muscle-radar">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center justify-between gap-2 text-base flex-wrap">
                            <span
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={() => setShowMuscleDetail(v => !v)}
                            >
                              <RadarIcon className="h-5 w-5" />
                              本周肌群均衡度
                              {balanceScore !== null && (
                                <Badge
                                  variant="outline"
                                  className={
                                    balanceScore >= 80
                                      ? "text-green-600 border-green-600/40 bg-green-500/10"
                                      : balanceScore >= 50
                                      ? "text-amber-600 border-amber-600/40 bg-amber-500/10"
                                      : "text-red-600 border-red-600/40 bg-red-500/10"
                                  }
                                  data-testid="badge-balance-score"
                                >
                                  均衡度 {balanceScore}%
                                </Badge>
                              )}
                              {coverageScore !== null && (
                                <Badge
                                  variant="outline"
                                  className={
                                    coverageScore >= 100
                                      ? "text-green-600 border-green-600/40 bg-green-500/10"
                                      : coverageScore >= 60
                                      ? "text-amber-600 border-amber-600/40 bg-amber-500/10"
                                      : "text-red-600 border-red-600/40 bg-red-500/10"
                                  }
                                  data-testid="badge-coverage-score"
                                >
                                  覆蓋 {coverageScore}%{activityBonusPoints > 0 ? `（含活動量 +${activityBonusPoints}%）` : ''}
                                </Badge>
                              )}
                              {showMuscleDetail
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              }
                            </span>
                            {weekStart && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 gap-1"
                                onClick={async () => {
                                  try {
                                    await apiRequest("POST", "/api/stats/radar-snapshot", {
                                      weekStart,
                                      scores,
                                      recommendations: recommendations.map(r => r.name),
                                    });
                                    toast({ title: "雷達圖已儲存", description: `第 ${weekStart} 週快照已保存` });
                                  } catch {
                                    toast({ title: "儲存失敗", variant: "destructive" });
                                  }
                                }}
                              >
                                <Save className="h-3 w-3" />
                                儲存快照
                              </Button>
                            )}
                          </CardTitle>
                          <details className="mt-1 text-xs text-muted-foreground" data-testid="details-radar-help">
                            <summary className="cursor-pointer select-none hover:text-foreground">計分說明</summary>
                            <p className="mt-1">複合評分 = 組數 40% + 容量 60%，對比歷史均值</p>
                            {balanceScore !== null && (
                              <p className="mt-0.5">均衡度 = 最弱 2 個肌群複合分平均 ÷ 最強肌群複合分，數字越低代表落差越大</p>
                            )}
                            {coverageScore !== null && (
                              <p className="mt-0.5">覆蓋 = 雷達圖多邊形面積 ÷ 每軸都達 100% 時的面積，數字越高代表整體訓練量越飽滿；活動量（如步數）達成率另外加成，封頂 +10%</p>
                            )}
                          </details>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={320}>
                            <RadarChart data={radarData} outerRadius="78%">
                              <PolarGrid stroke="hsl(var(--muted-foreground) / 0.25)" />
                              <PolarAngleAxis
                                dataKey="name"
                                tick={{ fontSize: 12, fill: 'hsl(var(--foreground) / 0.75)' }}
                              />
                              <PolarRadiusAxis
                                domain={[0, 150]}
                                ticks={[0, 50, 100, 150] as any}
                                tickFormatter={(v: number) => v === 100 ? '維持' : `${v}%`}
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                angle={90}
                              />
                              <RechartsTooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const d = payload[0].payload;
                                  return (
                                    <div className="rounded-md border bg-popover p-2.5 shadow-md text-xs space-y-0.5">
                                      <p className="font-semibold">{d.name}</p>
                                      <p className="text-muted-foreground">複合分: <span className="font-bold text-foreground">{d.pct}%</span></p>
                                      <p className="text-muted-foreground">組數分: <span className="font-medium">{d.setsPct}%</span> ({d.sets} / {getMuscleSetsMaintenance(d.name)} 組)</p>
                                      {d.volumePct !== null && (
                                        <p className="text-muted-foreground">容量分: <span className="font-medium">{d.volumePct}%</span></p>
                                      )}
                                    </div>
                                  );
                                }}
                              />
                              <Radar
                                name="維持量"
                                dataKey="baseline"
                                stroke="#d4a900"
                                strokeDasharray="4 3"
                                strokeWidth={1.5}
                                fill="transparent"
                                dot={false}
                              />
                              <Radar
                                name="本周複合分"
                                dataKey="pct"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                fill="hsl(var(--primary))"
                                fillOpacity={0.25}
                                dot={false}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground -mt-2">
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block w-5 border-t-2 border-dashed border-yellow-600" />
                              維持量基準
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block w-5 border-t-2 border-primary" />
                              本周複合分
                            </span>
                          </div>

                          {/* AI-style recommendations */}
                          {recommendations.length > 0 && (() => {
                            // Map Chinese muscle group names → exercise muscle field keys
                            const muscleFieldMap: Record<string, keyof Exercise> = {
                              '胸': 'muscleChest', '背': 'muscleBack', '腿': 'muscleLegs',
                              '肩': 'muscleShoulders', '二头肌': 'muscleArms', '三头肌': 'muscleArms',
                              '核心': 'muscleCore', '臀': 'muscleGlutes',
                            };
                            return (
                              <div className="mt-4 rounded-lg border bg-muted/30 p-3 space-y-2">
                                <p className="text-xs font-semibold flex items-center gap-1.5">
                                  <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                                  系統建議：最需加強的肌群
                                </p>
                                <div className="space-y-2.5">
                                  {recommendations.map((r, i) => {
                                    const priority = ['🔴', '🟠', '🟡'][i] ?? '•';
                                    const deficit = 100 - r.pct;
                                    const reason = r.volumePct !== null
                                      ? `複合分 ${r.pct}%（組數 ${r.setsPct}% / 容量 ${r.volumePct}%），不足 ${deficit}%`
                                      : `組數分 ${r.setsPct}%（本週 ${r.sets} 組 / 維持需 ${getMuscleSetsMaintenance(r.name)} 組）`;
                                    const field = muscleFieldMap[r.name];
                                    const suggestedExercises = field
                                      ? (exercises ?? [])
                                          .filter(e => ((e[field] as number) ?? 0) >= 20)
                                          .sort((a, b) => ((b[field] as number) ?? 0) - ((a[field] as number) ?? 0))
                                          .slice(0, 4)
                                      : [];
                                    return (
                                      <div key={r.name} className="flex items-start gap-2 text-xs">
                                        <span className="mt-0.5">{priority}</span>
                                        <div className="flex-1 min-w-0">
                                          <div>
                                            <span className="font-semibold">{r.name}</span>
                                            <span className="text-muted-foreground ml-1.5">{reason}</span>
                                          </div>
                                          {suggestedExercises.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                              {suggestedExercises.map(ex => (
                                                <button
                                                  key={ex.id}
                                                  onClick={() => handleAddEntry(ex.id)}
                                                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                                                >
                                                  <Plus className="h-2.5 w-2.5" />
                                                  {ex.name}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {recommendations.length === 0 && radarData.every(d => d.pct >= 80) && (
                            <div className="mt-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30 p-3">
                              <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5" />
                                本週所有肌群均衡度良好，繼續保持！
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
                {/* 本周肌群训练详情 - 点击雷达图展开 */}
                {showMuscleDetail && !muscleGroupLoading && (
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
                          const ALL_MUSCLES = ['胸', '背', '腿', '肩', '二头肌', '核心', '臀', '三头肌'];

                          const weekMap = new Map(
                            (muscleGroupStats?.muscleGroups || []).map(g => [g.muscleGroup, g])
                          );

                          const getSetStatus = (sets: number) => {
                            if (sets === 0) return { color: 'bg-muted-foreground/20', textColor: 'text-muted-foreground', label: '未訓練' };
                            if (sets < 4) return { color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', label: '低于维持量' };
                            if (sets <= 8) return { color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', label: '维持中' };
                            if (sets <= 15) return { color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: '最佳区间' };
                            if (sets <= 20) return { color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: '高强度' };
                            return { color: 'bg-purple-500', textColor: 'text-purple-600 dark:text-purple-400', label: '超量警示' };
                          };

                          const getCombinedStatus = (sets: number, setsOk: boolean, volumeOk: boolean, hasHistory: boolean) => {
                            if (sets === 0) return { label: '--', badgeClass: 'bg-muted text-muted-foreground', tintClass: '' };
                            if (!hasHistory) return { label: '--', badgeClass: 'bg-muted text-muted-foreground', tintClass: '' };
                            if (setsOk && volumeOk) return { label: '全達標', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', tintClass: 'bg-green-50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30' };
                            if (!setsOk && volumeOk) return { label: '缺組數', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', tintClass: 'bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-800/20' };
                            if (setsOk && !volumeOk) return { label: '缺容量', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', tintClass: 'bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-800/20' };
                            return { label: '未達標', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', tintClass: 'bg-red-50/50 dark:bg-red-950/10 border border-red-200/40 dark:border-red-800/20' };
                          };

                          const getSortPriority = (name: string) => {
                            const g = weekMap.get(name);
                            const sets = g?.totalSets || 0;
                            const vol = g?.totalVolume || 0;
                            const vd = muscleVolumeMap[name];
                            const avg = vd?.avg || 0;
                            const hasHist = avg > 0;
                            if (sets === 0) return hasHist ? 2 : 4;
                            const sok = sets >= 4;
                            const vok = hasHist && vol >= avg;
                            if (!sok && !vok) return 0;
                            if (!sok || !vok) return 1;
                            return 3;
                          };
                          const sortedMuscles = [...ALL_MUSCLES].sort((a, b) => getSortPriority(a) - getSortPriority(b));

                          return sortedMuscles.map((muscleName) => {
                            const group = weekMap.get(muscleName);
                            const totalSets = group?.totalSets || 0;
                            const totalVolume = group?.totalVolume || 0;
                            const status = getSetStatus(totalSets);
                            const maxSets = 20;
                            const volData = muscleVolumeMap[muscleName];
                            const volAvg = volData?.avg || 0;
                            const hasVolHistory = volAvg > 0;
                            const setsOk = totalSets >= 4;
                            const volumeOk = hasVolHistory && totalVolume >= volAvg;

                            const combined = getCombinedStatus(totalSets, setsOk, volumeOk, hasVolHistory);

                            const volDiffPercent = hasVolHistory && volAvg > 0 && totalSets > 0
                              ? Math.round(((totalVolume - volAvg) / volAvg) * 100)
                              : 0;

                            return (
                              <div
                                key={muscleName}
                                className={`space-y-2 p-3 rounded-lg ${combined.tintClass || 'bg-muted/50'}`}
                                data-testid={`muscle-group-stat-${muscleName}`}
                              >
                                <div className="flex justify-between items-center gap-1">
                                  <span className="text-sm font-medium">{muscleName}</span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-[10px] px-1.5 py-0 h-5 no-default-hover-elevate no-default-active-elevate ${combined.badgeClass}`}
                                    data-testid={`combined-status-${muscleName}`}
                                  >
                                    {combined.label}
                                  </Badge>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-xs text-muted-foreground" data-testid={`sets-${muscleName}`}>
                                    {totalSets} 组
                                  </span>
                                  <span className="text-sm font-bold" data-testid={`volume-${muscleName}`}>
                                    {totalVolume.toFixed(1)}
                                  </span>
                                </div>
                                <div className="pt-4">
                                  <ScaleProgressBar
                                    currentValue={totalSets}
                                    maxValue={Math.max(totalSets, maxSets)}
                                    markers={[
                                      { value: 4, label: '维', colorClass: 'bg-yellow-500', textColorClass: 'text-yellow-600 dark:text-yellow-400' },
                                      { value: 15, label: '优', colorClass: 'bg-chart-3', textColorClass: 'text-chart-3' }
                                    ]}
                                    barColorClass={status.color}
                                    height="h-2"
                                    showLabels={false}
                                  />
                                </div>
                                <div className="flex justify-between items-center gap-1">
                                  <span className={`text-xs ${status.textColor}`} data-testid={`status-${muscleName}`}>
                                    {status.label}
                                  </span>
                                  {hasVolHistory && totalSets > 0 ? (
                                    <span
                                      className={`text-xs ${volDiffPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                                      data-testid={`volume-status-${muscleName}`}
                                    >
                                      容量 {totalVolume.toFixed(0)} / 均 {volAvg.toFixed(0)} ({volDiffPercent >= 0 ? '+' : ''}{volDiffPercent}%)
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground" data-testid={`volume-status-${muscleName}`}>
                                      {hasVolHistory ? `均 ${volAvg.toFixed(0)}` : '--'}
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

        </div>
      </div>

      {/* 其餘區塊收進分頁，一次只顯示一個，避免首頁拉得太長 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl bg-muted/60 p-1" data-testid="tabs-dashboard">
          <TabsTrigger value="summary" className="gap-2 rounded-lg px-4 py-2" data-testid="tab-summary">
            <Award className="h-4 w-4" />本周摘要
          </TabsTrigger>
          <TabsTrigger value="advice" className="gap-2 rounded-lg px-4 py-2" data-testid="tab-advice">
            <HeartPulse className="h-4 w-4" />訓練建議
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-2 rounded-lg px-4 py-2" data-testid="tab-progress">
            <Activity className="h-4 w-4" />訓練進度
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-2 rounded-lg px-4 py-2" data-testid="tab-ranking">
            <Trophy className="h-4 w-4" />排名
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 rounded-lg px-4 py-2" data-testid="tab-history">
            <History className="h-4 w-4" />雷達歷史
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-0 space-y-4">
          <AcwrAlert onShowDetails={() => setActiveTab("advice")} />
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
                          <Badge 
                            variant="secondary"
                            className={
                              trendDirection === 'up' 
                                ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' 
                                : trendDirection === 'down'
                                  ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                                  : ''
                            }
                            data-testid="badge-trend-direction"
                          >
                            {trendDirection === 'up' ? (
                              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />连续上升</span>
                            ) : trendDirection === 'down' ? (
                              <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" />连续下降</span>
                            ) : (
                              <span className="flex items-center gap-1"><Minus className="h-3 w-3" />持平</span>
                            )}
                          </Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* 综合得分 vs 均值 */}
                        <div className="space-y-2 cursor-pointer hover-elevate rounded-md p-1 -m-1" data-testid="section-composite-score" onClick={() => setShowDetailsDialog(true)}>
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

                        {/* 里程碑阶段 */}
                        <div className="flex items-center gap-2 pt-2 border-t flex-wrap" data-testid="section-milestone-stages">
                          {[
                            { stage: 1, name: '参与', achieved: milestones.hasEntry, detail: '至少1次训练记录', status: milestones.hasEntry ? '已达成' : '未达成' },
                            { stage: 2, name: '纪律', achieved: milestones.hasDiscipline, detail: `训练天数 ≥ 3（目前 ${milestones.trainingDays} 天）`, status: milestones.hasDiscipline ? '已达成' : `${milestones.trainingDays}/3 天` },
                            { stage: 3, name: '容量', achieved: milestones.totalAbove, detail: `总分超过生涯均值（均 ${milestones.avgTotal.toFixed(0)}）`, status: milestones.totalAbove ? '已达成' : `${milestones.currentTotal.toFixed(0)} / ${milestones.avgTotal.toFixed(0)}` },
                            { stage: 4, name: '强度', achieved: milestones.allMusclesAtMaintenance, detail: `≥50% 肌群达维持量+容量（${milestones.musclesFullyMetCount}/${milestones.musclesTotalCount}）`, status: milestones.allMusclesAtMaintenance ? '已达成' : `${milestones.musclesFullyMetCount}/${milestones.musclesTotalCount} 肌群` },
                            { stage: 5, name: '突破', achieved: milestones.breakthrough, detail: '前10% 或 4周新高', status: milestones.breakthrough ? '已达成' : milestones.inTop10 ? '前10%' : milestones.isFourWeekHigh ? '4周新高' : '未达成' },
                          ].map((m) => (
                            <Popover key={m.stage}>
                              <PopoverTrigger asChild>
                                <button
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                    m.achieved
                                      ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                  data-testid={`milestone-badge-${m.stage}`}
                                >
                                  <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                                    m.achieved
                                      ? 'bg-green-600 text-white dark:bg-green-500'
                                      : 'bg-muted-foreground/20 text-muted-foreground'
                                  }`}>
                                    {m.stage}
                                  </span>
                                  {m.name}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-3" side="bottom">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">{m.stage}. {m.name}</p>
                                  <p className="text-xs text-muted-foreground">{m.detail}</p>
                                  <p className={`text-xs font-medium ${m.achieved ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                    {m.status}
                                  </p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ))}
                        </div>

                        {/* 排名 + 快捷连结 */}
                        <div className="flex items-center justify-between gap-2 flex-wrap" data-testid="section-rank-milestones">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">本周排名</span>
                            <span className="text-sm font-bold" data-testid="text-current-rank">
                              #{rankingData.rank} / {rankingData.totalWeeks} 周
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setShowWeekRecordsDialog(true)} data-testid="button-view-week-records">
                              本周记录
                            </Button>
                            {rankingData.bestWeek && (
                              <Button variant="ghost" size="sm" onClick={() => setShowBestWeekDialog(true)} data-testid="button-view-best-week">
                                历史最佳
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
        </TabsContent>

        <TabsContent value="advice" className="mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <AcwrCard />
            <RecoveryCard />
          </div>
        </TabsContent>

        <TabsContent value="progress" className="mt-0 space-y-4">
          <ProgressTab />
        </TabsContent>

        <TabsContent value="ranking" className="mt-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="grid-rankings">
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
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-4">
                <RadarHistoryCard />
        </TabsContent>
      </Tabs>

      <Dialog open={showStepsDialog} onOpenChange={setShowStepsDialog}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>{stepsData ? '更新每日平均步数' : '記錄步數'}</DialogTitle>
            <DialogDescription>
              {stepsData
                ? `目前记录：每日 ${stepsData.dailyAverage.toLocaleString()} 步（周总计 ${stepsData.value.toLocaleString()} 步）${stepsData.source === 'auto' ? '，系統自動估算值，輸入後將改為手動記錄' : ''}`
                : '输入本周每日平均步数'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">每日平均步数</label>
              <Input
                type="number"
                min="0"
                step="100"
                placeholder="例如 8000"
                value={stepsInput}
                onChange={(e) => setStepsInput(e.target.value)}
                data-testid="input-steps-daily-avg"
              />
              {stepsInput && Number(stepsInput) > 0 && (
                <p className="text-xs text-muted-foreground">
                  周总计：{(Number(stepsInput) * 7).toLocaleString()} 步
                </p>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!stepsInput || Number(stepsInput) <= 0 || stepsMutation.isPending}
              onClick={() => stepsMutation.mutate(Number(stepsInput))}
              data-testid="button-steps-confirm"
            >
              {stepsMutation.isPending ? '更新中...' : '确认'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


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

      <BestWeekDialog
        open={showBestWeekDialog}
        onOpenChange={setShowBestWeekDialog}
        weekStart={rankingData?.bestWeek?.weekStart}
      />

      <DayEntriesDialog
        date={selectedDayDate}
        dayName={selectedDayName}
        onClose={() => setSelectedDayDate(null)}
      />

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
