import type { Exercise } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExerciseStatsPanel } from "./exercise-stats-panel";

export function ExerciseHistoryDialog({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  return (
    <Dialog open={!!exercise} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="dialog-exercise-history">
        <DialogHeader>
          <DialogTitle>{exercise?.name}・歷史軌跡</DialogTitle>
          <DialogDescription>上次記錄、各項最高紀錄與近期進步趨勢</DialogDescription>
        </DialogHeader>
        {exercise && <ExerciseStatsPanel exercise={exercise} size="full" />}
      </DialogContent>
    </Dialog>
  );
}
