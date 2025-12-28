import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Star, TrendingUp, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CareerWeek {
  weekStart: string;
  weekEnd: string;
  year: number;
  weekNumber: number;
  totalScore: number;
  strengthScore: number;
  cardioScore: number;
  activityScore: number;
  stars: number;
  percentile: number;
}

interface CareerOverview {
  weeks: CareerWeek[];
  totalStars: number;
  averageStars: number;
}

export default function Career() {
  const { data, isLoading } = useQuery<CareerOverview>({
    queryKey: ["/api/stats/career-overview"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="page-career">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const totalWeeks = data?.weeks.length || 0;

  return (
    <div className="space-y-6" data-testid="page-career">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
          <Trophy className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">生涯记录全览</h1>
          <p className="text-sm text-muted-foreground">
            追踪您的每周表现和成就
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card data-testid="card-total-weeks">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              总周数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalWeeks}</div>
            <p className="text-xs text-muted-foreground mt-1">周的训练记录</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-stars">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Star className="h-4 w-4" />
              生涯总星星
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500">
              {data?.totalStars || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              累计获得的星星
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-average-stars">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              平均每周
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(data?.averageStars || 0).toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">颗星星</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-weekly-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            每周记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data?.weeks && data.weeks.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">周次</TableHead>
                    <TableHead className="text-right">总分</TableHead>
                    <TableHead className="text-right">力量</TableHead>
                    <TableHead className="text-right">有氧</TableHead>
                    <TableHead className="text-right">活动量</TableHead>
                    <TableHead className="text-center">排名</TableHead>
                    <TableHead className="text-center">星星</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.weeks.map((week, index) => (
                    <TableRow
                      key={week.weekStart}
                      className={index === 0 ? "bg-primary/5" : ""}
                      data-testid={`row-week-${week.year}-${week.weekNumber}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>
                            {week.year}年第{week.weekNumber}周
                          </span>
                          {index === 0 && (
                            <span className="text-xs text-primary">
                              本周
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {week.totalScore.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {week.strengthScore.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {week.cardioScore.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {week.activityScore.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            week.percentile <= 10
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              : week.percentile <= 30
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : week.percentile <= 70
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          前{week.percentile.toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= week.stars
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-muted-foreground/20"
                              }`}
                            />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              暂无训练记录
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
