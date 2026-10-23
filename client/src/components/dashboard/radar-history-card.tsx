import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, History, Loader2 } from "lucide-react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeBalanceScore, computeCoverageScore } from "@shared/muscleGroupStats";

export function RadarHistoryCard() {
  const [showSnapshotHistory, setShowSnapshotHistory] = useState(false);

  const { data: radarSnapshotHistory } = useQuery<Array<{
    weekStart: string;
    scoresJson: string;
    recommendationsJson: string;
    createdAt: string;
  }>>({
    queryKey: ["/api/stats/radar-snapshots"],
    enabled: showSnapshotHistory,
  });

  return (
  <Card data-testid="card-radar-history">
    <CardHeader className="pb-2">
      <CardTitle
        className="flex items-center gap-2 text-base cursor-pointer"
        onClick={() => setShowSnapshotHistory(v => !v)}
      >
        <History className="h-5 w-5" />
        歷史週雷達圖快照
        {showSnapshotHistory
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
        }
      </CardTitle>
    </CardHeader>
    {showSnapshotHistory && (
      <CardContent>
        {!radarSnapshotHistory ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : radarSnapshotHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">尚無儲存的快照。每周日晚間 GitHub Actions 會自動儲存，或點雷達圖右上角「儲存快照」手動儲存。</p>
        ) : (
          <div className="space-y-4">
            {radarSnapshotHistory.map(snap => {
              const scores: Record<string, number> = JSON.parse(snap.scoresJson);
              const recs: string[] = JSON.parse(snap.recommendationsJson);
              const muscleNames = ['胸', '背', '腿', '肩', '二头肌', '核心', '臀', '三头肌', '有氧'];
              const radarData = muscleNames.map(name => ({
                name,
                // 有氧軸是後來加的，backfill 之前存的舊快照沒有這個 key，
                // 缺值一律當 0%（見 /api/admin/backfill-aerobic-radar-snapshots）
                pct: scores[name] ?? 0,
                baseline: 100,
              }));
              // 快照只存了最終複合分，沒存當時哪些肌群有歷史容量資料可比對，
              // 所以均衡度這裡把全部 9 軸都當作可比對——多數情況下跟即時
              // 版一致，只有極少數「當週某肌群剛好還沒有比對基準」的情況會有
              // 微小落差，可接受的近似值。覆蓋分數則本來就用全部軸，沒有這個問題。
              // 這裡沒有套用活動量加成——舊快照沒存當週的活動量數字，且
              // 「歷史每一週的活動量達成率」需要額外跨表比對日期，複雜度/風險
              // 不成比例，範圍先限定在即時版（見下方 histCoverageScore）。
              const histBalanceScore = computeBalanceScore(
                radarData.map(d => ({ name: d.name, composite: d.pct, hasVolumeHistory: true }))
              );
              const histCoverageScore = computeCoverageScore(radarData.map(d => d.pct));
              return (
                <div key={snap.weekStart} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{snap.weekStart} 當週</span>
                    <span className="text-xs text-muted-foreground">
                      儲存於 {new Date(snap.createdAt).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                  {(histBalanceScore !== null || histCoverageScore !== null) && (
                    <div className="flex flex-wrap gap-1.5">
                      {histBalanceScore !== null && (
                        <Badge
                          variant="outline"
                          className={
                            histBalanceScore >= 80
                              ? "text-green-600 border-green-600/40 bg-green-500/10 text-[11px]"
                              : histBalanceScore >= 50
                              ? "text-amber-600 border-amber-600/40 bg-amber-500/10 text-[11px]"
                              : "text-red-600 border-red-600/40 bg-red-500/10 text-[11px]"
                          }
                        >
                          均衡度 {histBalanceScore}%
                        </Badge>
                      )}
                      {histCoverageScore !== null && (
                        <Badge
                          variant="outline"
                          className={
                            histCoverageScore >= 100
                              ? "text-green-600 border-green-600/40 bg-green-500/10 text-[11px]"
                              : histCoverageScore >= 60
                              ? "text-amber-600 border-amber-600/40 bg-amber-500/10 text-[11px]"
                              : "text-red-600 border-red-600/40 bg-red-500/10 text-[11px]"
                          }
                        >
                          覆蓋 {histCoverageScore}%
                        </Badge>
                      )}
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData} outerRadius="72%">
                      <PolarGrid stroke="hsl(var(--muted-foreground) / 0.2)" />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--foreground) / 0.7)' }} />
                      <PolarRadiusAxis domain={[0, 150]} ticks={[0, 50, 100, 150] as any} tickFormatter={(v: number) => v === 100 ? '維持' : `${v}%`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} angle={90} />
                      <Radar name="維持量" dataKey="baseline" stroke="#d4a900" strokeDasharray="4 3" strokeWidth={1.5} fill="transparent" dot={false} />
                      <Radar name="複合分" dataKey="pct" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.22} dot={false} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {muscleNames.map(name => {
                      const val = scores[name] ?? 0;
                      const color = val >= 100 ? 'text-green-600 dark:text-green-400' : val >= 80 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500';
                      return (
                        <span key={name} className="text-[11px] flex items-center gap-0.5">
                          <span className="text-muted-foreground">{name}</span>
                          <span className={`font-semibold ${color}`}>{val}%</span>
                        </span>
                      );
                    })}
                  </div>
                  {recs.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      當週最需加強：{recs.join('、')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    )}
  </Card>
  );
}
