import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Exercise, WorkoutEntryWithExercise, InsertWorkoutEntry, insertWorkoutEntrySchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Activity, Trash2, Calendar, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient, invalidateWorkoutData } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTaipeiTime, toTaipeiTime } from "@/lib/timezone";
import { calculateBaseline } from "@shared/baseline";
import { toEntryPayload } from "@/lib/entry-payload";
import { computeCustomSets, computeProgressiveSets, detectProgression, validRows, type SetRow } from "@/lib/set-template";
import { effectiveLoad } from "@shared/training/load";
import { ExerciseStatsPanel } from "@/components/training/exercise-stats-panel";
import { LoadKgField } from "@/components/training/load-kg-field";
import { StrengthLoadFields } from "@/components/training/strength-load-fields";
import { useExerciseStats } from "@/hooks/use-training";
import { displayLabel } from "@shared/labels";

interface WeeklyProgress {
  weekStart: string;
  weekEnd: string;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    exerciseCategory: string | null;
    currentWeekValue: number;
    weeklyAverage: number | null;
    difference: number | null;
    differencePercentage: number | null;
  }>;
  recommendations: Array<{
    exerciseId: string;
    exerciseName: string;
    exerciseUnit: string;
    reason: string;
  }>;
}

// 這些項目才顯示「組數」欄位（跑步類的「組數」欄位實際記的是公里數）
function parseSetDetails(raw: string | null): SetRow[] | null {
  if (!raw) return null;
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows) && rows.length ? rows : null;
  } catch {
    return null;
  }
}

function exerciseUsesSets(exercise: Exercise): boolean {
  const hasMuscleGroup =
    (exercise.muscleChest ?? 0) > 0 || (exercise.muscleBack ?? 0) > 0 || (exercise.muscleLegs ?? 0) > 0 ||
    (exercise.muscleShoulders ?? 0) > 0 || (exercise.muscleArms ?? 0) > 0 || (exercise.muscleCore ?? 0) > 0 ||
    (exercise.muscleGlutes ?? 0) > 0 || (exercise.muscleFullBody ?? 0) > 0;
  return hasMuscleGroup || exercise.category === '力量' || exercise.category === '有氧';
}

