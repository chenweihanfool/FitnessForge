import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Activity, Dumbbell, Plus, TrendingDown, TrendingUp } from "lucide-react";
import type { Exercise } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScaleProgressBar } from "@/components/scale-progress-bar";
import type { MuscleGroupWeeklyStats, WeeklyProgress } from "./types";
import { MUSCLE_FIELDS } from "@shared/training/recovery";
import { displayLabel } from "@shared/labels";

// 「訓練進度」分頁：本週各項目進度 vs 歷史週平均，沒有進度時改推薦該練的項目。
// 資料自己用 useQuery 取（跟首頁其他卡片共用同一份快取，不會多打 API）。
export function ProgressTab() {
  const [, setLocation] = useLocation();
  const handleAddEntry = (exerciseId: string) => setLocation(`/entries?addExercise=${exerciseId}`);

  const { data: muscleGroupStats } = useQuery<MuscleGroupWeeklyStats>({
    queryKey: ["/api/stats/muscle-group-weekly"],
  });
  const { data: exercises } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });
  const { data: weeklyProgress, isLoading: weeklyProgressLoading } = useQuery<WeeklyProgress>({
    queryKey: ["/api/stats/weekly-progress"],
  });

  return (
    <>
            {/* 本週訓練進度 */}
            {!weeklyProgressLoading && weeklyProgress && weeklyProgress.exercises.length > 0 && (
              <Card data-testid="card-weekly-progress">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    本週訓練進度
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {/* 推薦訓練項目 - 放在最前面 */}
                    {weeklyProgress.recommendations && weeklyProgress.recommendations.length > 0 && (
                      <>
                        {weeklyProgress.recommendations.map((rec) => {
                          const exerciseInfo = exercises?.find(e => e.id === rec.exerciseId);
                          const targetMuscles = exerciseInfo ? MUSCLE_FIELDS
                            .filter(m => {
                              const value = exerciseInfo[m.field] as number | null;
                              return value && value > 0;
                            })
                            .map(m => displayLabel(m.name))
                          : [];
                
                          return (
                            <div
                              key={`rec-${rec.exerciseId}`}
                              className="space-y-2 p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover-elevate cursor-pointer group"
                              data-testid={`recommendation-${rec.exerciseId}`}
                              onClick={() => handleAddEntry(rec.exerciseId)}
                            >
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium truncate">{displayLabel(rec.exerciseName)}</span>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <Plus className="h-4 w-4 text-primary" />
                                </div>
                              </div>
                              {targetMuscles.length > 0 && (
                                <div className="text-xs text-primary/80">
                                  {targetMuscles.join(' / ')}
                                </div>
                              )}
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="truncate">{rec.reason}</span>
                                <span className="text-primary font-medium shrink-0 ml-2">建議</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                  className="h-full bg-primary/50"
                                  style={{ width: '0%' }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                    {/* 運動項目列表 - 按距離鍛鍊時間排序 */}
                    {weeklyProgress.exercises
                      .sort((a, b) => {
                        // 按距上次鍛鍊天數降序排列，null值排最後
                        const daysA = a.daysSinceLastWorkout ?? -1;
                        const daysB = b.daysSinceLastWorkout ?? -1;
                        return daysB - daysA;
                      })
                      .map((ex) => {
                        const percentage = ex.differencePercentage || 0;
                        const isAbove = percentage >= 0;
                        const displayPercentage = Math.abs(percentage);
                        const progressValue = Math.min(displayPercentage, 100);
              
                        // 獲取運動的主要鍛鍊肌群
                        const exerciseInfo = exercises?.find(e => e.id === ex.exerciseId);
                        const primaryMuscles = exerciseInfo ? MUSCLE_FIELDS
                          .filter(m => {
                            const value = exerciseInfo[m.field] as number | null;
                            return value && value > 0;
                          })
                          .sort((a, b) => {
                            const valueA = (exerciseInfo[a.field] as number) || 0;
                            const valueB = (exerciseInfo[b.field] as number) || 0;
                            return valueB - valueA;
                          })
                          .slice(0, 3)
                          .map(m => displayLabel(m.name))
                        : [];

                        return (
                          <div
                            key={ex.exerciseId}
                            className="space-y-2 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer group"
                            data-testid={`progress-${ex.exerciseId}`}
                            onClick={() => handleAddEntry(ex.exerciseId)}
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium truncate">{displayLabel(ex.exerciseName)}</span>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                {ex.weeklyAverage !== null && ex.weeklyAverage > 0 ? (
                                  <>
                                    {isAbove ? (
                                      <TrendingUp className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <TrendingDown className="h-4 w-4 text-orange-500" />
                                    )}
                                    <span
                                      className={
                                        isAbove ? "text-green-600 dark:text-green-400 font-semibold" : "text-orange-600 dark:text-orange-400 font-semibold"
                                      }
                                    >
                                      {isAbove ? "+" : ""}
                                      {percentage.toFixed(0)}%
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground text-xs">新</span>
                                )}
                              </div>
                            </div>
                            {primaryMuscles.length > 0 && (
                              <div className="text-xs text-primary/80">
                                {primaryMuscles.join(' / ')}
                              </div>
                            )}
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>
                                  本週: {ex.currentWeekValue.toFixed(1)} {ex.exerciseUnit}
                                </span>
                                {ex.weeklyAverage !== null && ex.weeklyAverage > 0 && (
                                  <>
                                    <span>|</span>
                                    <span>
                                      平均: {ex.weeklyAverage.toFixed(1)} {ex.exerciseUnit}
                                    </span>
                                  </>
                                )}
                              </div>
                              {ex.daysSinceLastWorkout !== null && (
                                <span className={ex.daysSinceLastWorkout >= 7 ? "text-orange-500 font-medium" : ""}>
                                  {ex.daysSinceLastWorkout === 0 ? "今天" : `${ex.daysSinceLastWorkout}天前`}
                                </span>
                              )}
                            </div>
                            {ex.currentWeekKm !== null && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>
                                  本週: {ex.currentWeekKm.toFixed(1)} km
                                </span>
                                {ex.weeklyAverageKm !== null && ex.weeklyAverageKm > 0 && (
                                  <>
                                    <span>|</span>
                                    <span>平均: {ex.weeklyAverageKm.toFixed(1)} km</span>
                                  </>
                                )}
                                {ex.bestWeekKm !== null && ex.bestWeekKm > 0 && (
                                  <>
                                    <span>|</span>
                                    <span className="text-primary/80">冠: {ex.bestWeekKm.toFixed(1)} km</span>
                                  </>
                                )}
                              </div>
                            )}
                            {ex.weeklyAverage !== null && ex.weeklyAverage > 0 && (
                              <div className="pt-4">
                                <ScaleProgressBar
                                  currentValue={ex.currentWeekValue}
                                  maxValue={Math.max(ex.currentWeekValue, ex.weeklyAverage)}
                                  markers={[
                                    { value: ex.weeklyAverage, label: '均', colorClass: 'bg-primary', textColorClass: 'text-primary' }
                                  ]}
                                  barColorClass={isAbove ? 'bg-chart-3' : 'bg-destructive'}
                                  height="h-2"
                                  showLabels={false}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 獨立推薦卡片 - 當本週訓練進度卡片不顯示時顯示 */}
            {(!weeklyProgress || weeklyProgress.exercises.length === 0) && 
              exercises && exercises.length > 0 && (() => {
      
                const trainedMuscles = new Set(
                  muscleGroupStats?.muscleGroups?.map(g => g.muscleGroup) || []
                );
                const untrainedMuscles = MUSCLE_FIELDS.filter(m => !trainedMuscles.has(m.name));
      
                if (untrainedMuscles.length === 0) return null;
      
                const recommendedExercises = exercises
                  .filter(ex => {
                    return untrainedMuscles.some(um => {
                      const value = ex[um.field] as number | null;
                      return value && value > 0;
                    });
                  })
                  .map(ex => {
                    const targetMuscles = untrainedMuscles
                      .filter(um => {
                        const value = ex[um.field] as number | null;
                        return value && value > 0;
                      })
                      .map(um => displayLabel(um.name));
                    return { exercise: ex, targetMuscles };
                  })
                  .slice(0, 5);
      
                if (recommendedExercises.length === 0) return null;
      
                return (
                  <Card data-testid="card-muscle-recommendations">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Dumbbell className="h-5 w-5" />
                        建議訓練
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        未鍛鍊肌群: {untrainedMuscles.map(m => displayLabel(m.name)).join('、')}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {recommendedExercises.map(({ exercise, targetMuscles }) => (
                          <div
                            key={`rec-${exercise.id}`}
                            className="space-y-2 p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover-elevate cursor-pointer group"
                            data-testid={`recommendation-${exercise.id}`}
                            onClick={() => handleAddEntry(exercise.id)}
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium truncate">{exercise.name}</span>
                              <Plus className="h-4 w-4 text-primary shrink-0 ml-2" />
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              鍛鍊: {targetMuscles.join('、')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()
            }
    </>
  );
}
