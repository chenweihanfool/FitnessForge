import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";
import { WeeklyStats } from "@shared/schema";
import { parseISO, getISOWeek, getISOWeekYear } from "date-fns";

interface TrendChartProps {
  data: WeeklyStats[];
}

// 计算线性回归
function calculateLinearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  
  // 处理边界情况
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: data[0] };
  
  const x = Array.from({ length: n }, (_, i) => i);
  const y = data;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const denominator = n * sumXX - sumX * sumX;
  
  // 防止除以零
  if (denominator === 0) return { slope: 0, intercept: sumY / n };
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

export function TrendChart({ data }: TrendChartProps) {
  // 计算回归线
  const values = data.map(week => week.totalBaselineValue);
  const { slope, intercept } = calculateLinearRegression(values);
  
  const chartData = data.map((week, index) => {
    const date = parseISO(week.weekStart);
    const year = getISOWeekYear(date);
    const weekNumber = getISOWeek(date);
    
    return {
      week: `${year}年 第${weekNumber}周`,
      value: week.totalBaselineValue,
      trendLine: slope * index + intercept,
      entries: week.entryCount,
    };
  });

  return (
    <Card data-testid="card-trend-chart">
      <CardHeader>
        <CardTitle>趋势分析</CardTitle>
        <CardDescription>每周基准值变化趋势</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
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
                  const actualValue = payload.find(p => p.dataKey === 'value');
                  const trendValue = payload.find(p => p.dataKey === 'trendLine');
                  
                  return (
                    <div className="rounded-md border bg-popover p-3 shadow-md">
                      <p className="text-sm font-medium">{payload[0].payload.week}</p>
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
      </CardContent>
    </Card>
  );
}
