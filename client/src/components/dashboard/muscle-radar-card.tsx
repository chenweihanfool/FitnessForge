import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Check, ChevronDown, ChevronRight, Dumbbell, Lightbulb, Plus, Radar as RadarIcon } from "lucide-react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import type { Exercise, RankingData } from "@shared/schema";
import {
  RADAR_AXIS_AVG_KEYS,
  applyActivityBonus,
  computeBalanceScore,
  computeCoverageScore,
  computeMuscleCompositeScore,
  getMuscleSetsMaintenance,
} from "@shared/muscleGroupStats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScaleProgressBar } from "@/components/scale-progress-bar";
import type { MuscleGroupAverages, MuscleGroupWeeklyStats } from "./types";
import { displayLabel } from "@shared/labels";

// 首頁的本週肌群雷達圖；點標題展開各肌群明細。
export function MuscleRadarCard() {
  const [, setLocation] = useLocation();
  const [showMuscleDetail, setShowMuscleDetail] = useState(false);
  const handleAddEntry = (exerciseId: string) => setLocation(`/entries?addExercise=${exerciseId}`);

  const { data: rankingData } = useQuery<RankingData>({ queryKey: ["/api/stats/ranking"] });
  const { data: exercises } = useQuery<Exercise[]>({ queryKey: ["/api/exercises"] });
  const { data: muscleGroupStats, isLoading: muscleGroupLoading } = useQuery<MuscleGroupWeeklyStats>({
    queryKey: ["/api/stats/muscle-group-weekly"],
  });
  const { data: muscleGroupAverages } = useQuery<MuscleGroupAverages>({
    queryKey: ["/api/stats/muscle-group-averages"],
  });

  const muscleVolumeMap: Record<string, { avg: number }> = Object.fromEntries(
    Object.entries(RADAR_AXIS_AVG_KEYS).map(([name, key]) => [
      name,
      { avg: muscleGroupAverages ? Number(muscleGroupAverages[key as keyof MuscleGroupAverages]) || 0 : 0 },
    ]),
  );

  return (
    <>
      {(() => {
        const muscleNames = ['胸', '背', '腿', '肩', '二头肌', '核心', '臀', '三头肌', '有氧'];
        const hasAnyAvg = muscleNames.some(name => (muscleVolumeMap[name]?.avg ?? 0) > 0);
        if (!hasAnyAvg) return null;

        const radarData = muscleNames.map(name => {
          const volData = muscleVolumeMap[name];
          const g = muscleGroupStats?.muscleGroups.find(g => g.muscleGroup === name);
          const sets = g?.totalSets ?? 0;
          const volume = g?.totalVolume ?? 0;
          const avgVolume = volData?.avg ?? 0;

          // 各肌群各自的維持組數基準（大肌群基準較高、小肌群較低）；「有氧」沒有
          // 組數概念，這裡的 sets 其實是本週有氧分鐘數，基準是週 60 分鐘，見
          // @shared/muscleGroupStats 的 MUSCLE_SETS_MAINTENANCE 說明
          const { setsPct, volumePct, composite } = computeMuscleCompositeScore(name, sets, volume, avgVolume);

          return { name, pct: composite, setsPct, volumePct, baseline: 100, sets, volume, avgVolume };
        });

        // Recommendations: weakest muscles with composite < 80 that have volume history
        const recommendations = radarData
          .filter(d => d.avgVolume > 0 && d.pct < 80)
          .sort((a, b) => a.pct - b.pct)
          .slice(0, 3);

        // 均衡度分數：最弱/最強肌群複合分的比值，見 @shared/muscleGroupStats
        const balanceScore = computeBalanceScore(
          radarData.map(d => ({ name: d.name, composite: d.pct, hasVolumeHistory: d.avgVolume > 0 }))
        );

        // 覆蓋分數：雷達圖多邊形面積 ÷ 每軸都 100% 時的面積，見 @shared/muscleGroupStats
        const rawCoverageScore = computeCoverageScore(radarData.map(d => d.pct));

        // 活動量（例如步數）不當成獨立軸放進雷達圖——沒有「肌群」的同儕關係，
        // 改成幫覆蓋分數加成（封頂 +10%），且必須顯示加成來源，見
        // @shared/muscleGroupStats 的 applyActivityBonus 說明
        const activityAvg = rankingData?.averageActivityValue ?? 0;
        const activityComposite = activityAvg > 0
          ? ((rankingData?.currentWeek?.activityValue ?? 0) / activityAvg) * 100
          : 0;
        const { adjustedCoverage: coverageScore, bonusPoints: activityBonusPoints } =
          applyActivityBonus(rawCoverageScore, activityComposite);

        return (
          <>
            <Card data-testid="card-muscle-radar">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base flex-wrap">
                  <span
                    className="flex min-w-0 flex-wrap items-center gap-2 cursor-pointer"
                    onClick={() => setShowMuscleDetail(v => !v)}
                  >
                    <RadarIcon className="h-5 w-5" />
                    本週肌群均衡度
                    {balanceScore !== null && (
                      <Badge
                        variant="outline"
                        className={
                          balanceScore >= 80
                            ? "text-green-600 border-green-600/40 bg-green-500/10"
                            : balanceScore >= 50
                            ? "text-amber-600 border-amber-600/40 bg-amber-500/10"
                            : "text-red-600 border-red-600/40 bg-red-500/10"
                        }
                        data-testid="badge-balance-score"
                      >
                        均衡度 {balanceScore}%
                      </Badge>
                    )}
                    {coverageScore !== null && (
                      <Badge
                        variant="outline"
                        className={
                          coverageScore >= 100
                            ? "text-green-600 border-green-600/40 bg-green-500/10"
                            : coverageScore >= 60
                            ? "text-amber-600 border-amber-600/40 bg-amber-500/10"
                            : "text-red-600 border-red-600/40 bg-red-500/10"
                        }
                        data-testid="badge-coverage-score"
                      >
                        覆蓋 {coverageScore}%{activityBonusPoints > 0 ? `（含活動量 +${activityBonusPoints}%）` : ''}
                      </Badge>
                    )}
                    {showMuscleDetail
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                  </span>
                </CardTitle>
                <details className="mt-1 text-xs text-muted-foreground" data-testid="details-radar-help">
                  <summary className="cursor-pointer select-none hover:text-foreground">計分說明</summary>
                  <p className="mt-1">複合評分 = 組數 40% + 容量 60%，對比歷史均值</p>
                  {balanceScore !== null && (
                    <p className="mt-0.5">均衡度 = 最弱 2 個肌群複合分平均 ÷ 最強肌群複合分，數字越低代表落差越大</p>
                  )}
                  {coverageScore !== null && (
                    <p className="mt-0.5">覆蓋 = 雷達圖多邊形面積 ÷ 每軸都達 100% 時的面積，數字越高代表整體訓練量越飽滿；活動量（如步數）達成率另外加成，封頂 +10%</p>
                  )}
                </details>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData} outerRadius="78%">
                    <PolarGrid stroke="hsl(var(--muted-foreground) / 0.25)" />
                    <PolarAngleAxis
                      dataKey="name"
                        tickFormatter={displayLabel}
                      tick={{ fontSize: 12, fill: 'hsl(var(--foreground) / 0.75)' }}
                    />
                    <PolarRadiusAxis
                      domain={[0, 150]}
                      ticks={[0, 50, 100, 150] as any}
                      tickFormatter={(v: number) => v === 100 ? '維持' : `${v}%`}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      angle={90}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-md border bg-popover p-2.5 shadow-md text-xs space-y-0.5">
                            <p className="font-semibold">{displayLabel(d.name)}</p>
                            <p className="text-muted-foreground">複合分: <span className="font-bold text-foreground">{d.pct}%</span></p>
                            <p className="text-muted-foreground">組數分: <span className="font-medium">{d.setsPct}%</span> ({d.sets} / {getMuscleSetsMaintenance(d.name)} 組)</p>
                            {d.volumePct !== null && (
                              <p className="text-muted-foreground">容量分: <span className="font-medium">{d.volumePct}%</span></p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Radar
                      name="維持量"
                      dataKey="baseline"
                      stroke="#d4a900"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      fill="transparent"
                      dot={false}
                    />
                    <Radar
                      name="本週複合分"
                      dataKey="pct"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="hsl(var(--primary))"
                      fillOpacity={0.25}
                      dot={false}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground -mt-2">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-5 border-t-2 border-dashed border-yellow-600" />
                    維持量基準
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-5 border-t-2 border-primary" />
                    本週複合分
                  </span>
                </div>

                {/* AI-style recommendations */}
                {recommendations.length > 0 && (() => {
                  // Map Chinese muscle group names → exercise muscle field keys
                  const muscleFieldMap: Record<string, keyof Exercise> = {
                    '胸': 'muscleChest', '背': 'muscleBack', '腿': 'muscleLegs',
                    '肩': 'muscleShoulders', '二头肌': 'muscleArms', '三头肌': 'muscleFullBody',
                    '核心': 'muscleCore', '臀': 'muscleGlutes',
                  };
                  return (
                    <div className="mt-4 rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-semibold flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                        系統建議：最需加強的肌群
                      </p>
                      <div className="space-y-2.5">
                        {recommendations.map((r, i) => {
                          const priority = ['🔴', '🟠', '🟡'][i] ?? '•';
                          const deficit = 100 - r.pct;
                          const reason = r.volumePct !== null
                            ? `複合分 ${r.pct}%（組數 ${r.setsPct}% / 容量 ${r.volumePct}%），不足 ${deficit}%`
                            : `組數分 ${r.setsPct}%（本週 ${r.sets} 組 / 維持需 ${getMuscleSetsMaintenance(r.name)} 組）`;
                          const field = muscleFieldMap[r.name];
                          const suggestedExercises = field
                            ? (exercises ?? [])
                                .filter(e => ((e[field] as number) ?? 0) >= 20)
                                .sort((a, b) => ((b[field] as number) ?? 0) - ((a[field] as number) ?? 0))
                                .slice(0, 4)
                            : [];
                          return (
                            <div key={r.name} className="flex items-start gap-2 text-xs">
                              <span className="mt-0.5">{priority}</span>
                              <div className="flex-1 min-w-0">
                                <div>
                                  <span className="font-semibold">{displayLabel(r.name)}</span>
                                  <span className="text-muted-foreground ml-1.5">{reason}</span>
                                </div>
                                {suggestedExercises.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {suggestedExercises.map(ex => (
                                      <button
                                        key={ex.id}
                                        onClick={() => handleAddEntry(ex.id)}
                                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                                      >
                                        <Plus className="h-2.5 w-2.5" />
                                        {ex.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {recommendations.length === 0 && radarData.every(d => d.pct >= 80) && (
                  <div className="mt-4 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30 p-3">
                    <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      本週所有肌群均衡度良好，繼續保持！
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        );
      })()}
      {showMuscleDetail && !muscleGroupLoading && (
        <Card data-testid="card-muscle-group-stats">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              本週肌群訓練
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(() => {
                const ALL_MUSCLES = ['胸', '背', '腿', '肩', '二头肌', '核心', '臀', '三头肌'];

                const weekMap = new Map(
                  (muscleGroupStats?.muscleGroups || []).map(g => [g.muscleGroup, g])
                );

                const getSetStatus = (sets: number, maintenance: number) => {
                  if (sets === 0) return { color: 'bg-muted-foreground/20', textColor: 'text-muted-foreground', label: '未訓練' };
                  if (sets < maintenance) return { color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', label: '低於維持量' };
                  if (sets <= 8) return { color: 'bg-yellow-500', textColor: 'text-yellow-600 dark:text-yellow-400', label: '維持中' };
                  if (sets <= 15) return { color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: '最佳區間' };
                  if (sets <= 20) return { color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', label: '高強度' };
                  return { color: 'bg-purple-500', textColor: 'text-purple-600 dark:text-purple-400', label: '超量警示' };
                };

                const getCombinedStatus = (sets: number, setsOk: boolean, volumeOk: boolean, hasHistory: boolean) => {
                  if (sets === 0) return { label: '--', badgeClass: 'bg-muted text-muted-foreground', tintClass: '' };
                  if (!hasHistory) return { label: '--', badgeClass: 'bg-muted text-muted-foreground', tintClass: '' };
                  if (setsOk && volumeOk) return { label: '全達標', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', tintClass: 'bg-green-50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30' };
                  if (!setsOk && volumeOk) return { label: '缺組數', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', tintClass: 'bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-800/20' };
                  if (setsOk && !volumeOk) return { label: '缺容量', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', tintClass: 'bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-800/20' };
                  return { label: '未達標', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', tintClass: 'bg-red-50/50 dark:bg-red-950/10 border border-red-200/40 dark:border-red-800/20' };
                };

                const getSortPriority = (name: string) => {
                  const g = weekMap.get(name);
                  const sets = g?.totalSets || 0;
                  const vol = g?.totalVolume || 0;
                  const vd = muscleVolumeMap[name];
                  const avg = vd?.avg || 0;
                  const hasHist = avg > 0;
                  if (sets === 0) return hasHist ? 2 : 4;
                  const sok = sets >= getMuscleSetsMaintenance(name);
                  const vok = hasHist && vol >= avg;
                  if (!sok && !vok) return 0;
                  if (!sok || !vok) return 1;
                  return 3;
                };
                const sortedMuscles = [...ALL_MUSCLES].sort((a, b) => getSortPriority(a) - getSortPriority(b));

                return sortedMuscles.map((muscleName) => {
                  const group = weekMap.get(muscleName);
                  const totalSets = group?.totalSets || 0;
                  const totalVolume = group?.totalVolume || 0;
                  const maintenance = getMuscleSetsMaintenance(muscleName);
                  const status = getSetStatus(totalSets, maintenance);
                  const maxSets = 20;
                  const volData = muscleVolumeMap[muscleName];
                  const volAvg = volData?.avg || 0;
                  const hasVolHistory = volAvg > 0;
                  const setsOk = totalSets >= maintenance;
                  const volumeOk = hasVolHistory && totalVolume >= volAvg;

                  const combined = getCombinedStatus(totalSets, setsOk, volumeOk, hasVolHistory);

                  const volDiffPercent = hasVolHistory && volAvg > 0 && totalSets > 0
                    ? Math.round(((totalVolume - volAvg) / volAvg) * 100)
                    : 0;

                  return (
                    <div
                      key={muscleName}
                      className={`space-y-2 p-3 rounded-lg ${combined.tintClass || 'bg-muted/50'}`}
                      data-testid={`muscle-group-stat-${muscleName}`}
                    >
                      <div className="flex justify-between items-center gap-1">
                        <span className="text-sm font-medium">{displayLabel(muscleName)}</span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 h-5 no-default-hover-elevate no-default-active-elevate ${combined.badgeClass}`}
                          data-testid={`combined-status-${muscleName}`}
                        >
                          {combined.label}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-muted-foreground" data-testid={`sets-${muscleName}`}>
                          {totalSets} 組
                        </span>
                        <span className="text-sm font-bold" data-testid={`volume-${muscleName}`}>
                          {totalVolume.toFixed(1)}
                        </span>
                      </div>
                      <div className="pt-4">
                        <ScaleProgressBar
                          currentValue={totalSets}
                          maxValue={Math.max(totalSets, maxSets)}
                          markers={[
                            { value: maintenance, label: '維', colorClass: 'bg-yellow-500', textColorClass: 'text-yellow-600 dark:text-yellow-400' },
                            { value: 15, label: '優', colorClass: 'bg-chart-3', textColorClass: 'text-chart-3' }
                          ]}
                          barColorClass={status.color}
                          height="h-2"
                          showLabels={false}
                        />
                      </div>
                      <div className="flex justify-between items-center gap-1">
                        <span className={`text-xs ${status.textColor}`} data-testid={`status-${muscleName}`}>
                          {status.label}
                        </span>
                        {hasVolHistory && totalSets > 0 ? (
                          <span
                            className={`text-xs ${volDiffPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                            data-testid={`volume-status-${muscleName}`}
                          >
                            容量 {totalVolume.toFixed(0)} / 均 {volAvg.toFixed(0)} ({volDiffPercent >= 0 ? '+' : ''}{volDiffPercent}%)
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground" data-testid={`volume-status-${muscleName}`}>
                            {hasVolHistory ? `均 ${volAvg.toFixed(0)}` : '--'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
