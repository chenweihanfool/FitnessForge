import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DayEntriesData } from "./types";

export function DayEntriesDialog({ date, dayName, onClose }: { date: string | null; dayName: string; onClose: () => void }) {
  const { data: dayEntriesData, isLoading: dayEntriesLoading } = useQuery<DayEntriesData>({
    queryKey: ["/api/stats/entries-by-date", date],
    queryFn: async () => {
      const response = await fetch(`/api/stats/entries-by-date?date=${encodeURIComponent(date!)}`);
      if (!response.ok) throw new Error('Failed to fetch day entries');
      return response.json();
    },
    enabled: !!date,
  });

  return (
      <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{dayName}锻炼记录</DialogTitle>
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
              onClick={() => onClose()}
              data-testid="button-close-day-entries"
            >
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  );
}
