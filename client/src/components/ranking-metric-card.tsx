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
  
  const deltaToAverage = currentValue - averageValue;

  const getRankBadge = () => {
    if (isFirstPlace) {
      return <Badge className="bg-chart-3 text-white">第 1 名</Badge>;
    } else if (isLastPlace) {
      return <Badge variant="destructive">第 {rank} 名</Badge>;
    } else {
      return <Badge variant="secondary">第 {rank} 名</Badge>;
    }
  };

  // 計算進度條相關數值
  // 進度條範圍：0 到 topValue * 1.1（留一點空間）
  const maxScale = topValue > 0 ? topValue * 1.1 : 100;
  const currentPercent = maxScale > 0 ? Math.min((currentValue / maxScale) * 100, 100) : 0;
  const avgPercent = maxScale > 0 ? Math.min((averageValue / maxScale) * 100, 100) : 0;
  const topPercent = maxScale > 0 ? Math.min((topValue / maxScale) * 100, 100) : 0;

  // 進度條顏色：超過平均為綠色，低於平均為紅色
  const progressColor = currentValue >= averageValue ? 'bg-chart-3' : 'bg-destructive';

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
        
        {/* 帶刻度的進度條 */}
        <div className="space-y-1">
          <div className="relative h-3 bg-muted rounded-full overflow-visible">
            {/* 當前值進度條 */}
            <div 
              className={`absolute left-0 top-0 h-full rounded-full ${progressColor} transition-all`}
              style={{ width: `${currentPercent}%` }}
            />
            
            {/* 平均值刻度線 */}
            {avgPercent > 0 && avgPercent <= 100 && (
              <div 
                className="absolute top-0 h-full w-0.5 bg-primary z-10"
                style={{ left: `${avgPercent}%` }}
                title={`平均: ${averageValue.toFixed(1)}`}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-primary font-medium whitespace-nowrap">
                  均
                </div>
              </div>
            )}
            
            {/* 最高值刻度線 */}
            {topPercent > 0 && topPercent <= 100 && (
              <div 
                className="absolute top-0 h-full w-0.5 bg-chart-4 z-10"
                style={{ left: `${topPercent}%` }}
                title={`最高: ${topValue.toFixed(1)}`}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-chart-4 font-medium whitespace-nowrap">
                  冠
                </div>
              </div>
            )}
          </div>
          
          {/* 刻度數值標籤 */}
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0</span>
            <span className="text-primary">均:{averageValue.toFixed(0)}</span>
            <span className="text-chart-4">冠:{topValue.toFixed(0)}</span>
          </div>
        </div>

        {/* 距離平均的差值 */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">距平均</span>
          <span className={`font-medium ${deltaToAverage >= 0 ? 'text-chart-3' : 'text-destructive'}`}>
            {deltaToAverage >= 0 ? '+' : ''}{deltaToAverage.toFixed(1)}
          </span>
        </div>
        
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          排名 {rank}/{totalWeeks}
        </div>
      </CardContent>
    </Card>
  );
}
