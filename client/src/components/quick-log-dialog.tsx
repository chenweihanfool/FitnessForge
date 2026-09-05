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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Dumbbell, Heart, Footprints, Activity } from "lucide-react";

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

  // 本週訓練進度 = 本週值 ÷ 歷史週平均，用來當預設排序的依據——還沒練到的、
  // 練得比平常少的排前面，方便使用者快速找到「今天該練什麼」。沒有歷史週
  // 平均可比（全新運動、或這項運動從沒練過）視為跟「完全沒練」同一優先級
  // （progressPct = 0），一樣排在前面，不會因為缺資料而被排到後面去。
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
      const pa = progressByExerciseId.get(a.id)?.progressPct ?? 0;
      const pb = progressByExerciseId.get(b.id)?.progressPct ?? 0;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name, 'zh-Hant');
    });
  }, [exercises, search, progressByExerciseId]);

  const handleSelect = (exerciseId: string) => {
    onOpenChange(false);
    setSearch("");
    onSelectExercise(exerciseId);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setSearch(""); }}>
      <DialogContent className="max-h-[85vh] flex flex-col" data-testid="dialog-quick-log">
        <DialogHeader>
          <DialogTitle>快速記錄</DialogTitle>
          <DialogDescription>選擇運動項目，直接跳轉新增記錄並預填該動作</DialogDescription>
        </DialogHeader>
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
        <ScrollArea className="flex-1 -mx-1 px-1" style={{ maxHeight: '55vh' }}>
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
                      <p className="font-medium truncate">{exercise.name}</p>
                      {progress && progress.currentWeekValue > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          本週已練 {progress.currentWeekValue.toFixed(1)} {progress.unit}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">本週尚未記錄</p>
                      )}
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
