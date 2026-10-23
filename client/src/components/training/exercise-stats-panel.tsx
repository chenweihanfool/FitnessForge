import { Area, AreaChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Flame, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Exercise } from "@shared/schema";
import { estimateOneRepMax, isRepUnit } from "@shared/training/load";
import type { ExerciseRecord, ExerciseStats } from "@shared/training/exercise-stats";
import { useExerciseStats } from "@/hooks/use-training";

// 使用者正在輸入、還沒送出的這一筆，用來即時跟紀錄比較
export interface DraftSet {
  value?: number;
  sets?: number;
  load?: number | null;
}

const METRIC_LABEL = { e1rm: "預估 1RM", load: "負重", value: "單次" } as const;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const shortDate = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 8 * 3600e3);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const daysAgoText = (days: number) => (days === 0 ? "今天" : days === 1 ? "昨天" : `${days} 天前`);

function describeSet(s: { value: number; sets: number; load: number | null }, unit: string, usesLoad: boolean) {
  const reps = `${s.sets > 1 ? `${fmt(s.sets)} 組 × ` : ""}${fmt(s.value)} ${unit}`;
  return usesLoad && s.load ? `${reps} @ ${fmt(s.load)} kg` : reps;
}

function RecordTile({ title, record, suffix, highlight }: { title: string; record: ExerciseRecord | null; suffix: string; highlight?: boolean }) {
  if (!record) return null;
  return (
    <div
      className={`rounded-md border p-2 ${highlight ? "border-primary/40 bg-primary/5" : "bg-muted/30"}`}
      data-testid={`record-${title}`}
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {highlight && <Trophy className="h-3 w-3 text-primary" />}
        {title}
      </div>
      <div className="text-lg font-semibold tabular-nums leading-tight">
        {fmt(record.amount)}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{suffix}</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{shortDate(record.date)}</div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: ExerciseStats["trend"] }) {
  if (trend === "up") return <ArrowUpRight className="h-4 w-4 text-green-500" aria-label="進步中" />;
  if (trend === "down") return <ArrowDownRight className="h-4 w-4 text-amber-500" aria-label="退步中" />;
  if (trend === "flat") return <ArrowRight className="h-4 w-4 text-muted-foreground" aria-label="持平" />;
  return null;
}

