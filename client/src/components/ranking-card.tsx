import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RankingCardProps {
  currentWeekValue: number;
  bestWeekValue: number | null;
  worstWeekValue: number | null;
  averageValue: number;
  rank: number;
  totalWeeks: number;
}

export function RankingCard({
  currentWeekValue,
  bestWeekValue,
  worstWeekValue,
  averageValue,
  rank,
  totalWeeks,
}: RankingCardProps) {
  const getRankBadge = () => {
    if (rank === 1) {
      return <Badge className="bg-chart-3 text-white">第 1 名</Badge>;
    } else if (rank === totalWeeks) {
      return <Badge variant="destructive">第 {rank} 名</Badge>;
    } else {
      return <Badge variant="secondary">第 {rank} 名</Badge>;
    }
  };

  const getMedalIcon = () => {
    if (rank === 1) return <Trophy className="h-8 w-8 text-chart-3" />;
    if (rank <= 3) return <Trophy className="h-8 w-8 text-primary" />;
    return <Activity className="h-8 w-8 text-muted-foreground" />;
  };

  return (
    <Card data-testid="card-ranking">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>本周排名</CardTitle>
          {getMedalIcon()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">当前排名</span>
          {getRankBadge()}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-chart-3" />
              <span className="text-muted-foreground">历史最佳</span>
            </div>
            <span className="font-semibold" data-testid="text-best-week">
              {bestWeekValue !== null ? bestWeekValue.toFixed(1) : "暂无"}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span className="text-muted-foreground">历史最差</span>
            </div>
            <span className="font-semibold" data-testid="text-worst-week">
              {worstWeekValue !== null ? worstWeekValue.toFixed(1) : "暂无"}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">平均水平</span>
            </div>
            <span className="font-semibold" data-testid="text-average-week">
              {averageValue.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            共 {totalWeeks} 周数据
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
