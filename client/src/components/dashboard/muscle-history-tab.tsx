import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { MuscleHistory, MuscleHistoryWeek, MuscleProgress, ProgressStatus } from "@shared/training/muscle-history";
import { displayLabel } from "@shared/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { makeChartTooltip } from "@/components/training/chart-tooltip";

const RANGES = [
  { key: 26, label: "半年" },
  { key: 52, label: "一年" },
  { key: 0, label: "全部" },
];

// 熱力圖的色階：單一色相由淺到深，100% 是「剛好維持」
const HEAT_STEPS = [
  { min: 150, opacity: 1, label: "150%+" },
  { min: 100, opacity: 0.72, label: "100–149%" },
  { min: 50, opacity: 0.42, label: "50–99%" },
  { min: 1, opacity: 0.18, label: "1–49%" },
];

const heatStyle = (value: number) => {
  const step = HEAT_STEPS.find((s) => value >= s.min);
  return step ? { backgroundColor: `hsl(var(--chart-1) / ${step.opacity})` } : undefined;
};

const STATUS: Record<ProgressStatus, { label: string; icon: LucideIcon | null; className: string; order: number }> = {
  down: { label: "退步", icon: ArrowDown, className: "text-red-600 dark:text-red-400", order: 0 },
  flat: { label: "持平", icon: Minus, className: "text-muted-foreground", order: 1 },
  up: { label: "進步", icon: ArrowUp, className: "text-green-600 dark:text-green-400", order: 2 },
  insufficient: { label: "資料不足", icon: null, className: "text-muted-foreground", order: 3 },
};

const shortDate = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
};

