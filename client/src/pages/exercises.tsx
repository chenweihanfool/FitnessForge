import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Exercise, InsertExercise, insertExerciseSchema } from "@shared/schema";
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
import { Input } from "@/components/ui/input";
import { Plus, Dumbbell, Trash2, Pencil, Filter, LineChart } from "lucide-react";
import { IntensityOverview } from "@/components/training/intensity-overview";
import { ExerciseHistoryDialog } from "@/components/training/exercise-history-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient, invalidateExerciseData } from "@/lib/queryClient";
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
import { MUSCLE_FIELDS } from "@shared/training/recovery";
import { displayLabel } from "@shared/labels";

const CATEGORIES = ["力量", "有氧", "柔韧性", "核心", "平衡", "活动量", "其他"];
const MUSCLE_GROUPS = ["胸", "背", "腿", "肩", "二头肌", "核心", "臀", "三头肌"];
const INTENSITY_OPTIONS = [
  { value: 1.0, label: "普通慢跑" },
  { value: 1.5, label: "開合跳" },
  { value: 2.0, label: "負重行走 / 高強度間歇" },
];

function getIntensityLabel(factor: number): string {
  const option = INTENSITY_OPTIONS.find(o => o.value === factor);
  return option ? option.label : `${factor}`;
}

export default function Exercises() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [deletingExercise, setDeletingExercise] = useState<Exercise | null>(null);
  const [historyExercise, setHistoryExercise] = useState<Exercise | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { toast } = useToast();

  const { data: exercises, isLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  // 獲取要刪除的運動項目的記錄數量
  const { data: entryCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/exercises", deletingExercise?.id, "entry-count"],
    enabled: !!deletingExercise,
  });
  const deletingEntryCount = entryCountData?.count ?? 0;

  const createMutation = useMutation({
    mutationFn: (data: InsertExercise) => apiRequest("POST", "/api/exercises", data),
    onSuccess: () => {
      invalidateExerciseData();
      setIsCreateOpen(false);
      toast({
        title: "成功",
        description: "運動類型已建立",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertExercise }) =>
      apiRequest("PATCH", `/api/exercises/${id}`, data),
    onSuccess: () => {
      invalidateExerciseData();
      setEditingExercise(null);
      toast({
        title: "成功",
        description: "運動類型已更新",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/exercises/${id}`, undefined),
    onSuccess: () => {
      invalidateExerciseData();
      setDeletingExercise(null);
      toast({
        title: "成功",
        description: "運動類型已刪除",
      });
    },
  });

  const muscleGroupLabels = MUSCLE_FIELDS.map(({ field, name }) => ({ field, name: displayLabel(name) }));

  const form = useForm<InsertExercise>({
    resolver: zodResolver(insertExerciseSchema),
    defaultValues: {
      name: "",
      unit: "",
      weightFactor: 1,
      category: "none",
      splitCategory: "none",
      splitRatio: 0,
      movementCoefficient: 1,
      intensityFactor: 1,
      muscleChest: 0,
      muscleBack: 0,
      muscleLegs: 0,
      muscleShoulders: 0,
      muscleArms: 0,
      muscleCore: 0,
      muscleGlutes: 0,
      muscleFullBody: 0,
    },
  });

  const editForm = useForm<InsertExercise>({
    resolver: zodResolver(insertExerciseSchema),
    defaultValues: {
      name: "",
      unit: "",
      weightFactor: 1,
      category: "none",
      splitCategory: "none",
      splitRatio: 0,
      movementCoefficient: 1,
      intensityFactor: 1,
      muscleChest: 0,
      muscleBack: 0,
      muscleLegs: 0,
      muscleShoulders: 0,
      muscleArms: 0,
      muscleCore: 0,
      muscleGlutes: 0,
      muscleFullBody: 0,
    },
  });

  const onCreateSubmit = (data: InsertExercise) => {
    const submitData = {
      ...data,
      category: data.category === "none" ? undefined : data.category,
      splitCategory: data.splitCategory === "none" ? undefined : data.splitCategory,
      splitRatio: data.splitCategory === "none" ? 0 : data.splitRatio,
    };
    createMutation.mutate(submitData);
  };

  const onUpdateSubmit = (data: InsertExercise) => {
    if (editingExercise) {
      const submitData = {
        ...data,
        category: data.category === "none" ? undefined : data.category,
        splitCategory: data.splitCategory === "none" ? undefined : data.splitCategory,
        splitRatio: data.splitCategory === "none" ? 0 : data.splitRatio,
      };
      updateMutation.mutate({ id: editingExercise.id, data: submitData });
    }
  };

  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise);
    editForm.reset({
      name: exercise.name,
      unit: exercise.unit,
      weightFactor: exercise.weightFactor,
      category: exercise.category || "none",
      splitCategory: exercise.splitCategory || "none",
      splitRatio: exercise.splitRatio || 0,
      movementCoefficient: exercise.movementCoefficient ?? 1,
      intensityFactor: exercise.intensityFactor ?? 1,
      muscleChest: exercise.muscleChest || 0,
      muscleBack: exercise.muscleBack || 0,
      muscleLegs: exercise.muscleLegs || 0,
      muscleShoulders: exercise.muscleShoulders || 0,
      muscleArms: exercise.muscleArms || 0,
      muscleCore: exercise.muscleCore || 0,
      muscleGlutes: exercise.muscleGlutes || 0,
      muscleFullBody: exercise.muscleFullBody || 0,
    });
  };

  // 篩選運動列表
  const filteredExercises = exercises?.filter((ex) => {
    if (selectedCategory === "all") return true;
    if (selectedCategory === "uncategorized") return !ex.category;
    return ex.category === selectedCategory;
  }) || [];

  return (
    <div className="space-y-6" data-testid="page-exercises">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">運動管理</h1>
            <p className="text-muted-foreground mt-2">管理您的運動類型和轉換係數</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-exercise">
              <Plus className="mr-2 h-4 w-4" />
              建立運動
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>建立運動類型</DialogTitle>
              <DialogDescription>
                新增新的運動類型，設定單位和重量轉換係數
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>運動名稱</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：俯臥撐、深蹲" {...field} data-testid="input-exercise-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>單位</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：次、公斤、分鐘" {...field} data-testid="input-exercise-unit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weightFactor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>動作強度（重量係數）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="1.0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          data-testid="input-exercise-weight"
                        />
                      </FormControl>
                      <FormDescription>
                        計分用的強度指標（資料 × 強度）。力量項目：徒手動作 = 體重當量，不是公斤數，只要動作之間相對高低合理即可。預設為 1.0
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>主要分類（可選）</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-exercise-category">
                            <SelectValue placeholder="選擇分類" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" data-testid="category-option-none">無分類</SelectItem>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat} data-testid={`category-option-${cat}`}>
                              {displayLabel(cat)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch("category") === "力量" && (
                  <FormField
                    control={form.control}
                    name="movementCoefficient"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>動作係數</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="1.0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                            data-testid="input-exercise-movement-coefficient"
                          />
                        </FormControl>
                        <FormDescription>
                          複合動作1.2 / 單關節0.8 / 自體重1.0
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {form.watch("category") === "有氧" && (
                  <FormField
                    control={form.control}
                    name="intensityFactor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>強度型態</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseFloat(v))}
                          value={String(field.value ?? 1)}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-exercise-intensity-factor">
                              <SelectValue placeholder="選擇強度型態" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INTENSITY_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={String(opt.value)} data-testid={`intensity-option-${opt.value}`}>
                                {opt.label} ({opt.value})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          有氧評分 = 分鐘 x 組數 x 強度係數
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="splitCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>次要分類（可選）</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-exercise-split-category">
                            <SelectValue placeholder="選擇次要分類" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" data-testid="split-category-option-none">無次要分類</SelectItem>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat} data-testid={`split-category-option-${cat}`}>
                              {displayLabel(cat)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        混合運動可設定次要分類（如"跑步機負重"可同時算有氧和力量）
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch("splitCategory") !== "none" && (
                  <FormField
                    control={form.control}
                    name="splitRatio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>次要分類分配比例</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            placeholder="0.5"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-exercise-split-ratio"
                          />
                        </FormControl>
                        <FormDescription>
                          分配給次要分類的比例（0-1），如0.5表示50%分給次要分類，50%分給主要分類
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="space-y-3">
                  <FormLabel>肌群百分比（可選）</FormLabel>
                  <FormDescription className="text-xs">
                    設定各肌群訓練佔比（0-100%），總和可超過100%
                  </FormDescription>
                  <div className="grid grid-cols-4 gap-2">
                    {muscleGroupLabels.map(({ field: fieldName, name }) => (
                      <FormField
                        key={fieldName}
                        control={form.control}
                        name={fieldName}
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs">{name}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="0"
                                className="h-8 text-sm"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                data-testid={`input-muscle-${fieldName}`}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-exercise">
                    {createMutation.isPending ? "建立中..." : "建立"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
              <SelectValue placeholder="選擇分類" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="category-all">全部</SelectItem>
              <SelectItem value="uncategorized" data-testid="category-uncategorized">未分類</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} data-testid={`category-${cat}`}>
                  {displayLabel(cat)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            共 {filteredExercises.length} 項運動
          </span>
        </div>
      </div>

      <IntensityOverview exercises={exercises} />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredExercises.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredExercises.map((exercise) => (
            <Card key={exercise.id} data-testid={`card-exercise-${exercise.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                      <Dumbbell className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{displayLabel(exercise.name)}</CardTitle>
                      <CardDescription>單位: {exercise.unit}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setHistoryExercise(exercise)}
                      aria-label="歷史軌跡"
                      data-testid={`button-history-${exercise.id}`}
                    >
                      <LineChart className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(exercise)}
                      data-testid={`button-edit-${exercise.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingExercise(exercise)}
                      data-testid={`button-delete-${exercise.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{exercise.category === '力量' ? '動作強度' : '重量係數'}</span>
                    <Badge variant="secondary" data-testid={`badge-weight-${exercise.id}`}>
                      {exercise.category === '力量' ? exercise.weightFactor : `× ${exercise.weightFactor}`}
                    </Badge>
                  </div>
                  {exercise.category && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">分類</span>
                      <Badge variant="outline" data-testid={`badge-category-${exercise.id}`}>
                        {displayLabel(exercise.category ?? "")}
                      </Badge>
                    </div>
                  )}
                  {exercise.category === '力量' && exercise.movementCoefficient != null && exercise.movementCoefficient !== 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">動作係數</span>
                      <Badge variant="secondary" data-testid={`badge-movement-${exercise.id}`}>
                        {exercise.movementCoefficient}
                      </Badge>
                    </div>
                  )}
                  {exercise.category === '有氧' && exercise.intensityFactor != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">強度型態</span>
                      <Badge variant="secondary" data-testid={`badge-intensity-${exercise.id}`}>
                        {getIntensityLabel(exercise.intensityFactor)} ({exercise.intensityFactor})
                      </Badge>
                    </div>
                  )}
                  {(() => {
                    const muscles = muscleGroupLabels
                      .filter(({ field }) => (exercise[field] as number) > 0)
                      .map(({ field, name }) => `${name}${exercise[field]}%`);
                    if (muscles.length === 0) return null;
                    return (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">肌群</span>
                        <div className="flex flex-wrap gap-1 justify-end" data-testid={`badges-muscle-${exercise.id}`}>
                          {muscles.map((m, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground mt-2">
                    {exercise.category === '力量' 
                      ? `評分 = ${exercise.weightFactor} x 次數 x 組數 x ${exercise.movementCoefficient ?? 1} / 10`
                      : exercise.category === '有氧'
                      ? `評分 = 分鐘 x 組數 x ${exercise.intensityFactor ?? 1} (${getIntensityLabel(exercise.intensityFactor ?? 1)})`
                      : exercise.category === '活动量'
                      ? `評分 = ln(1+步數/1000) x 5`
                      : `評分 = 資料 x ${exercise.weightFactor}`
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              還沒有運動類型，點選"建立運動"開始新增
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingExercise} onOpenChange={(open) => !open && setEditingExercise(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯運動類型</DialogTitle>
            <DialogDescription>修改運動的名稱、單位或動作強度</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>運動名稱</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>單位</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-unit" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="weightFactor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>動作強度（重量係數）</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        data-testid="input-edit-weight"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>主要分類（可選）</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-category">
                          <SelectValue placeholder="選擇分類" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none" data-testid="edit-category-option-none">無分類</SelectItem>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} data-testid={`edit-category-option-${cat}`}>
                            {displayLabel(cat)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {editForm.watch("category") === "力量" && (
                <FormField
                  control={editForm.control}
                  name="movementCoefficient"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>動作係數</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="1.0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                          data-testid="input-edit-movement-coefficient"
                        />
                      </FormControl>
                      <FormDescription>
                        複合動作1.2 / 單關節0.8 / 自體重1.0
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {editForm.watch("category") === "有氧" && (
                <FormField
                  control={editForm.control}
                  name="intensityFactor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>強度型態</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(parseFloat(v))}
                        value={String(field.value ?? 1)}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-intensity-factor">
                            <SelectValue placeholder="選擇強度型態" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INTENSITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={String(opt.value)} data-testid={`edit-intensity-option-${opt.value}`}>
                              {opt.label} ({opt.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        有氧評分 = 分鐘 x 組數 x 強度係數
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={editForm.control}
                name="splitCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>次要分類（可選）</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-split-category">
                          <SelectValue placeholder="選擇次要分類" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none" data-testid="edit-split-category-option-none">無次要分類</SelectItem>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} data-testid={`edit-split-category-option-${cat}`}>
                            {displayLabel(cat)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      混合運動可設定次要分類（如"跑步機負重"可同時算有氧和力量）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {editForm.watch("splitCategory") !== "none" && (
                <FormField
                  control={editForm.control}
                  name="splitRatio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>次要分類分配比例</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          data-testid="input-edit-split-ratio"
                        />
                      </FormControl>
                      <FormDescription>
                        分配給次要分類的比例（0-1），如0.5表示50%分給次要分類，50%分給主要分類
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="space-y-3">
                <FormLabel>肌群百分比（可選）</FormLabel>
                <FormDescription className="text-xs">
                  設定各肌群訓練佔比（0-100%），總和可超過100%
                </FormDescription>
                <div className="grid grid-cols-4 gap-2">
                  {muscleGroupLabels.map(({ field: fieldName, name }) => (
                    <FormField
                      key={fieldName}
                      control={editForm.control}
                      name={fieldName}
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs">{name}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="0"
                              className="h-8 text-sm"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              data-testid={`input-edit-muscle-${fieldName}`}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingExercise(null)}
                  data-testid="button-cancel-edit"
                >
                  取消
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                  {updateMutation.isPending ? "儲存中..." : "儲存"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingExercise} onOpenChange={(open) => !open && setDeletingExercise(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>確定要刪除"{deletingExercise?.name}"嗎？</p>
              {deletingEntryCount > 0 && (
                <p className="text-destructive font-medium">
                  此運動項目有 {deletingEntryCount} 條歷史記錄，刪除後將一併清除且無法恢復！
                </p>
              )}
              <p className="text-muted-foreground text-sm border-t pt-2">
                提示：如果只是想修改名稱，請使用"編輯"功能，這樣可以保留所有歷史記錄和統計資料。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingExercise && deleteMutation.mutate(deletingExercise.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? "刪除中..." : deletingEntryCount > 0 ? `刪除及 ${deletingEntryCount} 筆記錄` : "刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ExerciseHistoryDialog exercise={historyExercise} onClose={() => setHistoryExercise(null)} />
    </div>
  );
}
