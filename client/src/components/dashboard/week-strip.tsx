import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import type { MuscleHistory } from "@shared/training/muscle-history";
import { dayIndexToKey, taipeiDayIndex } from "@shared/training/time";
import { Card, CardContent } from "@/components/ui/card";
import type { DailyContributions } from "./types";

const toDateKey = (date: Date | string) => dayIndexToKey(taipeiDayIndex(date));

const WEEKDAYS = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];

// 首頁的本週七天訓練條：哪天練了、練多少，點一下看當天記錄；右邊是連續達標週數。
export function WeekStrip({ onSelectDay }: { onSelectDay: (day: { date: string; name: string }) => void }) {
  const { data: daily } = useQuery<DailyContributions>({ queryKey: ["/api/stats/daily-contributions"] });
  const { data: history } = useQuery<MuscleHistory>({ queryKey: ["/api/stats/muscle-history"] });

  if (!daily) return null;

  const today = toDateKey(new Date());
  const peak = Math.max(1, ...daily.dailyData.map((d) => (d.entryCount > 0 ? d.baselineValue : 0)));
  const streak = history?.streak;

  return (
    <Card data-testid="card-week-strip">
      <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-3 p-3">
        <div className="grid min-w-0 flex-[1_1_18rem] grid-cols-7 gap-1.5">
          {daily.dailyData.map((d, i) => {
            const key = toDateKey(d.date);
            const trained = d.entryCount > 0;
            const isToday = key === today;
            const isFuture = key > today;
            return (
              <button
                key={d.date}
                type="button"
                disabled={!trained}
                onClick={() => onSelectDay({ date: d.date, name: WEEKDAYS[i] })}
                aria-label={`${WEEKDAYS[i]}${trained ? ` ${d.entryCount} 筆記錄` : isFuture ? "" : " 休息"}`}
                className={`flex flex-col items-center gap-1 rounded-md px-1 py-1.5 text-xs transition-colors ${trained ? "cursor-pointer hover:bg-muted" : ""} ${isToday ? "bg-muted/70 font-semibold" : ""}`}
                data-testid={`week-strip-day-${i}`}
              >
                <span className="text-muted-foreground">{WEEKDAYS[i].slice(1)}</span>
                <span className="flex h-7 w-full items-end justify-center">
                  <span
                    className={`w-3 rounded-sm ${trained ? "bg-primary" : isFuture ? "" : "bg-muted"}`}
                    style={{ height: trained ? `${Math.max(20, (d.baselineValue / peak) * 100)}%` : "12%" }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        {streak && (
          <div className="flex shrink-0 items-center gap-2 text-sm" data-testid="streak">
            <Flame className={`h-5 w-5 ${streak.current > 0 ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <p className="font-semibold tabular-nums">連續達標 {streak.current} 週</p>
              <p className="text-xs tabular-nums text-muted-foreground">每週 {streak.target} 天，最佳 {streak.best} 週</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
