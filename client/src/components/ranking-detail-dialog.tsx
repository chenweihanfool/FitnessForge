import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RankingDetailResponse } from "@shared/schema";

type RankingDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: 'total' | 'strength' | 'cardio' | 'activity';
};

const METRIC_LABELS = {
  total: '總基準值',
  strength: '力量',
  cardio: '有氧',
  activity: '活動量',
} as const;

export function RankingDetailDialog({ open, onOpenChange, metric }: RankingDetailDialogProps) {
  const { data, isLoading } = useQuery<RankingDetailResponse>({
    queryKey: ['/api/stats/ranking-detail', metric],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-ranking-detail">
        <DialogHeader>
          <DialogTitle>{METRIC_LABELS[metric]}排名詳情</DialogTitle>
          <DialogDescription>
            檢視當前週及前後2名的排名情況
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data && data.surrounding.length > 0 ? (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">排名</TableHead>
                  <TableHead>週次</TableHead>
                  <TableHead className="text-right">數值</TableHead>
                  <TableHead className="text-right">與平均值</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.surrounding.map((snapshot) => {
                  const isCurrentWeek = snapshot.weekStart === data.current.weekStart;
                  const deltaToAverage = snapshot.value - data.careerAverage;
                  const deltaPercent = data.careerAverage > 0 ? (deltaToAverage / data.careerAverage) * 100 : 0;
                  
                  return (
                    <TableRow 
                      key={snapshot.weekStart}
                      className={isCurrentWeek ? "bg-muted" : ""}
                      data-testid={isCurrentWeek ? "row-current-week" : undefined}
                    >
                      <TableCell className="font-medium">
                        {isCurrentWeek ? (
                          <Badge className="bg-chart-3 text-white">第 {snapshot.rank} 名</Badge>
                        ) : (
                          <span>第 {snapshot.rank} 名</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {snapshot.year}年 第{snapshot.weekNumber}週
                        {isCurrentWeek && <span className="ml-2 text-xs text-muted-foreground">(本週)</span>}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {snapshot.value.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={deltaToAverage >= 0 ? "default" : "destructive"}>
                          {deltaToAverage >= 0 ? '+' : ''}{deltaToAverage.toFixed(1)} ({deltaPercent >= 0 ? '+' : ''}{deltaPercent.toFixed(0)}%)
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            暫無排名資料
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
