import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BestWeekDetails } from "./types";

export function BestWeekDialog({
  open,
  onOpenChange,
  weekStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: string | undefined;
}) {
  const { data: bestWeekDetails } = useQuery<BestWeekDetails>({
    queryKey: [`/api/stats/week-details?weekStart=${weekStart}`],
    enabled: open && !!weekStart,
  });

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
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
                  onClick={() => onOpenChange(false)}
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
  );
}
