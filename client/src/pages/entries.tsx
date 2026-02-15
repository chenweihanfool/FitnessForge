import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch, useRoute } from "wouter";
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
import { Plus, Activity, Trash2, Calendar, Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

export default function Entries() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkoutEntryWithExercise | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<WorkoutEntryWithExercise | null>(null);
  const { toast } = useToast();

  const { data: exercises } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/weekly-progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/current-week-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/category-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/career-overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/muscle-group-weekly"] });
      setIsCreateOpen(false);
      form.reset();
      toast({
        title: "成功",
        description: "运动记录已添加",
      });
      setLocation("/");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/entries/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/weekly-progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/current-week-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/category-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/muscle-group-weekly"] });
      setDeletingEntry(null);
      toast({
        title: "成功",
        description: "运动记录已删除",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; entry: InsertWorkoutEntry }) => 
      apiRequest("PATCH", `/api/entries/${data.id}`, data.entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/weekly-progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/current-week-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/category-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/muscle-group-weekly"] });
      setIsEditOpen(false);
      setEditingEntry(null);
      editForm.reset();
      toast({
        title: "成功",
        description: "运动记录已更新",
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

  // 处理从dashboard点击运动卡片跳转过来的情况
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const addExerciseId = params.get('addExercise');
    
    if (addExerciseId && exercises) {
      // 验证该运动类型存在
      const exerciseExists = exercises.some(e => e.id === addExerciseId);
      if (exerciseExists) {
        form.setValue('exerciseId', addExerciseId);
        setIsCreateOpen(true);
        // 清除URL参数，避免刷新页面时重复触发
        setLocation('/entries', { replace: true });
      }
    }
  }, [searchString, exercises, form, setLocation]);

  const selectedExerciseId = form.watch("exerciseId");
  
  const { data: weeklyAverageData } = useQuery<{ average: number | null }>({
    queryKey: selectedExerciseId ? [`/api/stats/exercise-average/${selectedExerciseId}`] : [],
    enabled: !!selectedExerciseId,
  });

  const onSubmit = (data: InsertWorkoutEntry) => {
    // 用户输入的时间是台北时间（UTC+8）
    // 需要转换为UTC时间发送给后端
    const submissionData = { ...data };
    
    // 检查是否是"每周平均步数"，如果是则自动乘以7
    const selectedExercise = exercises?.find((e) => e.id === data.exerciseId);
    if (selectedExercise?.name === '每周平均步数') {
      // 用户输入的是平均步数，需要乘以7得到每周总步数
      submissionData.value = data.value * 7;
    }
    
    if (submissionData.date) {
      // datetime-local返回的是不带时区的字符串，如"2025-10-26T18:00"
      // 我们将其视为UTC+8时间，需要转换为UTC
      // 方法：将字符串解析为UTC时间（通过添加Z），然后减去8小时
      const dateStr = submissionData.date + ':00.000Z'; // 添加秒和UTC标记
      const taipeiAsUtc = new Date(dateStr); // 现在这个时间会被当作UTC解析
      // 减去8小时得到真正的UTC时间
      const realUtc = new Date(taipeiAsUtc.getTime() - (8 * 60 * 60 * 1000));
      submissionData.date = realUtc.toISOString();
    }
    
    createMutation.mutate(submissionData);
  };

  const onEditSubmit = (data: InsertWorkoutEntry) => {
    if (!editingEntry) return;
    
    const submissionData = { ...data };
    
    // 检查是否是"每周平均步数"，如果是则自动乘以7
    const selectedExercise = exercises?.find((e) => e.id === data.exerciseId);
    if (selectedExercise?.name === '每周平均步数') {
      submissionData.value = data.value * 7;
    }
    
    if (submissionData.date) {
      const dateStr = submissionData.date + ':00.000Z';
      const taipeiAsUtc = new Date(dateStr);
      const realUtc = new Date(taipeiAsUtc.getTime() - (8 * 60 * 60 * 1000));
      submissionData.date = realUtc.toISOString();
    }
    
    updateMutation.mutate({ id: editingEntry.id, entry: submissionData });
  };

  const handleEditEntry = (entry: WorkoutEntryWithExercise) => {
    setEditingEntry(entry);
    // 预填充表单数据
    const taipeiDate = toTaipeiTime(entry.date);
    editForm.reset({
      exerciseId: entry.exerciseId,
      value: entry.exercise.name === '每周平均步数' ? entry.value / 7 : entry.value,
      date: taipeiDate,
      notes: entry.notes || "",
      sets: entry.sets ?? undefined,
      weightFactor: entry.weightFactor ?? entry.exercise.weightFactor,
    });
    setIsEditOpen(true);
  };

  const calculateBaselineValue = (value: number, exerciseId: string, customWeightFactor?: number, sets?: number) => {
    const exercise = exercises?.find((e) => e.id === exerciseId);
    if (!exercise) return 0;
    const weightFactor = customWeightFactor ?? exercise.weightFactor;
    const s = sets || 1;

    if (exercise.name === '每周平均步数' || exercise.category === '活动量') {
      if (value <= 0) return 0;
      const dailySteps = exercise.name === '每周平均步数' ? value / 7 : value;
      return (dailySteps / 500) * (1 - 0.00002 * dailySteps) * 7;
    }
    if (exercise.category === '有氧') {
      return value * s * (exercise.intensityFactor ?? 1);
    }
    if (exercise.category === '力量') {
      return weightFactor * value * s * (exercise.movementCoefficient ?? 1) / 10;
    }
    return value * s * weightFactor;
  };

  return (
    <div className="space-y-6" data-testid="page-entries">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">数据记录</h1>
          <p className="text-muted-foreground mt-2">记录您的运动数据</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-entry">
              <Plus className="mr-2 h-4 w-4" />
              添加记录
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加运动记录</DialogTitle>
              <DialogDescription>记录您的运动数据和相关信息</DialogDescription>
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
                        <FormLabel>运动类型</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          const exercise = exercises?.find((e) => e.id === value);
                          if (exercise) {
                            form.setValue("weightFactor", exercise.weightFactor);
                          }
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-exercise">
                              <SelectValue placeholder="选择运动类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {exercises?.map((exercise) => (
                              <SelectItem key={exercise.id} value={exercise.id} data-testid={`select-option-${exercise.id}`}>
                                {exercise.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.value && (currentWeekProgress || weeklyAverage !== null && weeklyAverage !== undefined) && (
                          <div className="space-y-1.5 mt-2 p-2 rounded-md bg-muted/50" data-testid="exercise-progress-info">
                            {currentWeekProgress && (
                              <FormDescription className="text-sm">
                                <span className="font-medium">本周进度: </span>
                                {isAverageSteps 
                                  ? `${(currentWeekProgress.currentWeekValue / 7).toFixed(0)} 步/天 (${currentWeekProgress.currentWeekValue.toFixed(0)} 步/周)`
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
                                <span className="font-medium">历史周平均: </span>
                                {isAverageSteps ? `${(weeklyAverage / 7).toFixed(0)} 步/天 (${weeklyAverage.toFixed(0)} 步/周)` : `${weeklyAverage.toFixed(1)} ${selectedExercise?.unit || ''}`}
                              </FormDescription>
                            )}
                          </div>
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
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>权重系数</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="输入权重系数"
                              {...field}
                              value={field.value ?? selectedExercise?.weightFactor ?? 1}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                              data-testid="input-entry-weight-factor"
                            />
                          </FormControl>
                          <FormDescription className="text-xs text-muted-foreground">
                            默认值: {selectedExercise?.weightFactor ?? 1}（可临时修改本次记录的权重）
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })()}
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => {
                    const selectedExercise = exercises?.find((e) => e.id === form.watch("exerciseId"));
                    const isAverageSteps = selectedExercise?.name === '每周平均步数';
                    const isCardio = selectedExercise?.category === '有氧';
                    const isJumpingJacks = selectedExercise?.name === '開合跳';
                    const currentWeightFactor = form.watch("weightFactor");
                    
                    const valueLabel = isAverageSteps 
                      ? '每日平均步数' 
                      : isJumpingJacks
                        ? '次数'
                        : isCardio 
                          ? '运动时间（分钟）' 
                          : '数据值';
                    const valuePlaceholder = isAverageSteps 
                      ? "输入每日平均步数" 
                      : isJumpingJacks
                        ? "输入次数"
                        : isCardio 
                          ? "输入运动分钟数" 
                          : "输入数据值";
                    
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
                            强度型态: {(() => {
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
                                每周总步数: {(field.value * 7).toFixed(0)} 步 | 
                                基准值: {calculateBaselineValue(field.value * 7, form.watch("exerciseId"), currentWeightFactor, form.watch("sets")).toFixed(2)}
                              </>
                            ) : (
                              <>
                                基准值: {calculateBaselineValue(field.value, form.watch("exerciseId"), currentWeightFactor, form.watch("sets")).toFixed(2)}
                              </>
                            )}
                          </FormDescription>
                        )}
                        {isAverageSteps && (
                          <FormDescription className="text-xs text-muted-foreground">
                            系统将自动乘以7计算每周总步数
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                {(() => {
                  const selectedExercise = exercises?.find((e) => e.id === form.watch("exerciseId"));
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
                  const showSets = hasMuscleGroup || selectedExercise?.category === "力量" || selectedExercise?.category === "有氧";
                  return showSets ? (
                    <FormField
                      control={form.control}
                      name="sets"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>组数（可选）</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              placeholder="输入组数"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              data-testid="input-entry-sets"
                            />
                          </FormControl>
                          <FormDescription>
                            记录本次训练的组数，用于追踪各肌群训练量
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
                      <FormLabel>日期时间（台北时间 UTC+8）</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          data-testid="input-entry-date"
                        />
                      </FormControl>
                      <FormDescription>
                        请输入台北时间，系统将自动转换为UTC存储
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
                      <FormLabel>备注（可选）</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="记录感受、进展等..."
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
                    {createMutation.isPending ? "保存中..." : "保存"}
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
            <CardTitle>运动记录列表</CardTitle>
            <CardDescription>共 {entries.length} 条记录</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>运动</TableHead>
                  <TableHead>数据值</TableHead>
                  <TableHead>组数</TableHead>
                  <TableHead>基准值</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>备注</TableHead>
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
                          {entry.exercise.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.value} {entry.exercise.unit}
                      </TableCell>
                      <TableCell data-testid={`sets-${entry.id}`}>
                        {entry.sets ? `${entry.sets} 组` : "-"}
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
              还没有运动记录，点击"添加记录"开始记录
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑运动记录</DialogTitle>
            <DialogDescription>修改运动数据和相关信息</DialogDescription>
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
                      <FormLabel>运动类型</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        const exercise = exercises?.find((e) => e.id === value);
                        if (exercise) {
                          editForm.setValue("weightFactor", exercise.weightFactor);
                        }
                      }} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-exercise">
                            <SelectValue placeholder="选择运动类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {exercises?.map((exercise) => (
                            <SelectItem key={exercise.id} value={exercise.id} data-testid={`select-option-${exercise.id}`}>
                              {exercise.name}
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
                        <FormLabel>权重系数</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="输入权重系数"
                            {...field}
                            value={field.value ?? selectedExercise?.weightFactor ?? 1}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                            data-testid="input-edit-weight-factor"
                          />
                        </FormControl>
                        <FormDescription className="text-xs text-muted-foreground">
                          默认值: {selectedExercise?.weightFactor ?? 1}（可临时修改本次记录的权重）
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
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
                    ? '每日平均步数' 
                    : isJumpingJacks
                      ? '次数'
                      : isCardio 
                        ? '运动时间（分钟）' 
                        : '数据值';
                  const valuePlaceholder = isAverageSteps 
                    ? "输入每日平均步数" 
                    : isJumpingJacks
                      ? "输入次数"
                      : isCardio 
                        ? "输入运动分钟数" 
                        : "输入数据值";
                  
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
                          强度型态: {(() => {
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
                              每周总步数: {(field.value * 7).toFixed(0)} 步 | 
                              基准值: {calculateBaselineValue(field.value * 7, editForm.watch("exerciseId"), currentWeightFactor, editForm.watch("sets")).toFixed(2)}
                            </>
                          ) : (
                            <>
                              基准值: {calculateBaselineValue(field.value, editForm.watch("exerciseId"), currentWeightFactor, editForm.watch("sets")).toFixed(2)}
                            </>
                          )}
                        </FormDescription>
                      )}
                      {isAverageSteps && (
                        <FormDescription className="text-xs text-muted-foreground">
                          系统将自动乘以7计算每周总步数
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
                const showSets = hasMuscleGroup || selectedExercise?.category === "力量" || selectedExercise?.category === "有氧";
                return showSets ? (
                  <FormField
                    control={editForm.control}
                    name="sets"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>组数（可选）</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            placeholder="输入组数"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            data-testid="input-entry-sets"
                          />
                        </FormControl>
                        <FormDescription>
                          记录本次训练的组数，用于追踪各肌群训练量
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
                    <FormLabel>日期时间（台北时间 UTC+8）</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-entry-date"
                      />
                    </FormControl>
                    <FormDescription>
                      请输入台北时间，系统将自动转换为UTC存储
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
                    <FormLabel>备注（可选）</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="记录感受、进展等..."
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
                  {updateMutation.isPending ? "保存中..." : "保存修改"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条运动记录吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-entry">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEntry && deleteMutation.mutate(deletingEntry.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-entry"
            >
              {deleteMutation.isPending ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