function Panel({ title, sub, className = "", children }: { title: string; sub?: string; className?: string; children: React.ReactNode }) {
  return (
    <Card className={`min-w-0 ${className}`}>
      <CardContent className="space-y-3 p-4 md:p-5">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Heatmap({ history, weeks, selected, onSelect }: {
  history: MuscleHistory;
  weeks: MuscleHistoryWeek[];
  selected: string;
  onSelect: (weekStart: string) => void;
}) {
  // 最新的週在最右邊，手機寬度放不下時預設捲到那裡
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [weeks.length]);

  return (
    <div ref={scroller} className="overflow-x-auto" data-testid="muscle-heatmap">
      <table className="border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card" />
            {weeks.map((w, i) => (
              <th key={w.weekStart} className="h-5 min-w-5 p-0 align-bottom font-normal text-muted-foreground">
                {i % 4 === 0 && <span className="block w-0 whitespace-nowrap tabular-nums">{shortDate(w.weekStart)}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.axes.map((axis, row) => (
            <tr key={axis.name}>
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-card pr-2 text-left font-medium">{displayLabel(axis.name)}</th>
              {weeks.map((w) => {
                const value = w.values[row];
                const isSelected = w.weekStart === selected;
                return (
                  <td key={w.weekStart} className="p-0">
                    <button
                      type="button"
                      onClick={() => onSelect(w.weekStart)}
                      title={`${displayLabel(axis.name)}・${shortDate(w.weekStart)} 當週：${value}%${w.isCurrent ? "（進行中）" : ""}`}
                      aria-label={`${displayLabel(axis.name)} ${shortDate(w.weekStart)} 當週 ${value}%`}
                      style={heatStyle(value)}
                      className={`block h-6 w-5 rounded-sm ${value === 0 ? "bg-muted" : ""} ${isSelected ? "ring-2 ring-foreground/60" : ""} ${w.isCurrent ? "opacity-60" : ""}`}
                      data-testid={`heat-${axis.name}-${w.weekStart}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const W = 96;
  const H = 24;
  const top = Math.max(100, ...values);
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 2 - (v / top) * (H - 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`近 ${values.length} 週：${values.join("、")}%`}>
      <line x1={0} x2={W} y1={y(100)} y2={y(100)} stroke="hsl(var(--border))" strokeDasharray="3 3" />
      <polyline points={values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} fill="none" stroke="hsl(var(--chart-1))" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

function ProgressTable({ rows }: { rows: MuscleProgress[] }) {
  const sorted = [...rows].sort((a, b) => STATUS[a.status].order - STATUS[b.status].order);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums" data-testid="muscle-progress-table">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            {["肌群", "狀態", "近 4 週", "前 4 週", "近 12 週"].map((h, i) => (
              <th key={h} className={`whitespace-nowrap px-2 py-2 font-medium ${i < 2 ? "text-left" : "text-right"} ${i === 3 ? "hidden sm:table-cell" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const status = STATUS[p.status];
            return (
              <tr key={p.name} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-2 py-2 font-medium">{displayLabel(p.name)}</td>
                <td className={`whitespace-nowrap px-2 py-2 ${status.className}`}>
                  <span className="inline-flex items-center gap-1">
                    {status.icon && <status.icon className="h-3.5 w-3.5" />}
                    {status.label}
                  </span>
                </td>
                <td className="px-2 py-2 text-right">{p.recentAvg}%</td>
                <td className="hidden px-2 py-2 text-right text-muted-foreground sm:table-cell">{p.prevAvg === null ? "—" : `${p.prevAvg}%`}</td>
                <td className="px-2 py-2"><div className="flex justify-end"><Sparkline values={p.spark} /></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const RADAR_DOMAIN: [number, number] = [0, 200];
const clampForRadar = (value: number) => Math.min(value, RADAR_DOMAIN[1]);
const PERIOD_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

function HistoryRadar({ axes, series }: {
  axes: MuscleHistory["axes"];
  series: { key: string; label: string; values: number[] }[];
}) {
  const data = axes.map((axis, i) => ({
    name: displayLabel(axis.name),
    baseline: 100,
    ...Object.fromEntries(series.flatMap((s) => [[s.key, clampForRadar(s.values[i])], [`${s.key}Raw`, s.values[i]]])),
  })) as Array<Record<string, string | number>>;
  const RadarTooltip = makeChartTooltip<(typeof data)[number]>((d) => ({
    title: String(d.name),
    rows: series.map((s) => ({ label: s.label, value: `${d[`${s.key}Raw`]}%` })),
  }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="hsl(var(--muted-foreground) / 0.25)" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--foreground) / 0.75)" }} />
          <PolarRadiusAxis domain={RADAR_DOMAIN} ticks={[0, 100, 200] as any} tick={false} axisLine={false} />
          <Tooltip content={RadarTooltip} />
          {series.length > 1 && <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />}
          <Radar name="維持量" dataKey="baseline" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 3" strokeWidth={1} fill="transparent" dot={false} legendType="none" />
          {[...series].reverse().map((s) => {
            const color = PERIOD_COLORS[series.indexOf(s)];
            return <Radar key={s.key} name={s.label} dataKey={s.key} stroke={color} strokeWidth={2} fill={color} fillOpacity={series.indexOf(s) === 0 ? 0.18 : 0} dot={false} />;
          })}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 「肌群歷史」分頁：看每個肌群這段時間怎麼變，資料見 shared/training/muscle-history.ts。
export function MuscleHistoryTab() {
  const { data: history, isLoading } = useQuery<MuscleHistory>({ queryKey: ["/api/stats/muscle-history"] });
  const [range, setRange] = useState(26);
  const [picked, setPicked] = useState<string | null>(null);

  const weeks = useMemo(() => (history ? (range ? history.weeks.slice(-range) : history.weeks) : []), [history, range]);

  if (isLoading || !history) return <Skeleton className="h-96" />;

  const complete = history.weeks.filter((w) => !w.isCurrent);
  const hasTraining = history.weeks.some((w) => w.values.some((v) => v > 0));
  if (!hasTraining) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">還沒有訓練記錄。</CardContent>
      </Card>
    );
  }

  const selectedWeek = history.weeks.find((w) => w.weekStart === picked) ?? complete[complete.length - 1] ?? history.weeks[history.weeks.length - 1];

  return (
    <div className="space-y-4 xl:space-y-5" data-testid="muscle-history">
      <Panel title="每週肌群熱力圖" sub="數字是組數 ÷ 該肌群維持量，100% 是剛好維持，有氧看分鐘數。顏色越深練得越多，灰色是那週沒練。點格子看當週雷達。">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex overflow-hidden rounded-md border" role="group" aria-label="顯示範圍">
            {RANGES.map((r) => (
              <button key={r.key} type="button" onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 text-xs ${range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-muted" />沒練</span>
            {[...HEAT_STEPS].reverse().map((s) => (
              <span key={s.label} className="flex items-center gap-1 tabular-nums">
                <i className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: `hsl(var(--chart-1) / ${s.opacity})` }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <Heatmap history={history} weeks={weeks} selected={selectedWeek.weekStart} onSelect={setPicked} />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-5 xl:gap-5">
        <Panel title="哪個肌群在進步" sub="比較近 4 週與前 4 週的平均達成率，差 15% 以上才算進步或退步；不含進行中的週。" className="xl:col-span-3">
          <ProgressTable rows={history.progress} />
        </Panel>
        <Panel title={`${shortDate(selectedWeek.weekStart)} 當週`} sub={`訓練 ${selectedWeek.trainingDays} 天${selectedWeek.isCurrent ? "，這週還在進行中" : ""}。虛線是維持量，超過 200% 的畫到邊界為止。`} className="xl:col-span-2">
          <HistoryRadar axes={history.axes} series={[{ key: "week", label: "當週", values: selectedWeek.values }]} />
        </Panel>
      </div>

      {history.periods.length > 1 && (
        <Panel title="跟過去的自己比" sub="各區間是連續 4 週的平均達成率。">
          <div className="mx-auto max-w-2xl">
            <HistoryRadar axes={history.axes} series={history.periods} />
          </div>
        </Panel>
      )}
    </div>
  );
}
