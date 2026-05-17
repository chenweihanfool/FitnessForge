import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { WeeklyStats } from "@shared/schema";
import { parseISO, getISOWeek, getISOWeekYear } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendChartProps {
  data: WeeklyStats[];
  title?: string;
}

function calculateLinearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: data[0] };
  const x = Array.from({ length: n }, (_, i) => i);
  const y = data;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

type TrendStatus = 'growing' | 'stable' | 'declining';

function classifyTrend(slope: number, mean: number): TrendStatus {
  if (mean === 0) return 'stable';
  const ratio = slope / mean;
  if (ratio > 0.025) return 'growing';
  if (ratio < -0.025) return 'declining';
  return 'stable';
}

export function TrendChart({ data, title }: TrendChartProps) {
  const values = data.map(week => week.totalBaselineValue);
  const { slope, intercept } = calculateLinearRegression(values);
  const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const trendStatus: TrendStatus = classifyTrend(slope, mean);

  const recent4 = values.slice(-4);
  const prior4 = values.slice(-8, -4);
  const recent4Avg = recent4.length > 0 ? recent4.reduce((a, b) => a + b, 0) / recent4.length : 0;
  const prior4Avg = prior4.length > 0 ? prior4.reduce((a, b) => a + b, 0) / prior4.length : 0;
  const periodChangePct = prior4Avg > 0 ? ((recent4Avg - prior4Avg) / prior4Avg) * 100 : 0;

  const maxVal = Math.max(...values);
  const bestWeekIdx = values.indexOf(maxVal);

  const chartData = data.map((week, index) => {
    const date = parseISO(week.weekStart);
    const year = getISOWeekYear(date);
    const weekNumber = getISOWeek(date);
    return {
      week: `${year}年 第${weekNumber}周`,
      value: week.totalBaselineValue,
      trendLine: slope * index + intercept,
      entries: week.entryCount,
      isBest: index === bestWeekIdx,
    };
  });

  const statusConfig = {
    growing: {
      label: '蒸蒸日上',
      icon: TrendingUp,
      badgeClass: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
      descColor: 'text-green-600 dark:text-green-400',
      desc: (s: number) => `趨勢線斜率 +${s.toFixed(1)}/週，整體訓練量持續成長！`,
    },
    stable: {
      label: '穩定維持',
      icon: Minus,
      badgeClass: 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      descColor: 'text-yellow-600 dark:text-yellow-400',
      desc: (s: number) => `趨勢線斜率 ${s.toFixed(1)}/週，訓練量平穩維持，保持穩定節奏。`,
    },
    declining: {
      label: '運動怠惰',
      icon: TrendingDown,
      badgeClass: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
      descColor: 'text-red-600 dark:text-red-400',
      desc: (s: number) => `趨勢線斜率 ${s.toFixed(1)}/週，訓練量呈下降趨勢，注意保持運動規律！`,
    },
  };

  const cfg = statusConfig[trendStatus];
  const StatusIcon = cfg.icon;

  return (
    <Card data-testid="card-trend-chart">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle>{title || '趋势分析'}</CardTitle>
            <CardDescription>每周基准值变化趋势</CardDescription>
          </div>
          <Badge variant="outline" className={`flex items-center gap-1.5 text-sm px-3 py-1 ${cfg.badgeClass}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {cfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            {mean > 0 && (
              <ReferenceLine
                y={mean}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.45}
                label={{ value: `均值 ${mean.toFixed(0)}`, position: 'insideTopRight', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
            )}
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const actualValue = payload.find(p => p.dataKey === 'value');
                  const trendValue = payload.find(p => p.dataKey === 'trendLine');
                  const pt = payload[0].payload;
                  return (
                    <div className="rounded-md border bg-popover p-3 shadow-md">
                      <p className="text-sm font-medium">{pt.week}</p>
                      {pt.isBest && <p className="text-xs text-amber-500 font-semibold">★ 歷史最佳週</p>}
                      {actualValue && (
                        <p className="text-sm text-muted-foreground">
                          基准值: <span className="font-semibold text-foreground">{Number(actualValue.value).toFixed(1)}</span>
                        </p>
                      )}
                      {trendValue && (
                        <p className="text-sm text-muted-foreground">
                          趋势值: <span className="font-semibold" style={{ color: 'hsl(var(--chart-2))' }}>{Number(trendValue.value).toFixed(1)}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">记录数: {pt.entries}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#colorValue)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.isBest) {
                  return <circle key={`dot-best-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="#d4a900" stroke="white" strokeWidth={2} />;
                }
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="hsl(var(--chart-1))" />;
              }}
            />
            <Line
              type="monotone"
              dataKey="trendLine"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="趋势线"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Supporting stats panel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">週均趨勢</p>
            <p className={`text-sm font-semibold ${slope > 0 ? 'text-green-600 dark:text-green-400' : slope < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
              {slope > 0 ? '+' : ''}{slope.toFixed(1)} / 週
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">歷史均值</p>
            <p className="text-sm font-semibold">{mean.toFixed(1)}</p>
          </div>
          {prior4.length > 0 && (
            <>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">近4週均值</p>
                <p className="text-sm font-semibold">{recent4Avg.toFixed(1)}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">與前4週比較</p>
                <p className={`text-sm font-semibold ${periodChangePct > 0 ? 'text-green-600 dark:text-green-400' : periodChangePct < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                  {periodChangePct > 0 ? '+' : ''}{periodChangePct.toFixed(1)}%
                </p>
              </div>
            </>
          )}
        </div>

        <p className={`text-xs ${cfg.descColor}`}>{cfg.desc(slope)}</p>
      </CardContent>
    </Card>
  );
}
