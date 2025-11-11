import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

export type RankingMetricCardProps = {
  title: string;
  icon: LucideIcon;
  rank: number;
  totalWeeks: number;
  currentValue: number;
  averageValue: number;
  topValue: number;
  onClick?: () => void;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  testId?: string;
};

export function RankingMetricCard({
  title,
  icon: Icon,
  rank,
  totalWeeks,
  currentValue,
  averageValue,
  topValue,
  onClick,
  onMouseEnter,
  testId,
}: RankingMetricCardProps) {
  const isFirstPlace = rank === 1;
  const isLastPlace = rank === totalWeeks;
  
  const deltaToTop = isFirstPlace ? 0 : topValue - currentValue;
  const deltaToAverage = currentValue - averageValue;
  const deltaToAveragePercent = averageValue > 0 ? (deltaToAverage / averageValue) * 100 : 0;

  const getRankBadge = () => {
    if (isFirstPlace) {
      return <Badge className="bg-chart-3 text-white">第 1 名</Badge>;
    } else if (isLastPlace) {
      return <Badge variant="destructive">第 {rank} 名</Badge>;
    } else {
      return <Badge variant="secondary">第 {rank} 名</Badge>;
    }
  };

  return (
    <Card 
      className={onClick ? "hover-elevate active-elevate-2 cursor-pointer" : ""} 
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      data-testid={testId}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">{currentValue.toFixed(1)}</span>
          {getRankBadge()}
        </div>
        
        <div className="space-y-1 text-xs">
          {!isFirstPlace && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>距第一</span>
              <span className="font-medium">{deltaToTop.toFixed(1)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">距平均</span>
            <span className={`font-medium ${deltaToAverage >= 0 ? 'text-chart-3' : 'text-destructive'}`}>
              {deltaToAverage >= 0 ? '+' : ''}{deltaToAverage.toFixed(1)} ({deltaToAveragePercent >= 0 ? '+' : ''}{deltaToAveragePercent.toFixed(0)}%)
            </span>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          排名 {rank}/{totalWeeks}
        </div>
      </CardContent>
    </Card>
  );
}