function HistoryChart({ stats, height }: { stats: ExerciseStats; height: number }) {
  const data = stats.history.map((h) => ({ ...h, label: shortDate(h.date) }));
  const unit = stats.metric === "value" ? stats.unit : "kg";
  return (
    <div style={{ height }} data-testid="exercise-history-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: height > 100 ? -16 : 0 }}>
          {/* compact 版也要保留（隱藏的）座標軸，新紀錄的圓點才有座標可以定位 */}
          <XAxis dataKey="label" hide={height <= 100} tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis hide={height <= 100} tick={{ fontSize: 10 }} domain={["dataMin - 2", "dataMax + 2"]} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(v) => [`${v} ${unit}`, METRIC_LABEL[stats.metric]]}
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.date as string | undefined) ?? ""}
          />
          <Area type="monotone" dataKey="metricValue" className="fill-primary/20 stroke-primary" strokeWidth={2} dot={false} />
          {data.map((p, i) =>
            p.isPr ? (
              <ReferenceDot key={i} x={p.label} y={p.metricValue} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1} ifOverflow="visible" />
            ) : null,
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// 新增記錄時顯示的「這個項目的歷史」：上次做了什麼、各項最高紀錄、歷史軌跡，
// 並把使用者正在輸入的這一組即時對照紀錄（接近/打破 PR）。
// size="full" 用在運動項目頁的詳細檢視（圖表較大、多列近期記錄）。
export function ExerciseStatsPanel({
  exercise,
  draft,
  size = "compact",
}: {
  exercise: Exercise;
  draft?: DraftSet;
  size?: "compact" | "full";
}) {
  const { data: stats, isLoading } = useExerciseStats(exercise.id);

  if (isLoading) return <Skeleton className="h-28 w-full" />;
  if (!stats || stats.sessionCount === 0) {
    return (
      <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground" data-testid="exercise-stats-empty">
        這是你第一次記錄「{exercise.name}」，完成後這裡會開始累積歷史紀錄。
      </p>
    );
  }

  const usesLoad = stats.hasLoad;
  const unit = stats.unit;

  // 草稿跟紀錄比：主指標與 stats.metric 同一種
  const draftLoad = draft?.load ?? null;
  const draftMetric = (() => {
    if (!draft?.value || draft.value <= 0) return null;
    if (stats.metric === "e1rm") return draftLoad && isRepUnit(unit) ? estimateOneRepMax(draftLoad, draft.value) : null;
    if (stats.metric === "load") return draftLoad && draftLoad > 0 ? draftLoad : null;
    return draft.value;
  })();
  const primaryRecord =
    stats.metric === "e1rm" ? stats.records.bestE1rm : stats.metric === "load" ? stats.records.maxLoad : stats.records.maxValue;
  const vsRecordPct = draftMetric && primaryRecord ? (draftMetric / primaryRecord.amount) * 100 : null;
  const isNewPr = vsRecordPct !== null && vsRecordPct > 100.05;

  const lastLoad = stats.last?.load ?? null;
  const loadDelta = draftLoad != null && lastLoad != null ? Math.round((draftLoad - lastLoad) * 100) / 100 : null;

  const metricSuffix = stats.metric === "value" ? unit : "kg";
  const recentRows = size === "full" ? stats.history.slice(-8).reverse() : [];

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3" data-testid="exercise-stats-panel">
      {stats.last && (
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] text-muted-foreground">上次・{daysAgoText(stats.last.daysAgo)}</div>
            <div className="text-sm font-semibold" data-testid="text-last-session">
              {describeSet(stats.last, unit, usesLoad)}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendIcon trend={stats.trend} />
            {stats.trend === "up" ? "進步中" : stats.trend === "down" ? "近期下滑" : stats.trend === "flat" ? "持平" : ""}
          </div>
        </div>
      )}

      {draftMetric !== null && primaryRecord && (
        <div className="space-y-1" data-testid="draft-vs-record">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              本次 {METRIC_LABEL[stats.metric]} {fmt(Math.round(draftMetric * 10) / 10)} {metricSuffix}
              {loadDelta !== null && loadDelta !== 0 && (
                <span className={loadDelta > 0 ? "ml-1.5 text-green-600 dark:text-green-400" : "ml-1.5 text-amber-600 dark:text-amber-400"}>
                  較上次 {loadDelta > 0 ? "+" : ""}
                  {loadDelta} kg
                </span>
              )}
            </span>
            {isNewPr ? (
              <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400" data-testid="badge-new-pr">
                <Flame className="h-3.5 w-3.5" />打破紀錄
              </span>
            ) : (
              <span className="tabular-nums text-muted-foreground">{Math.round(vsRecordPct!)}% 紀錄</span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${isNewPr ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${Math.min(100, vsRecordPct!)}%` }}
            />
          </div>
        </div>
      )}

      <div className={`grid gap-2 ${usesLoad ? "grid-cols-3" : "grid-cols-2"}`}>
        {usesLoad ? (
          <>
            <RecordTile title="最高負重" record={stats.records.maxLoad} suffix="kg" highlight={stats.metric === "load"} />
            <RecordTile title="預估 1RM" record={stats.records.bestE1rm} suffix="kg" highlight={stats.metric === "e1rm"} />
            <RecordTile title="單日最大容量" record={stats.records.bestVolume} suffix="kg·次" />
          </>
        ) : (
          <>
            <RecordTile title="單次最高" record={stats.records.maxValue} suffix={unit} highlight />
            <RecordTile title="單日最高訓練分" record={stats.records.bestVolume} suffix="分" />
          </>
        )}
      </div>

      {stats.history.length > 1 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{METRIC_LABEL[stats.metric]}軌跡（近 {stats.history.length} 次訓練日）</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" />新紀錄</span>
          </div>
          <HistoryChart stats={stats} height={size === "full" ? 180 : 72} />
        </div>
      )}

      {recentRows.length > 0 && (
        <table className="w-full text-xs" data-testid="exercise-recent-table">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-normal">日期</th>
              {usesLoad && <th className="py-1 font-normal">最高負重</th>}
              <th className="py-1 font-normal">單組最高</th>
              <th className="py-1 text-right font-normal">{usesLoad ? "容量" : "訓練分"}</th>
            </tr>
          </thead>
          <tbody>
            {recentRows.map((r) => (
              <tr key={r.date} className="border-t">
                <td className="py-1">{r.date.slice(5)}{r.isPr && <Flame className="ml-1 inline h-3 w-3 text-amber-500" />}</td>
                {usesLoad && <td className="py-1 tabular-nums">{r.load != null ? `${fmt(r.load)} kg` : "—"}</td>}
                <td className="py-1 tabular-nums">{fmt(r.value)} {unit}</td>
                <td className="py-1 text-right tabular-nums">{fmt(r.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
