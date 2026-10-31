import { Link } from "wouter";
import { BedDouble, CalendarClock, ChevronRight, Dumbbell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MUSCLE_DUE_DAYS, type MuscleStatus, type OverdueExercise } from "@shared/training/recovery";
import { useTrainingOverview } from "@/hooks/use-training";
import { displayLabel } from "@shared/labels";

const addEntryHref = (exerciseId: string) => `/entries?addExercise=${exerciseId}`;

function MuscleRow({ muscle }: { muscle: MuscleStatus }) {
  const fatigued = muscle.status === "fatigued";
  const due = muscle.status === "due";
  // 條的長度 = 距離上次練了多久 ÷「該練了」門檻的兩倍，一眼看出誰最久沒練
  const barPct = muscle.daysSince === null ? 100 : Math.min(100, (muscle.daysSince / (MUSCLE_DUE_DAYS * 2)) * 100);
  return (
    <div className="space-y-1.5" data-testid={`muscle-status-${muscle.name}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{displayLabel(muscle.name)}</span>
        <span className="text-xs text-muted-foreground">
          {fatigued ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <BedDouble className="h-3 w-3" />疲勞偏高（ACWR {muscle.acwr}）建議休息
            </span>
          ) : muscle.daysSince === null ? (
            "近期沒練過"
          ) : muscle.daysSince === 0 ? (
            "今天練過"
          ) : (
            `${muscle.daysSince} 天沒練`
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${fatigued ? "bg-amber-500" : due ? "bg-primary" : "bg-green-500/70"}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      {muscle.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {muscle.suggestions.map((s) => (
            <Link
              key={s.exerciseId}
              href={addEntryHref(s.exerciseId)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs hover-elevate active-elevate-2"
              data-testid={`suggest-${s.exerciseId}`}
            >
              <Dumbbell className="h-3 w-3" />{s.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function OverdueRow({ item }: { item: OverdueExercise }) {
  return (
    <Link
      href={addEntryHref(item.exerciseId)}
      className="flex items-center gap-3 rounded-lg border p-3 hover-elevate active-elevate-2"
      data-testid={`overdue-${item.exerciseId}`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.daysSince} 天沒練・平常約每 {item.typicalIntervalDays} 天練一次
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
        {item.overdueRatio}×
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

// 取代原本的 AI 週計畫：不排課表，只告訴你哪些肌群/項目比平常更久沒練，
// 以及該肌群現在是否已經疲勞（用該肌群自己的 ACWR 判斷）。
export function RecoveryCard() {
  const { data, isLoading } = useTrainingOverview();
  const recovery = data?.recovery;
  return (
    <Card data-testid="card-recovery">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          久沒練的項目
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading || !recovery ? (
          <Skeleton className="h-40 w-full" />
        ) : recovery.muscles.length === 0 ? (
          <p className="text-sm text-muted-foreground">還沒有足夠的訓練記錄，記錄幾次之後這裡會提醒你哪些肌群久沒練。</p>
        ) : (
          <>
            <div className="space-y-3">
              {recovery.muscles.map((m) => (
                <MuscleRow key={m.name} muscle={m} />
              ))}
            </div>
            {recovery.overdueExercises.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">比平常久沒練的動作</p>
                <div className="space-y-1.5">
                  {recovery.overdueExercises.map((item) => (
                    <OverdueRow key={item.exerciseId} item={item} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
