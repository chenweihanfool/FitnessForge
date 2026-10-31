import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, FileText, Info, Plus, Star, Trophy } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { makeChartTooltip } from "@/components/training/chart-tooltip";
import { ACWR_DANGER, ACWR_SWEET_HIGH, ACWR_SWEET_LOW, type AcwrZone } from "@shared/training/acwr";
import { type ReportDay, type ReportObservation, type ReportScore, type ReportTrendWeek, type WeeklyReport } from "@shared/training/weekly-report";
import { displayLabel } from "@shared/labels";

const WEEKDAYS = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];
const STRENGTH = "hsl(var(--chart-1))";
const CARDIO = "hsl(var(--chart-2))";

const ZONE_LABEL: Record<AcwrZone, string> = {
  insufficient: "資料不足",
  low: "負荷偏低",
  optimal: "甜蜜點",
  caution: "注意疲勞",
  danger: "高風險",
};

const num = (n: number, digits = 0) => n.toLocaleString("zh-TW", { maximumFractionDigits: digits });
const shortDate = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
};
const longDate = (key: string) => key.replace(/-0?/g, "/");

/** 跟比較值的差距百分比；比較值是 0 時不顯示 */
function pctChange(current: number, base: number | null | undefined): number | null {
  if (!base) return null;
  return Math.round((current / base - 1) * 100);
}

function Delta({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) return <span>{label}：—</span>;
  const up = pct >= 0;
  return (
    <span className="inline-flex items-center gap-0.5">
      {label}
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      <span className="font-medium tabular-nums text-foreground">{Math.abs(pct)}%</span>
    </span>
  );
}

function Tile({ label, value, unit, foot, testId }: { label: string; value: string; unit?: string; foot: ReactNode; testId: string }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {value}
          {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{foot}</p>
      </CardContent>
    </Card>
  );
}

