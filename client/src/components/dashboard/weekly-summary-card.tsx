import { Award, Dumbbell, Footprints, Heart, Minus, Star, TrendingDown, TrendingUp } from "lucide-react";
import type { RankingData } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { useWeekMilestones } from "@/hooks/use-week-milestones";

interface WeeklySummaryCardProps {
  rankingData: RankingData;
  milestones: NonNullable<ReturnType<typeof useWeekMilestones>>;
  trendDirection: "up" | "down" | "stable";
  onShowDetails: () => void;
  onShowWeekRecords: () => void;
  onShowBestWeek: () => void;
}

export function WeeklySummaryCard({ rankingData, milestones, trendDirection, onShowDetails, onShowWeekRecords, onShowBestWeek }: WeeklySummaryCardProps) {
  return (

    <Card data-testid="card-weekly-assessment">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            本週綜合摘要
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
                <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />連續上升</span>
              ) : trendDirection === 'down' ? (
                <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" />連續下降</span>
              ) : (
                <span className="flex items-center gap-1"><Minus className="h-3 w-3" />持平</span>
              )}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 綜合得分 vs 均值 */}
          <div className="space-y-2 cursor-pointer hover-elevate rounded-md p-1 -m-1" data-testid="section-composite-score" onClick={onShowDetails}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">綜合得分</span>
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

          {/* 三大類 progress bars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2" data-testid="section-category-bars">
            {[
              { label: '力量', current: rankingData.currentWeek?.strengthValue || 0, avg: rankingData.averageStrengthValue, icon: Dumbbell, rank: rankingData.strengthRank },
              { label: '有氧', current: rankingData.currentWeek?.cardioValue || 0, avg: rankingData.averageCardioValue, icon: Heart, rank: rankingData.cardioRank },
              { label: '活動量', current: rankingData.currentWeek?.activityValue || 0, avg: rankingData.averageActivityValue, icon: Footprints, rank: rankingData.activityRank },
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

          {/* 里程碑階段 */}
          <div className="flex items-center gap-2 pt-2 border-t flex-wrap" data-testid="section-milestone-stages">
            {[
              { stage: 1, name: '參與', achieved: milestones.hasEntry, detail: '至少1次訓練記錄', status: milestones.hasEntry ? '已達成' : '未達成' },
              { stage: 2, name: '紀律', achieved: milestones.hasDiscipline, detail: `訓練天數 ≥ 3（目前 ${milestones.trainingDays} 天）`, status: milestones.hasDiscipline ? '已達成' : `${milestones.trainingDays}/3 天` },
              { stage: 3, name: '容量', achieved: milestones.totalAbove, detail: `總分超過生涯均值（均 ${milestones.avgTotal.toFixed(0)}）`, status: milestones.totalAbove ? '已達成' : `${milestones.currentTotal.toFixed(0)} / ${milestones.avgTotal.toFixed(0)}` },
              { stage: 4, name: '強度', achieved: milestones.allMusclesAtMaintenance, detail: `≥50% 肌群達維持量+容量（${milestones.musclesMetCount}/${milestones.musclesTotalCount}）`, status: milestones.allMusclesAtMaintenance ? '已達成' : `${milestones.musclesMetCount}/${milestones.musclesTotalCount} 肌群` },
              { stage: 5, name: '突破', achieved: milestones.breakthrough, detail: '前10% 或 4週新高', status: milestones.breakthrough ? '已達成' : milestones.inTop10 ? '前10%' : milestones.isFourWeekHigh ? '4週新高' : '未達成' },
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

          {/* 排名 + 快捷連結 */}
          <div className="flex items-center justify-between gap-2 flex-wrap" data-testid="section-rank-milestones">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">本週排名</span>
              <span className="text-sm font-bold" data-testid="text-current-rank">
                #{rankingData.rank} / {rankingData.totalWeeks} 週
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={onShowWeekRecords} data-testid="button-view-week-records">
                本週記錄
              </Button>
              {rankingData.bestWeek && (
                <Button variant="ghost" size="sm" onClick={onShowBestWeek} data-testid="button-view-best-week">
                  歷史最佳
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
