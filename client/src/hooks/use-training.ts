import { useQuery } from "@tanstack/react-query";
import type { AcwrResult } from "@shared/training/acwr";
import type { ExerciseStats } from "@shared/training/exercise-stats";
import type { RecoveryOverview } from "@shared/training/recovery";

export type TrainingOverview = { acwr: AcwrResult; recovery: RecoveryOverview };

// 疲勞風險（ACWR）+ 久未訓練/肌群恢復。記錄有異動時由 invalidateWorkoutData() 一併失效。
export function useTrainingOverview(options?: { enabled?: boolean }) {
  return useQuery<TrainingOverview>({
    queryKey: ["/api/training/overview"],
    enabled: options?.enabled ?? true,
  });
}

// 單項運動的上次記錄、歷史紀錄與趨勢；用於新增記錄時預填與顯示歷史軌跡。
export function useExerciseStats(exerciseId: string | undefined) {
  return useQuery<ExerciseStats>({
    queryKey: ["/api/training/exercise-stats", exerciseId],
    enabled: !!exerciseId,
  });
}
