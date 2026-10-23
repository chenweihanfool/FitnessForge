import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HeartPulse, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ACWR_DANGER, ACWR_SWEET_HIGH, ACWR_SWEET_LOW, type AcwrResult } from "@shared/training/acwr";
import { useTrainingOverview } from "@/hooks/use-training";
import { ACWR_ZONE_META } from "./acwr-meta";

// 儀表條的刻度範圍 0 ~ 2.0（超過 2.0 一律貼右邊）
const GAUGE_MAX = 2;
const pct = (v: number) => `${(Math.min(v, GAUGE_MAX) / GAUGE_MAX) * 100}%`;

function ZoneGauge({ ratio }: { ratio: number | null }) {
  const zones = [
    { from: 0, to: ACWR_SWEET_LOW, cls: "bg-sky-500/70" },
    { from: ACWR_SWEET_LOW, to: ACWR_SWEET_HIGH, cls: "bg-green-500/70" },
    { from: ACWR_SWEET_HIGH, to: ACWR_DANGER, cls: "bg-amber-500/70" },
    { from: ACWR_DANGER, to: GAUGE_MAX, cls: "bg-red-500/70" },
  ];
  return (
    <div className="space-y-1" role="img" aria-label={ratio === null ? "尚無 ACWR" : `ACWR ${ratio}`}>
      <div className="relative h-3">
        <div className="h-full rounded-full overflow-hidden flex">
          {zones.map((z) => (
            <div key={z.from} className={z.cls} style={{ width: `${((z.to - z.from) / GAUGE_MAX) * 100}%` }} />
          ))}
        </div>
        {ratio !== null && (
          <span
            className="absolute -top-1 -bottom-1 w-1 -translate-x-1/2 rounded bg-foreground ring-2 ring-background"
            style={{ left: pct(ratio) }}
            data-testid="acwr-gauge-marker"
          />
        )}
      </div>
      <div className="relative h-5 text-[10px] text-muted-foreground">
        {[0, ACWR_SWEET_LOW, ACWR_SWEET_HIGH, ACWR_DANGER, GAUGE_MAX].map((tick) => (
          <span key={tick} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(tick) }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ series }: { series: AcwrResult["series"] }) {
  const data = series.map((p) => ({ ...p, label: p.date.slice(5) }));
  return (
    <div className="h-40" data-testid="acwr-trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <ReferenceArea y1={ACWR_SWEET_LOW} y2={ACWR_SWEET_HIGH} fill="#22c55e" fillOpacity={0.12} ifOverflow="extendDomain" />
          <ReferenceArea y1={ACWR_DANGER} y2={GAUGE_MAX} fill="#ef4444" fillOpacity={0.12} ifOverflow="hidden" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis domain={[0, GAUGE_MAX]} ticks={[0, 0.8, 1.3, 1.5, 2]} tick={{ fontSize: 10 }} allowDataOverflow />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value) => [value ?? "—", "ACWR"]}
            labelFormatter={(label) => `${label}`}
          />
          <Area type="monotone" dataKey="ratio" fillOpacity={0.15} className="fill-primary stroke-none" connectNulls={false} />
          <Line type="monotone" dataKey="ratio" className="stroke-primary" stroke="currentColor" dot={false} strokeWidth={2} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AcwrCard() {
  const { data, isLoading } = useTrainingOverview();
  const acwr = data?.acwr;
  const meta = acwr ? ACWR_ZONE_META[acwr.zone] : null;

  return (
    <Card data-testid="card-acwr">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5" />
            疲勞風險（ACWR）
          </span>
          {meta && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`} data-testid="badge-acwr-zone">
              {meta.label}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !acwr || !meta ? (
          <Skeleton className="h-48 w-full" />
        ) : acwr.historyDays === 0 ? (
          <p className="text-sm text-muted-foreground">還沒有訓練記錄，記錄幾次之後這裡會顯示近期負荷是否過量。</p>
        ) : (
          <>
            <div className="flex items-end gap-4">
              <div>
                <div className={`text-4xl font-bold tabular-nums ${meta.text}`} data-testid="text-acwr-ratio">
                  {acwr.ratio ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">急慢性負荷比</div>
              </div>
              <p className="flex-1 text-sm text-muted-foreground" data-testid="text-acwr-advice">
                {meta.advice}
              </p>
            </div>

            <ZoneGauge ratio={acwr.ratio} />

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-lg font-semibold tabular-nums">{Math.round(acwr.acute)}</div>
                <div className="text-[11px] text-muted-foreground">近 7 天負荷</div>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-lg font-semibold tabular-nums">{Math.round(acwr.chronic)}</div>
                <div className="text-[11px] text-muted-foreground">四週週均</div>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <div className="text-lg font-semibold tabular-nums" data-testid="text-acwr-headroom">
                  {acwr.headroom === null ? "—" : `約 ${Math.round(acwr.headroom)}`}
                </div>
                <div className="text-[11px] text-muted-foreground">安全範圍內還能加</div>
              </div>
            </div>

            {acwr.zone === "insufficient" && (
              <p className="text-xs text-muted-foreground" data-testid="text-acwr-insufficient">
                目前只有 {acwr.historyDays} 天的記錄，滿 28 天後才算站穩。
              </p>
            )}

            {acwr.series.some((p) => p.ratio !== null) && <TrendChart series={acwr.series} />}

            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Info className="h-3 w-3" />這個指數怎麼算？
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>ACWR = 近 7 天訓練量 ÷ 近 28 天的週平均訓練量。訓練量用各項運動的「基準值」加總，步數類活動不計入。</p>
                <p>0.8–1.3 是甜蜜點；1.3–1.5 要注意；超過 1.5 表示這週突然練太多，是運動傷害最常見的危險訊號。低於 0.8 代表最近練得比平常少。</p>
                <p>這是依訓練量推估的風險參考，不是醫療診斷；身體有明顯疼痛或不適時以身體感受為準。</p>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
}
