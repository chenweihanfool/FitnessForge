import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  testId?: string;
  onClick?: () => void;
  clickable?: boolean;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className = "",
  testId,
  onClick,
  clickable = false,
}: StatsCardProps) {
  return (
    <Card 
      className={`${className} ${clickable ? "cursor-pointer hover-elevate active-elevate-2" : ""}`}
      data-testid={testId}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`${testId}-value`}>{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {clickable && (
          <p className="text-xs text-primary mt-2">点击查看详情</p>
        )}
        {trend && (
          <p className={`text-xs mt-2 ${trend.isPositive ? "text-chart-3" : "text-destructive"}`}>
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value).toFixed(1)}% 与上周相比
          </p>
        )}
      </CardContent>
    </Card>
  );
}
