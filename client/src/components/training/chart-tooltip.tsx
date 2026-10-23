import type { TooltipProps } from "recharts";

// 圖表提示框：用主題色（bg-popover / text-popover-foreground），淺色與深色模式文字都清楚。
// recharts 預設的提示框會用數列顏色當文字色，深色模式下很難讀。
export interface TooltipContent {
  title: string;
  rows: Array<{ label: string; value: string }>;
}

export function makeChartTooltip<T>(describe: (point: T) => TooltipContent | null) {
  return function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    const content = describe(payload[0].payload as T);
    if (!content) return null;
    return (
      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md" data-testid="chart-tooltip">
        <p className="mb-0.5 font-medium">{content.title}</p>
        {content.rows.map((r) => (
          <p key={r.label} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-semibold tabular-nums">{r.value}</span>
          </p>
        ))}
      </div>
    );
  };
}
