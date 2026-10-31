import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Footprints, Pencil, Plus } from "lucide-react";
import type { Exercise } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateWorkoutData } from "@/lib/queryClient";

// 標頭列的「本週每日平均步數」快速更新。
export function StepsCard() {
  const { toast } = useToast();
  const { data: exercises } = useQuery<Exercise[]>({ queryKey: ["/api/exercises"] });

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
      toast({ title: "步數已更新" });
    },
    onError: () => {
      toast({ title: "更新失敗", variant: "destructive" });
    },
  });

  return (
    <>
      {stepsLoaded && stepsExerciseId && (
        <Card data-testid="card-steps-quick-update">
          <CardContent className="flex items-center justify-between gap-4 py-3 px-4">
            <div className="flex items-center gap-2">
              <Footprints className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">本週每日平均步數</span>
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
      <Dialog open={showStepsDialog} onOpenChange={setShowStepsDialog}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>{stepsData ? '更新每日平均步數' : '記錄步數'}</DialogTitle>
            <DialogDescription>
              {stepsData
                ? `目前記錄：每日 ${stepsData.dailyAverage.toLocaleString()} 步（週總計 ${stepsData.value.toLocaleString()} 步）${stepsData.source === 'auto' ? '，系統自動估算值，輸入後將改為手動記錄' : ''}`
                : '輸入本週每日平均步數'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">每日平均步數</label>
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
                  週總計：{(Number(stepsInput) * 7).toLocaleString()} 步
                </p>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!stepsInput || Number(stepsInput) <= 0 || stepsMutation.isPending}
              onClick={() => stepsMutation.mutate(Number(stepsInput))}
              data-testid="button-steps-confirm"
            >
              {stepsMutation.isPending ? '更新中...' : '確認'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
