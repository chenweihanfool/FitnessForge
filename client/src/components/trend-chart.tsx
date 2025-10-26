import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { WeeklyStats } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";

interface TrendChartProps {
  data: WeeklyStats[];
}

export function TrendChart({ data }: TrendChartProps) {
  const chartData = data.map((week) => ({
    week: format(parseISO(week.weekStart), "MM/dd", { locale: zhCN }),
    value: week.totalBaselineValue,
    entries: week.entryCount,
  }));

  return (
    <Card data-testid="card-trend-chart">
      <CardHeader>
        <CardTitle>趋势分析</CardTitle>
        <CardDescription>每周基准值变化趋势</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="week"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-md border bg-popover p-3 shadow-md">
                      <p className="text-sm font-medium">周 {payload[0].payload.week}</p>
                      <p className="text-sm text-muted-foreground">
                        基准值: <span className="font-semibold text-foreground">{payload[0].value}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        记录数: {payload[0].payload.entries}
                      </p>
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
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