function Panel({ title, sub, className = "", children, testId }: { title: string; sub?: string; className?: string; children: ReactNode; testId?: string }) {
  return (
    <Card className={`min-w-0 ${className}`} data-testid={testId}>
      <CardContent className="space-y-3 p-4 md:p-5">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

const OBSERVATION_ICON = {
  good: { icon: CheckCircle2, className: "text-green-600 dark:text-green-400", label: "良好" },
  warn: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400", label: "注意" },
  info: { icon: Info, className: "text-muted-foreground", label: "資訊" },
};

function Observations({ items }: { items: ReportObservation[] }) {
  return (
    <ul className="space-y-2.5 text-sm" data-testid="report-observations">
      {items.map((o) => {
        const { icon: Icon, className, label } = OBSERVATION_ICON[o.tone];
        return (
          <li key={o.text} className="flex gap-2">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} aria-label={label} />
            <span>{o.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Milestones({ report }: { report: WeeklyReport }) {
  const m = report.milestones;
  const stages = [
    { name: "參與", done: m.hasEntry, detail: `${m.trainingDays} 天有訓練` },
    { name: "紀律", done: m.hasDiscipline, detail: `${m.trainingDays}/3 天` },
    { name: "容量", done: m.totalAbove, detail: `${num(report.score.total)} / 生涯均 ${num(report.careerAvgTotal)}` },
    { name: "強度", done: m.allMusclesAtMaintenance, detail: `${m.musclesMetCount}/${m.musclesTotalCount} 肌群達標` },
    { name: "突破", done: m.breakthrough, detail: m.inTop10 ? "生涯前 10%" : m.isFourWeekHigh ? "4 週新高" : "未達成" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" aria-label={`里程碑 ${m.achievedCount} / 5`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} className={`h-5 w-5 ${star <= m.achievedCount ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
          ))}
        </div>
        {report.rank > 0 && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />
            <span className="tabular-nums">第 {report.rank} / {report.totalWeeks} 週</span>
          </span>
        )}
      </div>
      <ul className="space-y-1.5 text-sm">
        {stages.map((s, i) => (
          <li key={s.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${s.done ? "bg-green-600 text-white dark:bg-green-500" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </span>
              {s.name}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{s.detail}</span>
          </li>
        ))}
      </ul>
      <p className="border-t pt-2 text-xs tabular-nums text-muted-foreground">
        連續達標 {report.streak.current} 週，最佳 {report.streak.best} 週（每週 {report.streak.target} 天）
      </p>
    </div>
  );
}

const DayTooltip = makeChartTooltip<ReportDay & { label: string }>((d) => ({
  title: `${d.label} ${shortDate(d.date)}`,
  rows: d.exercises.length
    ? d.exercises.slice(0, 6).map((e) => ({ label: e.name, value: num(e.baseline, 1) }))
    : [{ label: "休息", value: "—" }],
}));

function DailyChart({ days }: { days: ReportDay[] }) {
  const data = days.map((d, i) => ({ ...d, label: WEEKDAYS[i] }));
  return (
    <div className="h-60" role="img" aria-label={data.map((d) => `${d.label} 力量 ${d.strength} 有氧 ${d.cardio}`).join("、")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="32%">
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
          <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
          <Tooltip content={DayTooltip} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="strength" name="力量" stackId="day" fill={STRENGTH} stroke="hsl(var(--card))" strokeWidth={2} />
          <Bar dataKey="cardio" name="有氧" stackId="day" fill={CARDIO} stroke="hsl(var(--card))" strokeWidth={2} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MuscleRadar({ report }: { report: WeeklyReport }) {
  const data = report.muscles.map((m) => ({
    name: displayLabel(m.name),
    current: m.composite,
    previous: m.prevAvgComposite ?? 0,
  }));
  const RadarTooltip = makeChartTooltip<(typeof data)[number]>((d) => ({
    title: d.name,
    rows: [
      { label: "這週", value: `${d.current}%` },
      { label: "前 4 週平均", value: `${d.previous}%` },
    ],
  }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="74%">
          <PolarGrid stroke="hsl(var(--muted-foreground) / 0.25)" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--foreground) / 0.75)" }} />
          <PolarRadiusAxis domain={[0, 150]} ticks={[0, 50, 100, 150] as any} tick={false} axisLine={false} />
          <Tooltip content={RadarTooltip} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Radar name="前 4 週平均" dataKey="previous" stroke={CARDIO} strokeWidth={2} strokeDasharray="4 3" fill="transparent" dot={false} />
          <Radar name="這週" dataKey="current" stroke={STRENGTH} strokeWidth={2} fill={STRENGTH} fillOpacity={0.2} dot={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MuscleTable({ report }: { report: WeeklyReport }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums" data-testid="report-muscle-table">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            {["肌群", "組數／維持量", "複合分", "比前 4 週", "連續未達"].map((h, i) => (
              <th key={h} className={`whitespace-nowrap px-2 py-2 font-medium ${i === 0 ? "text-left" : i === 1 ? "min-w-40 text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.muscles.map((m) => {
            const fill = Math.min(100, (m.sets / m.maintenance) * 100);
            const met = m.sets >= m.maintenance;
            const shift = m.prevAvgComposite === null ? null : m.composite - m.prevAvgComposite;
            const unit = m.name === "有氧" ? "分" : "組";
            return (
              <tr key={m.name} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-2 py-2 font-medium">{displayLabel(m.name)}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${met ? "bg-green-500" : "bg-amber-500"}`} style={{ width: `${fill}%` }} />
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{num(m.sets, 1)} / {m.maintenance} {unit}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-right">{m.composite}%</td>
                <td className="px-2 py-2 text-right">
                  {shift === null ? "—" : (
                    <span className={shift >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {shift >= 0 ? "+" : "−"}{Math.abs(shift)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-right text-muted-foreground">{met ? "—" : `${m.lowStreak} 週`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TrendChart({ trend, weekStart, onPick }: { trend: ReportTrendWeek[]; weekStart: string; onPick: (week: string) => void }) {
  const TrendTooltip = makeChartTooltip<ReportTrendWeek>((w) => ({
    title: `${longDate(w.weekStart)} 當週`,
    rows: [
      { label: "綜合分", value: num(w.total, 1) },
      { label: "力量", value: num(w.strength, 1) },
      { label: "有氧", value: num(w.cardio, 1) },
      { label: "活動量", value: num(w.activity, 1) },
      { label: "訓練天數", value: `${w.trainingDays} 天` },
    ],
  }));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="weekStart" tickFormatter={shortDate} fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
          <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
          <Tooltip content={TrendTooltip} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
          <Bar dataKey="total" name="綜合分" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: { weekStart?: string }) => d.weekStart && onPick(d.weekStart)}>
            {trend.map((w) => (
              <Cell key={w.weekStart} fill={w.weekStart === weekStart ? STRENGTH : "hsl(var(--muted-foreground) / 0.35)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AcwrChart({ series, weekStart }: { series: WeeklyReport["acwr"]["series"]; weekStart: string }) {
  const data = series.filter((p) => p.ratio !== null);
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">記錄滿 28 天後才有 ACWR。</p>;
  const AcwrTooltip = makeChartTooltip<(typeof data)[number]>((p) => ({
    title: longDate(p.date),
    rows: [{ label: "ACWR", value: String(p.ratio) }],
  }));
  const top = Math.max(ACWR_DANGER + 0.2, ...data.map((p) => (p.ratio as number) + 0.1));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <ReferenceArea y1={ACWR_SWEET_LOW} y2={ACWR_SWEET_HIGH} fill="hsl(145 63% 45%)" fillOpacity={0.12} />
          <ReferenceLine y={ACWR_DANGER} stroke="hsl(var(--destructive))" strokeDasharray="4 3" />
          <ReferenceLine x={data.find((p) => p.date >= weekStart)?.date} stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={32} fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
          <YAxis domain={[0, Number(top.toFixed(1))]} ticks={[0, ACWR_SWEET_LOW, ACWR_SWEET_HIGH, ACWR_DANGER]} fontSize={12} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
          <Tooltip content={AcwrTooltip} />
          <Line dataKey="ratio" stroke={CARDIO} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function scoreRows(score: ReportScore, prev: ReportScore | null) {
  return [
    { label: "力量", value: score.strength, base: prev?.strength },
    { label: "有氧", value: score.cardio, base: prev?.cardio },
    { label: "活動量", value: score.activity, base: prev?.activity },
  ];
}

export default function WeeklyReportPage() {
  // null = 交給伺服器決定（最近一個已結束的週）
  const [week, setWeek] = useState<string | null>(null);
  const { data: report, isLoading, isError } = useQuery<WeeklyReport>({
    queryKey: [`/api/stats/weekly-report${week ? `?weekStart=${week}` : ""}`],
  });

  if (isError) {
    return <p className="p-8 text-sm text-muted-foreground">週報告載入失敗，請重新整理。</p>;
  }

  if (isLoading || !report) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-4" data-testid="page-report-loading">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const compared = report.isCurrentWeek ? "至今比前 4 週" : "比前 4 週";

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 xl:space-y-5" data-testid="page-report">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">週報告</h1>
              {report.isCurrentWeek && <Badge variant="secondary">進行中，第 {report.daysElapsed} 天</Badge>}
            </div>
            <p className="text-sm tabular-nums text-muted-foreground" data-testid="report-week-range">
              {longDate(report.weekStart)} – {shortDate(report.weekEnd)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="上一週" disabled={!report.prevWeekStart} onClick={() => setWeek(report.prevWeekStart)} data-testid="button-report-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="下一週" disabled={!report.nextWeekStart} onClick={() => setWeek(report.nextWeekStart)} data-testid="button-report-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {!report.hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            這週沒有任何訓練記錄。
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Tile testId="tile-score" label="綜合分" value={num(report.score.total, 1)}
              foot={<Delta pct={pctChange(report.score.total, report.avgPrev4?.total)} label={compared} />} />
            <Tile testId="tile-days" label="訓練天數" value={String(report.trainingDays)} unit="天"
              foot={report.prevTrainingDays === null ? "沒有上週資料" : `上週 ${report.prevTrainingDays} 天`} />
            <Tile testId="tile-sets" label="力量組數" value={num(report.strengthSets, 1)} unit="組"
              foot={<Delta pct={pctChange(report.score.strength, report.avgPrev4?.strength)} label="力量分" />} />
            <Tile testId="tile-cardio" label="有氧" value={num(report.cardioMinutes)} unit="分鐘"
              foot={<Delta pct={pctChange(report.score.cardio, report.avgPrev4?.cardio)} label="有氧分" />} />
            <Tile testId="tile-steps" label="每日平均步數" value={report.dailySteps === null ? "—" : num(report.dailySteps)}
              foot={report.dailySteps === null ? "這週沒有步數記錄" : <Delta pct={pctChange(report.score.activity, report.avgPrev4?.activity)} label="活動分" />} />
            <Tile testId="tile-acwr" label="ACWR" value={report.acwr.ratio === null ? "—" : report.acwr.ratio.toFixed(2)}
              foot={ZONE_LABEL[report.acwr.zone]} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3 xl:gap-5">
            <Panel title="這週重點" className="xl:col-span-2" testId="panel-observations">
              <Observations items={report.observations} />
            </Panel>
            <Panel title="里程碑" testId="panel-milestones">
              <Milestones report={report} />
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-5 xl:gap-5">
            <Panel title="每日訓練量" sub="力量與有氧的基準值；步數是週資料，不分到各天。滑過長條看當天做了什麼。" className="xl:col-span-3" testId="panel-daily">
              <DailyChart days={report.days} />
              <div className="grid grid-cols-3 gap-3 border-t pt-3">
                {scoreRows(report.score, report.avgPrev4).map((row) => (
                  <div key={row.label} className="min-w-0">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="font-semibold tabular-nums">{num(row.value, 1)}</p>
                    <p className="text-xs text-muted-foreground"><Delta pct={pctChange(row.value, row.base)} label={compared} /></p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="肌群雷達" sub={`這週 vs 前 4 週平均。均衡度 ${report.balance ?? "—"}%、覆蓋 ${report.coverage ?? "—"}%${report.activityBonus > 0 ? `（含活動量 +${report.activityBonus}%）` : ""}`} className="xl:col-span-2" testId="panel-radar">
              <MuscleRadar report={report} />
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3 xl:gap-5">
            <Panel title="各肌群達成" sub="組數對各肌群自己的維持量；複合分與首頁雷達圖同一套公式。" className="xl:col-span-2" testId="panel-muscles">
              <MuscleTable report={report} />
            </Panel>
            <Panel title="下週重點" sub="複合分未達 80% 的肌群，由弱到強；點動作直接新增記錄。" testId="panel-focus">
              {report.focus.length === 0 ? (
                <p className="text-sm text-muted-foreground">所有肌群都在 80% 以上。</p>
              ) : (
                <ul className="space-y-3">
                  {report.focus.map((f) => (
                    <li key={f.name} className="space-y-1.5">
                      <p className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{displayLabel(f.name)}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">複合分 {f.composite}%</span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {f.suggestions.map((s) => (
                          <Link key={s.exerciseId} href={`/entries?addExercise=${s.exerciseId}`}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20">
                            <Plus className="h-2.5 w-2.5" />
                            {s.name}
                          </Link>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
            <Panel title="近 12 週綜合分" sub="點長條切換到那一週。" testId="panel-trend">
              <TrendChart trend={report.trend} weekStart={report.weekStart} onPick={setWeek} />
            </Panel>
            <Panel title="ACWR 走勢" sub="綠帶是甜蜜點 0.8–1.3，紅虛線是高風險 1.5；直線是這週開始。" testId="panel-acwr">
              <AcwrChart series={report.acwr.series} weekStart={report.weekStart} />
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
            <Panel title="個人紀錄" sub="這週超過過去最佳的項目；第一次做的動作不算。" testId="panel-records">
              {report.records.length === 0 ? (
                <p className="text-sm text-muted-foreground">這週沒有新紀錄。</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {report.records.map((r) => (
                    <li key={r.exerciseId} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate font-medium">{r.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {r.metricLabel} <b className="text-sm text-foreground">{num(r.value, 1)}{r.unit && ` ${r.unit}`}</b>（原 {num(r.previous, 1)}）
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="主要動作" sub="依基準值排序；不含步數。" testId="panel-exercises">
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      {["動作", "基準值", "占比", "訓練日", "比前 4 週"].map((h, i) => (
                        <th key={h} className={`whitespace-nowrap px-2 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.topExercises.map((e) => {
                      const change = pctChange(e.baseline, e.prevAvg);
                      return (
                        <tr key={e.exerciseId} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-2 font-medium">{e.name}</td>
                          <td className="px-2 py-2 text-right">{num(e.baseline, 1)}</td>
                          <td className="px-2 py-2 text-right">{Math.round(e.share * 100)}%</td>
                          <td className="px-2 py-2 text-right">{e.sessions}</td>
                          <td className="px-2 py-2 text-right">{change === null ? "—" : `${change >= 0 ? "+" : "−"}${Math.abs(change)}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
