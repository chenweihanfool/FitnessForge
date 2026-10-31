import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Activity } from "lucide-react";
import type { RankingData, WeeklyStats } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CategoryBreakdown, WeekDetails } from "./types";
import { displayLabel } from "@shared/labels";

interface WeekDetailDialogsProps {
  showDetails: boolean;
  showRecords: boolean;
  onShowDetailsChange: (open: boolean) => void;
  onShowRecordsChange: (open: boolean) => void;
}

// 「本週基準值計算詳情」與「本週運動記錄細節」兩個對話方塊。
export function WeekDetailDialogs({ showDetails, showRecords, onShowDetailsChange, onShowRecordsChange }: WeekDetailDialogsProps) {
  const [, setLocation] = useLocation();
  const { data: rankingData } = useQuery<RankingData>({ queryKey: ["/api/stats/ranking"] });
  const { data: trendData } = useQuery<WeeklyStats[]>({ queryKey: ["/api/stats/trends"] });
  const { data: weekDetails } = useQuery<WeekDetails>({
    queryKey: ["/api/stats/current-week-details"],
    enabled: showDetails || showRecords,
  });
  const { data: categoryBreakdown } = useQuery<CategoryBreakdown[]>({ queryKey: ["/api/stats/category-breakdown"] });

  return (
    <>
      <Dialog open={showDetails} onOpenChange={onShowDetailsChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>本週基準值計算詳情</DialogTitle>
            <DialogDescription>
              加權總分 = 力量 x {weekDetails?.strengthWeight ?? 50}% + 有氧 x {weekDetails?.cardioWeight ?? 30}% + 活動量 x {weekDetails?.activityWeight ?? 20}%
            </DialogDescription>
          </DialogHeader>

          {weekDetails ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div>
                  <h3 className="font-semibold mb-2">加權計算公式</h3>
                  <p className="text-sm text-muted-foreground">
                    力量基準值合計 = {weekDetails.strengthValue.toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    有氧基準值合計 = {weekDetails.cardioValue.toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    活動量基準值合計 = {weekDetails.activityValue.toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    加權總分 = {weekDetails.strengthValue.toFixed(1)} x {weekDetails.strengthWeight}% + {weekDetails.cardioValue.toFixed(1)} x {weekDetails.cardioWeight}% + {weekDetails.activityValue.toFixed(1)} x {weekDetails.activityWeight}%
                  </p>
                  <p className="text-sm font-semibold mt-1">
                    = {weekDetails.weightedTotal.toFixed(1)}
                  </p>
                </div>
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">
                    原始基準值總和（未加權）: {weekDetails.totalBaselineValue.toFixed(1)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">詳細計算過程</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>運動項目</TableHead>
                      <TableHead className="text-right">記錄數</TableHead>
                      <TableHead className="text-right">總數值</TableHead>
                      <TableHead className="text-right">係數</TableHead>
                      <TableHead className="text-right">基準值</TableHead>
                      <TableHead className="text-right">佔比</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekDetails.details.map((detail, index) => {
                      const isCardioOrActivity = detail.exerciseCategory === '有氧' || detail.exerciseCategory === '活动量';
                      const factorLabel = isCardioOrActivity 
                        ? `強度 ${detail.intensityFactor ?? 1}` 
                        : `x ${detail.weightFactor}`;
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {displayLabel(detail.exerciseName)}
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
                      <TableCell>合計</TableCell>
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
                  onClick={() => onShowDetailsChange(false)}
                  data-testid="button-close-details"
                >
                  關閉
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-muted-foreground">載入中...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRecords} onOpenChange={onShowRecordsChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>本週運動記錄細節</DialogTitle>
            <DialogDescription>
              檢視本週的運動表現和分類佔比
            </DialogDescription>
          </DialogHeader>

          {weekDetails && categoryBreakdown && rankingData ? (
            <div className="space-y-6">
              {/* 運動記錄表格 */}
              <div>
                <h3 className="font-semibold mb-3">運動記錄明細</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>運動項目</TableHead>
                      <TableHead className="text-right">記錄數</TableHead>
                      <TableHead className="text-right">總數值</TableHead>
                      <TableHead className="text-right">基準值</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekDetails.details.map((detail, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {displayLabel(detail.exerciseName)}
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
                      <TableCell>合計</TableCell>
                      <TableCell className="text-right">{weekDetails.entryCount}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{weekDetails.totalBaselineValue.toFixed(1)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* 分類佔比 */}
              <div>
                <h3 className="font-semibold mb-3">分類佔比</h3>
                <div className="space-y-4">
                  {(() => {
                    const mainCategories = ["力量", "有氧", "活动量"];
                    const categoryMap = new Map(categoryBreakdown.map(cat => [cat.category, cat]));

                    return mainCategories.map((category) => {
                      const data = categoryMap.get(category) || { category, value: 0, percentage: 0 };
                      return (
                        <div key={category} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{displayLabel(category)}</span>
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
                            基準值: {data.value.toFixed(1)}
                          </p>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* 與生涯平均值對比 */}
              <div>
                <h3 className="font-semibold mb-3">與生涯平均值對比</h3>
                <div className="space-y-4">
                  {(() => {
                    const currentTotal = rankingData.currentWeek.totalBaselineValue;
                    const careerAvg = rankingData.averageWeeklyValue;
                    const diff = currentTotal - careerAvg;
                    const diffPercent = careerAvg > 0 ? (diff / careerAvg) * 100 : 0;

                    const currentStrength = rankingData.currentWeek.strengthValue;
                    const currentCardio = rankingData.currentWeek.cardioValue;
                    const currentActivity = rankingData.currentWeek.activityValue;

                    // 計算生涯平均值（從歷史週數據估算）
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
                        {renderProgressBar("總基準值", currentTotal, careerAvg, diffPercent)}
                        {renderProgressBar("力量", currentStrength, avgStrength, strengthDiff)}
                        {renderProgressBar("有氧", currentCardio, avgCardio, cardioDiff)}
                        {renderProgressBar("活動量", currentActivity, avgActivity, activityDiff)}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 評語 */}
              <div className="rounded-lg bg-primary/10 p-4 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Activity className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-primary mb-1">本週評價</h3>
                    <p className="text-sm">
                      {(() => {
                        const currentTotal = rankingData.currentWeek.totalBaselineValue;
                        const careerAvg = rankingData.averageWeeklyValue;
                        const diff = currentTotal - careerAvg;
                        const diffPercent = careerAvg > 0 ? (diff / careerAvg) * 100 : 0;
                        const rank = rankingData.rank;
                        const totalWeeks = rankingData.totalWeeks;

                        if (rank === 1) {
                          return "太棒了！本週創造了新的個人紀錄，繼續保持這種狀態！";
                        } else if (diffPercent >= 20) {
                          return "表現出色！本週表現遠超平均水平，再接再厲！";
                        } else if (diffPercent >= 10) {
                          return "做得很好！本週表現優於平均水平，繼續努力！";
                        } else if (diffPercent >= 0) {
                          return "不錯！本週表現達到平均水平，保持穩定！";
                        } else if (diffPercent >= -10) {
                          return "稍微低於平均水平，再加把勁，相信你能做得更好！";
                        } else if (diffPercent >= -20) {
                          return "本週表現略顯不足，加油努力，下週一定能更進一步！";
                        } else {
                          return "本週狀態欠佳，休息調整後再出發，期待你的迴歸！";
                        }
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => onShowRecordsChange(false)}
                  data-testid="button-close-week-records"
                >
                  關閉
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-muted-foreground">載入中...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
