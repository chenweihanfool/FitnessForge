import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Award, HeartPulse, History, Trophy } from "lucide-react";
import type { RankingData, WeeklyStats } from "@shared/schema";
import { TrendChart } from "@/components/trend-chart";
import { AcwrAlert } from "@/components/training/acwr-alert";
import { AcwrCard } from "@/components/training/acwr-card";
import { RecoveryCard } from "@/components/training/recovery-card";
import { BestWeekDialog } from "@/components/dashboard/best-week-dialog";
import { DayEntriesDialog } from "@/components/dashboard/day-entries-dialog";
import { MuscleHistoryTab } from "@/components/dashboard/muscle-history-tab";
import { MuscleRadarCard } from "@/components/dashboard/muscle-radar-card";
import { ProgressTab } from "@/components/dashboard/progress-tab";
import { RankingTab } from "@/components/dashboard/ranking-tab";
import { StepsCard } from "@/components/dashboard/steps-card";
import { formatWeekRange } from "@/components/dashboard/types";
import { WeekDetailDialogs } from "@/components/dashboard/week-detail-dialogs";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { WeeklySummaryCard } from "@/components/dashboard/weekly-summary-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWeekMilestones } from "@/hooks/use-week-milestones";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("summary");
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showWeekRecordsDialog, setShowWeekRecordsDialog] = useState(false);
  const [showBestWeekDialog, setShowBestWeekDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ date: string; name: string } | null>(null);

  const { data: rankingData, isLoading: rankingLoading } = useQuery<RankingData>({
    queryKey: ["/api/stats/ranking"],
  });
  const { data: trendData, isLoading: trendLoading } = useQuery<WeeklyStats[]>({
    queryKey: ["/api/stats/trends"],
  });
  const milestones = useWeekMilestones();

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
          <h1 className="text-3xl font-bold">儀表板</h1>
          <p className="text-muted-foreground mt-2">查看您的運動資料和進展</p>
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

  return (
    <div className="space-y-4 xl:space-y-5 mx-auto w-full max-w-[1600px]" data-testid="page-dashboard">
      {/* 標頭列：標題 + 本週步數快速更新（桌面同一列，省一整排高度） */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl xl:text-3xl font-bold tracking-tight">儀表板</h1>
            {rankingData?.currentWeek && (
              <Badge variant="outline" className="rounded-full px-3 py-1 font-normal tabular-nums" data-testid="badge-current-week-range">
                本週 {formatWeekRange(rankingData.currentWeek.weekStart, rankingData.currentWeek.weekEnd)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">查看您的運動資料和進展</p>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[24rem] empty:hidden">
          <StepsCard />
        </div>
      </div>

      <WeekStrip onSelectDay={setSelectedDay} />

      {/* 第一屏：歷史趨勢 + 肌群雷達並排，不用往下捲就能看到兩個主圖 */}
      <div className="flex flex-col gap-4 xl:gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 space-y-4 empty:hidden lg:flex-[11_1_0%]">
          {trendData && trendData.length > 1 && <TrendChart data={trendData} title="歷史趨勢" />}
        </div>
        <div className="min-w-0 space-y-4 empty:hidden lg:flex-[10_1_0%]">
          <MuscleRadarCard />
        </div>
      </div>

      {/* 其餘區塊收進分頁，一次只顯示一個，避免首頁拉得太長 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl bg-muted/60 p-1" data-testid="tabs-dashboard">
          <TabsTrigger value="summary" className="gap-2 rounded-lg px-4 py-2" data-testid="tab-summary">
            <Award className="h-4 w-4" />本週摘要
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
            <History className="h-4 w-4" />肌群歷史
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-0 space-y-4">
          <AcwrAlert onShowDetails={() => setActiveTab("advice")} />
          {rankingData && milestones && (
            <WeeklySummaryCard
              rankingData={rankingData}
              milestones={milestones}
              trendDirection={trendDirection}
              onShowDetails={() => setShowDetailsDialog(true)}
              onShowWeekRecords={() => setShowWeekRecordsDialog(true)}
              onShowBestWeek={() => setShowBestWeekDialog(true)}
            />
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
          <RankingTab rankingData={rankingData} />
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-4">
          <MuscleHistoryTab />
        </TabsContent>
      </Tabs>

      <WeekDetailDialogs
        showDetails={showDetailsDialog}
        showRecords={showWeekRecordsDialog}
        onShowDetailsChange={setShowDetailsDialog}
        onShowRecordsChange={setShowWeekRecordsDialog}
      />

      <BestWeekDialog
        open={showBestWeekDialog}
        onOpenChange={setShowBestWeekDialog}
        weekStart={rankingData?.bestWeek?.weekStart}
      />

      <DayEntriesDialog
        date={selectedDay?.date ?? null}
        dayName={selectedDay?.name ?? ""}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}