export default function Entries() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkoutEntryWithExercise | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<WorkoutEntryWithExercise | null>(null);

  // 分組樣板：逐組遞增（重量遞增、次數可選擇同步遞減）跟逐組自訂（每組重量/
  // 次數各自任意）原本是兩個各自獨立的切換按鈕，使用者反應希望合併成一個
  // 按鈕、底下選其中一種樣板——改成單一 setsTemplate 狀態（互斥），UI 入口
  // 從兩顆按鈕變成一顆按鈕 + 選單，行為跟原本一致。
  const [setsTemplate, setSetsTemplate] = useState<'progressive' | 'custom' | null>(null);

  // 逐組遞增樣板引數：重量每組遞增 progIncrement，次數每組遞減
  // progRepsDecrement（遞減 0 代表每組次數都一樣，等同原本「逐組遞增」的
  // 行為，只是多開放次數也能跟著遞減）。
  const [progRepsPerSet, setProgRepsPerSet] = useState<number | "">(5);
  const [progRepsDecrement, setProgRepsDecrement] = useState<number | "">(0);
  const [progStartWeight, setProgStartWeight] = useState<number | "">("");
  const [progIncrement, setProgIncrement] = useState<number | "">(2.5);
  const [progNumSets, setProgNumSets] = useState<number | "">(4);

  // 逐組自訂樣板：每組重量、次數可各自不同（例如第1組18kg×8下、第2組20kg×9
  // 下、第3組20kg×6下）
  const [customSets, setCustomSets] = useState<{ weight: number | ""; reps: number | "" }[]>([
    { weight: "", reps: "" },
  ]);

  // 簡易（非樣板）力量記錄的重量拆成「基礎重量」+「附加負重」兩欄，讓使用
  // 者不用自己心算「預設值 + 附加公斤數」再填一個數字——原本 FormDescription
  // 就是這樣要求使用者手動算的，這裡改成系統自動加總。baseWeightFactor 是
  // UI 顯示/編輯用的獨立狀態（不直接綁 react-hook-form 的 weightFactor 欄
  // 位），因為要避免「addedLoad 每次變動都疊加到上一次已經加總過的
  // weightFactor 上」這種重複累加的錯誤——form 實際送出的 weightFactor 由
  // 下面的 effect 統一算成 baseWeightFactor + addedLoad 寫入，兩個獨立輸入
  // 框永遠對應各自單純的數字，不會互相汙染。
  const [baseWeightFactor, setBaseWeightFactor] = useState<number | "">("");
  const [addedLoad, setAddedLoad] = useState<number | "">(0);
  const { toast } = useToast();

  const { data: exercises } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  // 長條圖的比較基準：所有力量項目裡最高的動作強度
  const maxStrengthIntensity = Math.max(
    0,
    ...(exercises ?? []).filter((e) => e.category === '力量').map((e) => e.weightFactor),
  );

  const { data: entries, isLoading } = useQuery<WorkoutEntryWithExercise[]>({
    queryKey: ["/api/entries"],
  });

  const { data: weeklyProgress } = useQuery<WeeklyProgress>({
    queryKey: ["/api/stats/weekly-progress"],
    enabled: isCreateOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertWorkoutEntry) => apiRequest("POST", "/api/entries", data),
    onSuccess: () => {
      invalidateWorkoutData();
      setIsCreateOpen(false);
      form.reset();
      setSetsTemplate(null);
      setProgRepsPerSet(5);
      setProgRepsDecrement(0);
      setProgStartWeight("");
      setProgIncrement(2.5);
      setProgNumSets(4);
      setCustomSets([{ weight: "", reps: "" }]);
      setBaseWeightFactor("");
      setAddedLoad(0);
      toast({
        title: "成功",
        description: "運動記錄已新增",
      });
      setLocation("/");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/entries/${id}`, undefined),
    onSuccess: () => {
      invalidateWorkoutData();
      setDeletingEntry(null);
      toast({
        title: "成功",
        description: "運動記錄已刪除",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; entry: InsertWorkoutEntry }) => 
      apiRequest("PATCH", `/api/entries/${data.id}`, data.entry),
    onSuccess: () => {
      invalidateWorkoutData();
      setIsEditOpen(false);
      setEditingEntry(null);
      editForm.reset();
      toast({
        title: "成功",
        description: "運動記錄已更新",
      });
    },
  });

  const form = useForm<InsertWorkoutEntry>({
    resolver: zodResolver(insertWorkoutEntrySchema),
    defaultValues: {
      exerciseId: "",
      value: "" as any,
      date: getTaipeiTime(),
      notes: "",
      sets: undefined,
      weightFactor: undefined,
    },
  });

  const editForm = useForm<InsertWorkoutEntry>({
    resolver: zodResolver(insertWorkoutEntrySchema),
    defaultValues: {
      exerciseId: "",
      value: "" as any,
      date: getTaipeiTime(),
      notes: "",
      sets: undefined,
      weightFactor: undefined,
    },
  });

  // 處理從dashboard點選運動卡片跳轉過來的情況
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const addExerciseId = params.get('addExercise');
    
    if (addExerciseId && exercises) {
      // 驗證該運動類型存在
      const exerciseExists = exercises.some(e => e.id === addExerciseId);
      if (exerciseExists) {
        form.setValue('exerciseId', addExerciseId);
        setIsCreateOpen(true);
        // 清除URL引數，避免重新整理頁面時重複觸發
        setLocation('/entries', { replace: true });
      }
    }
  }, [searchString, exercises, form, setLocation]);

  const selectedExerciseId = form.watch("exerciseId");
  
  const { data: weeklyAverageData } = useQuery<{ average: number | null }>({
    queryKey: selectedExerciseId ? [`/api/stats/exercise-average/${selectedExerciseId}`] : [],
    enabled: !!selectedExerciseId,
  });

  // Reset sets template when exercise changes
  useEffect(() => {
    setSetsTemplate(null);
    setProgRepsPerSet(5);
    setProgRepsDecrement(0);
    setProgStartWeight("");
    setProgIncrement(2.5);
    setProgNumSets(4);
    setCustomSets([{ weight: "", reps: "" }]);
    // 基礎重量預設回新選定運動的重量係數，附加負重歸零——這裡是唯一一處統一
    // 處理，不管是使用者手動在下拉選單選運動、還是從快速記錄／課表點選直接
    // 帶 ?addExercise= 網址引數進來（那個路徑是 form.setValue 直接改
    // exerciseId，不會經過 Select 的 onValueChange），都會觸發這個 effect。
    const selectedExercise = exercises?.find((e) => e.id === selectedExerciseId);
    setBaseWeightFactor(selectedExercise?.weightFactor ?? "");
    setAddedLoad(0);
  }, [selectedExerciseId, exercises]);

  useEffect(() => {
    if (setsTemplate !== 'progressive') return;
    const start = typeof progStartWeight === 'number' ? progStartWeight : 0;
    const incr = typeof progIncrement === 'number' ? progIncrement : 0;
    const n = typeof progNumSets === 'number' ? progNumSets : 0;
    const reps = typeof progRepsPerSet === 'number' ? progRepsPerSet : 1;
    const decrement = typeof progRepsDecrement === 'number' ? progRepsDecrement : 0;
    if (start > 0 && n > 0 && reps > 0) {
      const result = computeCustomSets(computeProgressiveSets(start, incr, n, reps, decrement));
      if (result) {
        form.setValue('value', parseFloat(result.avgReps.toFixed(2)));
        form.setValue('sets', result.count);
        form.setValue('weightFactor', parseFloat(result.avgWeight.toFixed(2)));
        form.setValue('loadKg', null); // 逐組樣板沒有單一的外加負重
      }
    }
  }, [setsTemplate, progRepsPerSet, progRepsDecrement, progStartWeight, progIncrement, progNumSets]);

  useEffect(() => {
    if (setsTemplate !== 'custom') return;
    const result = computeCustomSets(customSets);
    if (result) {
      form.setValue('value', parseFloat(result.avgReps.toFixed(2)));
      form.setValue('sets', result.count);
      form.setValue('weightFactor', parseFloat(result.avgWeight.toFixed(2)));
      form.setValue('loadKg', null);
    }
  }, [setsTemplate, customSets]);

  // 簡易（非樣板）力量記錄：實際送出的 weightFactor = 基礎重量 + 附加負重，
  // 讓徒手動作的使用者額外背負重量時（負重背心、手持啞鈴等）不用自己心算
  // 「預設值 + 附加公斤數」再填回單一欄位。樣板模式（逐組遞增／逐組自訂）
  // 已經各自把 weightFactor 算好寫回 form 了，這裡跳過避免互相覆蓋。
  useEffect(() => {
    if (setsTemplate !== null) return;
    const exercise = exercises?.find((e) => e.id === selectedExerciseId);
    if (exercise?.category !== '力量') return; // 非力量項目的 loadKg 由獨立欄位輸入，這裡不能蓋掉
    const base = typeof baseWeightFactor === 'number' ? baseWeightFactor : 0;
    const added = typeof addedLoad === 'number' ? addedLoad : 0;
    form.setValue('weightFactor', Math.round((base + added) * 100) / 100);
    form.setValue('loadKg', added > 0 ? added : null); // 外加負重另外存一份，下次預填與顯示用
  }, [setsTemplate, baseWeightFactor, addedLoad, selectedExerciseId, exercises]);

  // ── 預填上次的記錄 ──────────────────────────────────────────────
  // 選定運動後，把「上次做的」（次數/組數/負重）帶進表單，使用者只要改有變的部分。
  // 每次選運動只預填一次（prefilledForRef），之後使用者自己改的值不會被覆蓋。
  const { data: exerciseStats } = useExerciseStats(selectedExerciseId || undefined);
  const prefilledForRef = useRef<string | null>(null);
  useEffect(() => {
    prefilledForRef.current = null;
  }, [selectedExerciseId, isCreateOpen]);
  useEffect(() => {
    const exercise = exercises?.find((e) => e.id === selectedExerciseId);
    const last = exerciseStats?.last;
    if (!isCreateOpen || !exercise || !last || exerciseStats?.exerciseId !== exercise.id) return;
    if (prefilledForRef.current === exercise.id) return;
    prefilledForRef.current = exercise.id;

    const isWeeklySteps = exercise.name === '每周平均步数'; // 記錄的是週總步數，輸入欄是每日平均
    form.setValue('value', isWeeklySteps ? Math.round(last.value / 7) : last.value);
    if (exerciseUsesSets(exercise) && last.loggedSets != null) form.setValue('sets', last.loggedSets);
    if (exercise.category === '力量' && last.load != null) {
      // 先還原動作強度 + 外加負重：新記錄有存外加負重；舊記錄沒有，就拿動作強度預設值去拆
      const external = last.externalLoad ?? Math.max(0, Math.round((last.load - exercise.weightFactor) * 100) / 100);
      const base = Math.round((last.load - external) * 100) / 100;
      setBaseWeightFactor(base);
      setAddedLoad(external);
      // 上次是逐組樣板就原樣還原：等差遞增 → 遞增樣板（起始重量/每組遞增/組數/次數/遞減），其他 → 逐組自訂
      if (last.setDetails?.length) {
        const progression = detectProgression(last.setDetails);
        if (progression) {
          setSetsTemplate('progressive');
          setProgStartWeight(progression.startWeight);
          setProgIncrement(progression.increment);
          setProgNumSets(progression.numSets);
          setProgRepsPerSet(progression.repsPerSet);
          setProgRepsDecrement(progression.repsDecrement);
        } else {
          setSetsTemplate('custom');
          setCustomSets(last.setDetails.map((s) => ({ weight: s.weight, reps: s.reps })));
        }
      }
    } else if (exercise.category !== '力量' && last.load != null) {
      form.setValue('loadKg', last.load);
    }
  }, [exerciseStats, selectedExerciseId, exercises, isCreateOpen]);

  const onSubmit = (data: InsertWorkoutEntry) => {
    const selectedExercise = exercises?.find((e) => e.id === data.exerciseId);
    const payload = toEntryPayload(data, selectedExercise);
    // 逐組樣板：平均值之外也存每組明細，下次預填才能還原同樣的遞增方式
    const rows: SetRow[] =
      setsTemplate === 'custom'
        ? validRows(customSets)
        : setsTemplate === 'progressive'
          ? computeProgressiveSets(
              Number(progStartWeight) || 0, Number(progIncrement) || 0, Number(progNumSets) || 0,
              Number(progRepsPerSet) || 1, Number(progRepsDecrement) || 0,
            )
          : [];
    if (rows.length > 0) payload.setDetails = rows;
    createMutation.mutate(payload);
  };

  const onEditSubmit = (data: InsertWorkoutEntry) => {
    if (!editingEntry) return;
    const selectedExercise = exercises?.find((e) => e.id === data.exerciseId);
    const payload = toEntryPayload(data, selectedExercise);
    // 次數/組數/強度沒改，逐組明細與外加負重才還有效；改過就清掉，免得跟平均值對不上
    const unchanged =
      editingEntry.value === payload.value &&
      (editingEntry.sets ?? undefined) === (payload.sets ?? undefined) &&
      editingEntry.weightFactor === payload.weightFactor;
    if (selectedExercise?.category === '力量') payload.loadKg = unchanged ? editingEntry.loadKg : null;
    payload.setDetails = unchanged ? parseSetDetails(editingEntry.setDetails) : null;
    updateMutation.mutate({ id: editingEntry.id, entry: payload });
  };

  const handleEditEntry = (entry: WorkoutEntryWithExercise) => {
    setEditingEntry(entry);
    // 預填充表單資料
    const taipeiDate = toTaipeiTime(entry.date);
    editForm.reset({
      exerciseId: entry.exerciseId,
      value: entry.exercise.name === '每周平均步数' ? entry.value / 7 : entry.value,
      date: taipeiDate,
      notes: entry.notes || "",
      sets: entry.sets ?? undefined,
      weightFactor: entry.weightFactor ?? entry.exercise.weightFactor,
      loadKg: entry.loadKg ?? null,
    });
    setIsEditOpen(true);
  };

  // 即時預覽用同一份公式（@shared/baseline），並照伺服器寫入時的做法：沒填組數 = 1。
  const calculateBaselineValue = (value: number, exerciseId: string, customWeightFactor?: number, sets?: number) => {
    const exercise = exercises?.find((e) => e.id === exerciseId);
    if (!exercise) return 0;
    return calculateBaseline(
      value,
      sets ?? 1,
      customWeightFactor ?? exercise.weightFactor,
      exercise.category,
      exercise.movementCoefficient ?? 1,
      exercise.intensityFactor ?? 1,
      exercise.name,
    );
  };

  return (
    <div className="space-y-6" data-testid="page-entries">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">資料記錄</h1>
          <p className="text-muted-foreground mt-2">記錄您的運動資料</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setSetsTemplate(null);
            setProgRepsPerSet(5);
            setProgRepsDecrement(0);
            setProgStartWeight("");
            setProgIncrement(2.5);
            setProgNumSets(4);
            setCustomSets([{ weight: "", reps: "" }]);
            setBaseWeightFactor("");
            setAddedLoad(0);
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-entry">
              <Plus className="mr-2 h-4 w-4" />
              新增記錄
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新增運動記錄</DialogTitle>
              <DialogDescription>記錄您的運動資料和相關資訊</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="exerciseId"
                  render={({ field }) => {
                    const selectedExercise = exercises?.find((e) => e.id === field.value);
                    const weeklyAverage = weeklyAverageData?.average;
                    const isAverageSteps = selectedExercise?.name === '每周平均步数';
                    const currentWeekProgress = weeklyProgress?.exercises.find(e => e.exerciseId === field.value);
                    
                    return (
                      <FormItem>
                        <FormLabel>運動類型</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          // 換運動就清掉上一個運動帶進來的數字（新運動有歷史的話會再自動預填）
                          form.setValue("value", "" as any);
                          form.setValue("sets", undefined);
                          form.setValue("loadKg", null);
                          const exercise = exercises?.find((e) => e.id === value);
                          if (exercise) {
                            form.setValue("weightFactor", exercise.weightFactor);
                          }
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-exercise">
                              <SelectValue placeholder="選擇運動類型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {exercises?.map((exercise) => (
                              <SelectItem key={exercise.id} value={exercise.id} data-testid={`select-option-${exercise.id}`}>
                                {displayLabel(exercise.name)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.value && (currentWeekProgress || weeklyAverage !== null && weeklyAverage !== undefined) && (
                          <div className="space-y-1.5 mt-2 p-2 rounded-md bg-muted/50" data-testid="exercise-progress-info">
                            {currentWeekProgress && (
                              <FormDescription className="text-sm">
                                <span className="font-medium">本週進度: </span>
                                {isAverageSteps 
                                  ? `${(currentWeekProgress.currentWeekValue / 7).toFixed(0)} 步/天 (${currentWeekProgress.currentWeekValue.toFixed(0)} 步/週)`
                                  : `${currentWeekProgress.currentWeekValue.toFixed(1)} ${selectedExercise?.unit || ''}`
                                }
                                {currentWeekProgress.differencePercentage !== null && currentWeekProgress.weeklyAverage !== null && currentWeekProgress.weeklyAverage > 0 && (
                                  <span className={`ml-2 font-semibold ${currentWeekProgress.differencePercentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                    ({currentWeekProgress.differencePercentage >= 0 ? '+' : ''}{currentWeekProgress.differencePercentage.toFixed(0)}%)
                                  </span>
                                )}
                              </FormDescription>
                            )}
                            {weeklyAverage !== null && weeklyAverage !== undefined && (
                              <FormDescription className="text-sm text-muted-foreground">
                                <span className="font-medium">歷史週平均: </span>
                                {isAverageSteps ? `${(weeklyAverage / 7).toFixed(0)} 步/天 (${weeklyAverage.toFixed(0)} 步/週)` : `${weeklyAverage.toFixed(1)} ${selectedExercise?.unit || ''}`}
                              </FormDescription>
                            )}
                          </div>
                        )}
                        {selectedExercise && selectedExercise.category !== '活动量' && (
                          <ExerciseStatsPanel
                            exercise={selectedExercise}
                            draft={{
                              value: Number(form.watch("value")) || undefined,
                              sets: form.watch("sets") ?? undefined,
                              load: selectedExercise.category === '力量' ? form.watch("weightFactor") ?? null : form.watch("loadKg") ?? null,
                            }}
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                {(() => {
                  const selectedExercise = exercises?.find((e) => e.id === form.watch("exerciseId"));
                  const isCardio = selectedExercise?.category === '有氧';
                  const isActivity = selectedExercise?.category === '活动量';
                  if (!form.watch("exerciseId") || isCardio || isActivity) return null;
                  return (
                    <FormField
                      control={form.control}
                      name="weightFactor"
                      render={({ field }) => {
                        const isStrengthEx = selectedExercise?.category === '力量';
                        const isProgReadOnly = isStrengthEx && setsTemplate !== null;
                        if (!isStrengthEx) {
                          return (
                            <FormItem>
                              <FormLabel>權重係數</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="輸入權重係數"
                                  {...field}
                                  value={field.value ?? selectedExercise?.weightFactor ?? 1}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                                  data-testid="input-entry-weight-factor"
                                />
                              </FormControl>
                              <FormDescription className="text-xs text-muted-foreground">
                                {`預設值: ${selectedExercise?.weightFactor ?? 1}（可臨時修改本次記錄的權重）`}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          );
                        }
                        // 力量項目：非樣板模式下拆成「動作強度」+「外加負重」兩欄，
                        // 送出的 weightFactor（field.value）由上面那個 effect 統一
                        // 算成兩者相加；樣板模式顯示樣板算好的合計，唯讀。
                        const totalWeight = isProgReadOnly
                          ? field.value ?? 0
                          : (typeof baseWeightFactor === 'number' ? baseWeightFactor : 0)
                            + (typeof addedLoad === 'number' ? addedLoad : 0);
                        return (
                          <StrengthLoadFields
                            intensity={baseWeightFactor}
                            added={addedLoad}
                            defaultIntensity={selectedExercise?.weightFactor ?? 1}
                            maxIntensity={maxStrengthIntensity}
                            readOnly={isProgReadOnly}
                            templateNote={setsTemplate === 'progressive' ? "已由遞增樣板自動填入平均強度" : "已由自訂樣板換算自動填入平均強度"}
                            total={Math.round(totalWeight * 100) / 100}
                            onIntensityChange={setBaseWeightFactor}
                            onAddedChange={setAddedLoad}
                          />
                        );
                      }}
                    />
                  );
                })()}
                {(() => {
                  const selectedExercise = exercises?.find((e) => e.id === form.watch("exerciseId"));
                  if (!selectedExercise || selectedExercise.category === '力量' || selectedExercise.category === '活动量') return null;
                  return <LoadKgField control={form.control} testId="input-entry-load-kg" />;
                })()}
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => {
                    const selectedExercise = exercises?.find((e) => e.id === form.watch("exerciseId"));
                    const isStrength = selectedExercise?.category === '力量';
                    const isAverageSteps = selectedExercise?.name === '每周平均步数';
                    const isCardio = selectedExercise?.category === '有氧';
                    const isJumpingJacks = selectedExercise?.name === '開合跳';
                    const currentWeightFactor = form.watch("weightFactor");
                    const currentSets = form.watch("sets");

                    const valueLabel = isAverageSteps
                      ? '每日平均步數'
                      : isJumpingJacks
                        ? '次數'
                        : isCardio
                          ? '運動時間（分鐘）'
                          : isStrength
                            ? (setsTemplate !== null ? '次數（已自動填入平均值）' : '次數（下）')
                            : '資料值';
                    const valuePlaceholder = isAverageSteps
                      ? "輸入每日平均步數"
                      : isJumpingJacks
                        ? "輸入次數"
                        : isCardio
                          ? "輸入運動分鐘數"
                          : isStrength
                            ? "輸入每組次數（下）"
                            : "輸入資料值";

                    return (
                      <FormItem>
                        <div className="flex items-center justify-between gap-2">
                          <FormLabel>{valueLabel}</FormLabel>
                          {isStrength && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  data-testid="button-sets-template"
                                >
                                  {setsTemplate === 'progressive'
                                    ? <><ChevronUp className="h-3 w-3 mr-1" />遞增樣板</>
                                    : setsTemplate === 'custom'
                                      ? <><ChevronUp className="h-3 w-3 mr-1" />自訂樣板</>
                                      : <><ChevronDown className="h-3 w-3 mr-1" />分組樣板</>}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-72">
                                <DropdownMenuLabel>選擇分組樣板</DropdownMenuLabel>
                                <DropdownMenuRadioGroup
                                  value={setsTemplate ?? "none"}
                                  onValueChange={(v) => {
                                    setSetsTemplate(v === "none" ? null : (v as 'progressive' | 'custom'));
                                    if (v !== 'progressive') setProgStartWeight("");
                                  }}
                                >
                                  <DropdownMenuRadioItem value="none" data-testid="option-template-none">
                                    不使用樣板（手動輸入）
                                  </DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="progressive" data-testid="option-template-progressive">
                                    <div>
                                      <div>逐組遞增</div>
                                      <div className="text-xs text-muted-foreground font-normal">重量每組遞增，次數可同步遞減（遞減 0 = 每組次數相同）</div>
                                    </div>
                                  </DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="custom" data-testid="option-template-custom">
                                    <div>
                                      <div>逐組自訂</div>
                                      <div className="text-xs text-muted-foreground font-normal">每組重量、次數各自任意輸入</div>
                                    </div>
                                  </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        {isStrength && setsTemplate === 'progressive' && (
                          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground">逐組遞增設定（每組填的是該組的合計強度，系統換算成平均）</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">起始次數（下）</label>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  placeholder="起始次數"
                                  value={progRepsPerSet}
                                  onChange={(e) => setProgRepsPerSet(e.target.value ? parseInt(e.target.value) : "")}
                                  data-testid="input-prog-reps"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">每組次數遞減（下，0=不變）</label>
                                <Input
                                  type="number"
                                  step="1"
                                  min="0"
                                  placeholder="次數遞減"
                                  value={progRepsDecrement}
                                  onChange={(e) => setProgRepsDecrement(e.target.value ? parseInt(e.target.value) : "")}
                                  data-testid="input-prog-reps-decrement"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">起始強度（合計）</label>
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  placeholder="起始強度"
                                  value={progStartWeight}
                                  onChange={(e) => setProgStartWeight(e.target.value ? parseFloat(e.target.value) : "")}
                                  data-testid="input-prog-start-weight"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">每組強度遞增</label>
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  placeholder="遞增值"
                                  value={progIncrement}
                                  onChange={(e) => setProgIncrement(e.target.value ? parseFloat(e.target.value) : "")}
                                  data-testid="input-prog-increment"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">總組數</label>
                                <Input
                                  type="number"
                                  step="1"
                                  min="1"
                                  placeholder="組數"
                                  value={progNumSets}
                                  onChange={(e) => setProgNumSets(e.target.value ? parseInt(e.target.value) : "")}
                                  data-testid="input-prog-num-sets"
                                />
                              </div>
                            </div>
                            {typeof progStartWeight === 'number' && progStartWeight > 0 && typeof progNumSets === 'number' && progNumSets > 0 && (
                              <div className="text-xs space-y-0.5">
                                {(() => {
                                  const reps = typeof progRepsPerSet === 'number' ? progRepsPerSet : 1;
                                  const decrement = typeof progRepsDecrement === 'number' ? progRepsDecrement : 0;
                                  const sets = computeProgressiveSets(
                                    progStartWeight,
                                    typeof progIncrement === 'number' ? progIncrement : 0,
                                    progNumSets,
                                    reps,
                                    decrement,
                                  );
                                  const result = computeCustomSets(sets);
                                  if (!result) return null;
                                  const baseline = calculateBaselineValue(result.avgReps, form.watch("exerciseId"), result.avgWeight, result.count);
                                  return (
                                    <>
                                      <p className="text-muted-foreground">
                                        <span className="font-medium">各組: </span>
                                        {sets.map((s) => `${s.weight}×${s.reps}下`).join(' → ')}
                                      </p>
                                      <p className="text-foreground font-medium">
                                        換算：{result.avgReps.toFixed(1)}下 × {result.count}組 @ {result.avgWeight.toFixed(1)}（總訓練量相同）
                                      </p>
                                      <p className="text-foreground font-medium">
                                        預估基準值: {baseline.toFixed(1)}
                                      </p>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                        {isStrength && setsTemplate === 'custom' && (
                          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground">逐組自訂（每組重量、次數可各自不同）</p>
                            <div className="space-y-2">
                              {customSets.map((s, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-10 shrink-0">第{idx + 1}組</span>
                                  <Input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    placeholder="強度（合計）"
                                    value={s.weight}
                                    onChange={(e) => {
                                      const v = e.target.value ? parseFloat(e.target.value) : "";
                                      setCustomSets((prev) => prev.map((row, i) => (i === idx ? { ...row, weight: v } : row)));
                                    }}
                                    data-testid={`input-custom-set-weight-${idx}`}
                                  />
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="次數(下)"
                                    value={s.reps}
                                    onChange={(e) => {
                                      const v = e.target.value ? parseInt(e.target.value) : "";
                                      setCustomSets((prev) => prev.map((row, i) => (i === idx ? { ...row, reps: v } : row)));
                                    }}
                                    data-testid={`input-custom-set-reps-${idx}`}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0"
                                    disabled={customSets.length <= 1}
                                    onClick={() => setCustomSets((prev) => prev.filter((_, i) => i !== idx))}
                                    data-testid={`button-remove-custom-set-${idx}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCustomSets((prev) => [...prev, { weight: prev[prev.length - 1]?.weight ?? "", reps: "" }])}
                              data-testid="button-add-custom-set"
                            >
                              <Plus className="h-3 w-3 mr-1" />新增一組
                            </Button>
                            {(() => {
                              const result = computeCustomSets(customSets);
                              if (!result) return null;
                              const baseline = calculateBaselineValue(result.avgReps, form.watch("exerciseId"), result.avgWeight, result.count);
                              return (
                                <div className="text-xs space-y-0.5">
                                  <p className="text-muted-foreground">
                                    <span className="font-medium">各組: </span>
                                    {customSets
                                      .filter((s): s is { weight: number; reps: number } => typeof s.weight === 'number' && typeof s.reps === 'number' && s.weight > 0 && s.reps > 0)
                                      .map((s) => `${s.weight}×${s.reps}`)
                                      .join('、')}
                                  </p>
                                  <p className="text-foreground font-medium">
                                    換算：{result.avgReps.toFixed(1)}下 × {result.count}組 @ {result.avgWeight.toFixed(1)}（總訓練量相同）
                                  </p>
                                  <p className="text-foreground font-medium">
                                    預估基準值: {baseline.toFixed(1)}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={valuePlaceholder}
                            {...field}
                            readOnly={isStrength && setsTemplate !== null}
                            className={isStrength && setsTemplate !== null ? "bg-muted" : ""}
                            onChange={(e) => {
                              if (!(isStrength && setsTemplate !== null)) {
                                field.onChange(parseFloat(e.target.value) || 0);
                              }
                            }}
                            data-testid="input-entry-value"
                          />
                        </FormControl>
                        {isCardio && selectedExercise && (
                          <FormDescription className="text-xs text-muted-foreground">
                            強度型態: {(() => {
                              const f = selectedExercise.intensityFactor ?? 1;
                              const labels: Record<number, string> = { 1: '普通慢跑', 1.5: '開合跳', 2: '負重行走/高強度間歇' };
                              return labels[f] ?? `${f}`;
                            })()} (x{selectedExercise.intensityFactor ?? 1})
                          </FormDescription>
                        )}
                        {field.value > 0 && form.watch("exerciseId") && (
                          <FormDescription>
                            {isAverageSteps ? (
                              <>
                                每週總步數: {(field.value * 7).toFixed(0)} 步 |{" "}
                                基準值: {calculateBaselineValue(field.value * 7, form.watch("exerciseId"), currentWeightFactor, currentSets).toFixed(2)}
                              </>
                            ) : (
                              <>
                                基準值: {calculateBaselineValue(field.value, form.watch("exerciseId"), currentWeightFactor, currentSets).toFixed(2)}
                              </>
                            )}
                          </FormDescription>
                        )}
                        {isStrength && field.value > 0 && selectedExercise && (
                          <div className="rounded-md bg-muted/30 border px-3 py-2 text-xs space-y-1">
                            <p className="font-medium text-muted-foreground">合計強度換算參考（{field.value}下 × {currentSets || 1}組）</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {[-20, -10, -5, 0, 5, 10, 20].map((delta) => {
                                const baseWF = currentWeightFactor ?? selectedExercise.weightFactor;
                                const refWF = baseWF + delta;
                                if (refWF <= 0) return null;
                                const baseline = calculateBaselineValue(field.value, form.watch("exerciseId"), refWF, currentSets || 1);
                                return (
                                  <span key={delta} className={delta === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}>
                                    {refWF}={baseline.toFixed(0)}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {isAverageSteps && (
                          <FormDescription className="text-xs text-muted-foreground">
                            系統將自動乘以7計算每週總步數
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                {(() => {
                  const selectedExercise = exercises?.find((e) => e.id === form.watch("exerciseId"));
                  const isRunning = selectedExercise?.name === '跑步' || selectedExercise?.name === '跑步機負重';
                  const isStrengthExercise = selectedExercise?.category === "力量";
                  const showSets = !!selectedExercise && exerciseUsesSets(selectedExercise);
                  return showSets ? (
                    <FormField
                      control={form.control}
                      name="sets"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isRunning ? "距離（公里，可選）" : "組數（可選）"}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step={isRunning ? "0.01" : "1"}
                              min={isRunning ? "0" : "1"}
                              placeholder={isRunning ? "輸入跑步距離（公里）" : "輸入組數"}
                              {...field}
                              value={field.value ?? ""}
                              readOnly={isStrengthExercise && setsTemplate !== null}
                              className={isStrengthExercise && setsTemplate !== null ? "bg-muted" : ""}
                              onChange={(e) => {
                                if (!(isStrengthExercise && setsTemplate !== null)) {
                                  field.onChange(e.target.value ? parseFloat(e.target.value) : undefined);
                                }
                              }}
                              data-testid="input-entry-sets"
                            />
                          </FormControl>
                          <FormDescription>
                            {isRunning
                              ? "留空將根據預設配速估算距離"
                              : isStrengthExercise && setsTemplate !== null
                                ? "已由逐組自動填入"
                                : "記錄本次訓練的組數，用於追蹤各肌群訓練量"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null;
                })()}
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>日期時間（臺北時間 UTC+8）</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          data-testid="input-entry-date"
                        />
                      </FormControl>
                      <FormDescription>
                        請輸入臺北時間，系統將自動轉換為UTC儲存
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>備註（可選）</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="記錄感受、進展等..."
                          {...field}
                          data-testid="input-entry-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    data-testid="button-cancel-entry"
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-entry">
                    {createMutation.isPending ? "儲存中..." : "儲存"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : entries && entries.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>運動記錄列表</CardTitle>
            <CardDescription>共 {entries.length} 條記錄</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>運動</TableHead>
                  <TableHead>資料值</TableHead>
                  <TableHead>組數</TableHead>
                  <TableHead>強度 / 負重</TableHead>
                  <TableHead>基準值</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  return (
                    <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary" />
                          {displayLabel(entry.exercise.name)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.value} {entry.exercise.unit}
                      </TableCell>
                      <TableCell data-testid={`sets-${entry.id}`}>
                        {entry.sets
                          ? (entry.exercise.name === '跑步' || entry.exercise.name === '跑步機負重')
                            ? `${entry.sets} 公里`
                            : `${entry.sets} 組`
                          : "-"}
                      </TableCell>
                      <TableCell data-testid={`load-${entry.id}`}>
                        {(() => {
                          const load = effectiveLoad(entry, entry.exercise);
                          if (!load) return "-";
                          if (entry.exercise.category !== '力量') return `${load} kg`;
                          return entry.loadKg ? `強度 ${load}（外加 ${entry.loadKg} kg）` : `強度 ${load}`;
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" data-testid={`badge-baseline-${entry.id}`}>
                          {(entry.baselineValue ?? 0).toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(entry.date), "PPpp", { locale: zhCN })}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {entry.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditEntry(entry)}
                          data-testid={`button-edit-entry-${entry.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingEntry(entry)}
                          data-testid={`button-delete-entry-${entry.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              還沒有運動記錄，點選"新增記錄"開始記錄
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯運動記錄</DialogTitle>
            <DialogDescription>修改運動資料和相關資訊</DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="exerciseId"
                render={({ field }) => {
                  const selectedExercise = exercises?.find((e) => e.id === field.value);
                  const isAverageSteps = selectedExercise?.name === '每周平均步数';
                  
                  return (
                    <FormItem>
                      <FormLabel>運動類型</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        const exercise = exercises?.find((e) => e.id === value);
                        if (exercise) {
                          editForm.setValue("weightFactor", exercise.weightFactor);
                        }
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-exercise">
                            <SelectValue placeholder="選擇運動類型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {exercises?.map((exercise) => (
                            <SelectItem key={exercise.id} value={exercise.id} data-testid={`select-option-${exercise.id}`}>
                              {displayLabel(exercise.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              {(() => {
                const selectedExercise = exercises?.find((e) => e.id === editForm.watch("exerciseId"));
                const isCardio = selectedExercise?.category === '有氧';
                const isActivity = selectedExercise?.category === '活动量';
                if (!editForm.watch("exerciseId") || isCardio || isActivity) return null;
                return (
                  <FormField
                    control={editForm.control}
                    name="weightFactor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{selectedExercise?.category === '力量' ? '合計強度（動作強度＋外加負重）' : '權重係數'}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={selectedExercise?.category === '力量' ? "輸入合計強度" : "輸入權重係數"}
                            {...field}
                            value={field.value ?? selectedExercise?.weightFactor ?? 1}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                            data-testid="input-edit-weight-factor"
                          />
                        </FormControl>
                        <FormDescription className="text-xs text-muted-foreground">
                          {selectedExercise?.category === '力量'
                            ? `動作強度預設 ${selectedExercise?.weightFactor ?? 1}。合計強度 = 動作強度 + 外加負重（kg）`
                            : `預設值: ${selectedExercise?.weightFactor ?? 1}（可臨時修改本次記錄的權重）`}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              })()}
              {(() => {
                const selectedExercise = exercises?.find((e) => e.id === editForm.watch("exerciseId"));
                if (!selectedExercise || selectedExercise.category === '力量' || selectedExercise.category === '活动量') return null;
                return <LoadKgField control={editForm.control} testId="input-edit-load-kg" />;
              })()}
              <FormField
                control={editForm.control}
                name="value"
                render={({ field }) => {
                  const selectedExercise = exercises?.find((e) => e.id === editForm.watch("exerciseId"));
                  const isAverageSteps = selectedExercise?.name === '每周平均步数';
                  const isCardio = selectedExercise?.category === '有氧';
                  const isJumpingJacks = selectedExercise?.name === '開合跳';
                  const currentWeightFactor = editForm.watch("weightFactor");
                  
                  const valueLabel = isAverageSteps 
                    ? '每日平均步數' 
                    : isJumpingJacks
                      ? '次數'
                      : isCardio 
                        ? '運動時間（分鐘）' 
                        : '資料值';
                  const valuePlaceholder = isAverageSteps 
                    ? "輸入每日平均步數" 
                    : isJumpingJacks
                      ? "輸入次數"
                      : isCardio 
                        ? "輸入運動分鐘數" 
                        : "輸入資料值";
                  
                  return (
                    <FormItem>
                      <FormLabel>{valueLabel}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={valuePlaceholder}
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          data-testid="input-entry-value"
                        />
                      </FormControl>
                      {isCardio && selectedExercise && (
                        <FormDescription className="text-xs text-muted-foreground">
                          強度型態: {(() => {
                            const f = selectedExercise.intensityFactor ?? 1;
                            const labels: Record<number, string> = { 1: '普通慢跑', 1.5: '開合跳', 2: '負重行走/高強度間歇' };
                            return labels[f] ?? `${f}`;
                          })()} (x{selectedExercise.intensityFactor ?? 1})
                        </FormDescription>
                      )}
                      {field.value > 0 && editForm.watch("exerciseId") && (
                        <FormDescription>
                          {isAverageSteps ? (
                            <>
                              每週總步數: {(field.value * 7).toFixed(0)} 步 | 
                              基準值: {calculateBaselineValue(field.value * 7, editForm.watch("exerciseId"), currentWeightFactor, editForm.watch("sets")).toFixed(2)}
                            </>
                          ) : (
                            <>
                              基準值: {calculateBaselineValue(field.value, editForm.watch("exerciseId"), currentWeightFactor, editForm.watch("sets")).toFixed(2)}
                            </>
                          )}
                        </FormDescription>
                      )}
                      {isAverageSteps && (
                        <FormDescription className="text-xs text-muted-foreground">
                          系統將自動乘以7計算每週總步數
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              {(() => {
                const selectedExercise = exercises?.find((e) => e.id === editForm.watch("exerciseId"));
                const hasMuscleGroup = selectedExercise && (
                  (selectedExercise.muscleChest ?? 0) > 0 ||
                  (selectedExercise.muscleBack ?? 0) > 0 ||
                  (selectedExercise.muscleLegs ?? 0) > 0 ||
                  (selectedExercise.muscleShoulders ?? 0) > 0 ||
                  (selectedExercise.muscleArms ?? 0) > 0 ||
                  (selectedExercise.muscleCore ?? 0) > 0 ||
                  (selectedExercise.muscleGlutes ?? 0) > 0 ||
                  (selectedExercise.muscleFullBody ?? 0) > 0
                );
                const isRunning = selectedExercise?.name === '跑步' || selectedExercise?.name === '跑步機負重';
                const showSets = hasMuscleGroup || selectedExercise?.category === "力量" || selectedExercise?.category === "有氧";
                return showSets ? (
                  <FormField
                    control={editForm.control}
                    name="sets"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isRunning ? "距離（公里，可選）" : "組數（可選）"}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step={isRunning ? "0.01" : "1"}
                            min={isRunning ? "0" : "1"}
                            placeholder={isRunning ? "輸入跑步距離（公里）" : "輸入組數"}
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            data-testid="input-entry-sets"
                          />
                        </FormControl>
                        <FormDescription>
                          {isRunning
                            ? "留空將根據預設配速估算距離"
                            : "記錄本次訓練的組數，用於追蹤各肌群訓練量"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null;
              })()}
              <FormField
                control={editForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>日期時間（臺北時間 UTC+8）</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-entry-date"
                      />
                    </FormControl>
                    <FormDescription>
                      請輸入臺北時間，系統將自動轉換為UTC儲存
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註（可選）</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="記錄感受、進展等..."
                        {...field}
                        data-testid="input-entry-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  data-testid="button-cancel-entry"
                >
                  取消
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-entry">
                  {updateMutation.isPending ? "儲存中..." : "儲存修改"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除這條運動記錄嗎？此操作無法撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-entry">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEntry && deleteMutation.mutate(deletingEntry.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-entry"
            >
              {deleteMutation.isPending ? "刪除中..." : "刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
