import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Exercise } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Dumbbell, Heart, Footprints, Activity } from "lucide-react";
import { useTrainingOverview } from "@/hooks/use-training";
import { AcwrAlert } from "@/components/training/acwr-alert";
import { displayLabel } from "@shared/labels";

type QuickLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectExercise: (exerciseId: string) => void;
};

interface WeeklyProgress {
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
  }>;
}

const CATEGORY_ICON: Record<string, typeof Dumbbell> = {
  '力量': Dumbbell,
  '有氧': Heart,
  '活动量': Footprints,
};

export function QuickLogDialog({ open, onOpenChange, onSelectExercise }: QuickLogDialogProps) {
  const [search, setSearch] = useState("");

  const { data: exercises, isLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
    enabled: open,
  });
  const { data: weeklyProgress } = useQuery<WeeklyProgress>({
    queryKey: ["/api/stats/weekly-progress"],
    enabled: open,
  });

  const { data: overview } = useTrainingOverview({ enabled: open });
  // 預設排序：比平常更久沒練的排前面（逾期倍數 = 距上次天數 ÷ 平常的練習間隔），
  // 方便使用者快速找到「最近比較少練的項目」。沒練過或停練很久（沒有間隔資料）的
  // 排在有資料的後面，同樣照名稱排。
  const recencyByExerciseId = useMemo(
    () => new Map((overview?.recovery.exerciseRecency ?? []).map((r) => [r.exerciseId, r])),
    [overview],
  );

  // 本週訓練進度 = 本週值 ÷ 歷史週平均，只用來顯示每個項目旁邊的百分比 badge。
  const progressByExerciseId = useMemo(() => {
    const map = new Map<string, { progressPct: number; hasHistory: boolean; currentWeekValue: number; unit: string }>();
    weeklyProgress?.exercises.forEach((e) => {
      const progressPct = e.weeklyAverage && e.weeklyAverage > 0
        ? (e.currentWeekValue / e.weeklyAverage) * 100
        : 0;
      map.set(e.exerciseId, {
        progressPct,
        hasHistory: e.weeklyAverage !== null && e.weeklyAverage > 0,
        currentWeekValue: e.currentWeekValue,
        unit: e.exerciseUnit,
      });
    });
    return map;
  }, [weeklyProgress]);

  const sortedExercises = useMemo(() => {
    if (!exercises) return [];
    const keyword = search.trim().toLowerCase();
    const filtered = keyword
      ? exercises.filter((e) => e.name.toLowerCase().includes(keyword))
      : exercises;
    return [...filtered].sort((a, b) => {
      const ra = recencyByExerciseId.get(a.id)?.overdueRatio ?? -1;
      const rb = recencyByExerciseId.get(b.id)?.overdueRatio ?? -1;
      if (ra !== rb) return rb - ra;
      return a.name.localeCompare(b.name, 'zh-Hant');
    });
  }, [exercises, search, recencyByExerciseId]);

  const handleSelect = (exerciseId: string) => {
    onOpenChange(false);
    setSearch("");
    onSelectExercise(exerciseId);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setSearch(""); }}>
      {/* 不額外包一層 ScrollArea／flex 容器：base DialogContent（@/components/ui/dialog）
          本身就已經是 max-h-[90vh] overflow-y-auto，跟 entries.tsx／
          ranking-detail-dialog.tsx 用的是同一份，讓整個對話方塊（含標題、搜尋框、
          清單）一起用瀏覽器原生滾動捲動——先前疊了一層 ScrollArea + flex-1，
          在 flex 版面裡高度沒有正確被限制住，結果變成內層吃掉觸控滾動事件、
          但自己又沒有實際可捲動的空間，手機版整個對話方塊完全無法捲動。 */}
      <DialogContent data-testid="dialog-quick-log">
        <DialogHeader>
          <DialogTitle>快速記錄</DialogTitle>
          <DialogDescription>選擇運動項目，直接跳轉新增記錄並預填上次的內容</DialogDescription>
        </DialogHeader>
        <AcwrAlert />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="搜尋運動項目…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            data-testid="input-quick-log-search"
          />
        </div>
        {isLoading ? (
          <div className="space-y-2 py-1">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : sortedExercises.length > 0 ? (
          <div className="space-y-1.5 py-1">
            {sortedExercises.map((exercise) => {
              const progress = progressByExerciseId.get(exercise.id);
              const recency = recencyByExerciseId.get(exercise.id);
              const Icon = (exercise.category && CATEGORY_ICON[exercise.category]) || Activity;
              return (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => handleSelect(exercise.id)}
                  className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover-elevate active-elevate-2"
                  data-testid={`quick-log-option-${exercise.id}`}
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{displayLabel(exercise.name)}</p>
                    <p className="text-xs text-muted-foreground">
                      {progress && progress.currentWeekValue > 0
                        ? `本週已練 ${progress.currentWeekValue.toFixed(1)} ${progress.unit}`
                        : "本週尚未記錄"}
                      {recency && (
                        <span className={recency.overdueRatio >= 1 ? "ml-2 text-primary" : "ml-2"} data-testid={`quick-log-recency-${exercise.id}`}>
                          ・{recency.daysSince === 0 ? "今天練過" : `${recency.daysSince} 天沒練`}
                        </span>
                      )}
                    </p>
                  </div>
                  {progress?.hasHistory ? (
                    <Badge
                      variant={progress.progressPct < 100 ? "outline" : "secondary"}
                      className="shrink-0"
                      data-testid={`quick-log-progress-${exercise.id}`}
                    >
                      {progress.progressPct.toFixed(0)}%
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-muted-foreground">
                      尚無資料
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">找不到符合的運動項目</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
