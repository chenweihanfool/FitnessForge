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
import { Plus, Dumbbell, Trash2, Pencil, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const CATEGORIES = ["力量", "有氧", "柔韧性", "核心", "平衡", "活动量", "其他"];
const MUSCLE_GROUPS = ["胸", "背", "腿", "肩", "二头肌", "核心", "臀", "三头肌"];

export default function Exercises() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [deletingExercise, setDeletingExercise] = useState<Exercise | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { toast } = useToast();

  const { data: exercises, isLoading } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertExercise) => apiRequest("POST", "/api/exercises", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/muscle-group-weekly"] });
      setIsCreateOpen(false);
      toast({
        title: "成功",
        description: "运动类型已创建",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsertExercise }) =>
      apiRequest("PATCH", `/api/exercises/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/muscle-group-weekly"] });
      setEditingExercise(null);
      toast({
        title: "成功",
        description: "运动类型已更新",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/exercises/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/muscle-group-weekly"] });
      setDeletingExercise(null);
      toast({
        title: "成功",
        description: "运动类型已删除",
      });
    },
  });

  const muscleGroupLabels = [
    { field: 'muscleChest' as const, name: '胸' },
    { field: 'muscleBack' as const, name: '背' },
    { field: 'muscleLegs' as const, name: '腿' },
    { field: 'muscleShoulders' as const, name: '肩' },
    { field: 'muscleArms' as const, name: '二头肌' },
    { field: 'muscleCore' as const, name: '核心' },
    { field: 'muscleGlutes' as const, name: '臀' },
    { field: 'muscleFullBody' as const, name: '三头肌' },
  ];

  const form = useForm<InsertExercise>({
    resolver: zodResolver(insertExerciseSchema),
    defaultValues: {
      name: "",
      unit: "",
      weightFactor: 1,
      category: "none",
      splitCategory: "none",
      splitRatio: 0,
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

  // 筛选运动列表
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
            <h1 className="text-3xl font-bold">运动管理</h1>
            <p className="text-muted-foreground mt-2">管理您的运动类型和转换系数</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-exercise">
              <Plus className="mr-2 h-4 w-4" />
              创建运动
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建运动类型</DialogTitle>
              <DialogDescription>
                添加新的运动类型，设置单位和重量转换系数
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>运动名称</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：俯卧撑、深蹲" {...field} data-testid="input-exercise-name" />
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
                      <FormLabel>单位</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：次、公斤、分钟" {...field} data-testid="input-exercise-unit" />
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
                      <FormLabel>重量系数</FormLabel>
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
                        用于计算基准值（数据 × 系数）。默认为 1.0
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
                      <FormLabel>主要分类（可选）</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-exercise-category">
                            <SelectValue placeholder="选择分类" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" data-testid="category-option-none">无分类</SelectItem>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat} data-testid={`category-option-${cat}`}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="splitCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>次要分类（可选）</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-exercise-split-category">
                            <SelectValue placeholder="选择次要分类" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" data-testid="split-category-option-none">无次要分类</SelectItem>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat} data-testid={`split-category-option-${cat}`}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        混合运动可设置次要分类（如"跑步機負重"可同时算有氧和力量）
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
                        <FormLabel>次要分类分配比例</FormLabel>
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
                          分配给次要分类的比例（0-1），如0.5表示50%分给次要分类，50%分给主要分类
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="space-y-3">
                  <FormLabel>肌群百分比（可选）</FormLabel>
                  <FormDescription className="text-xs">
                    设置各肌群训练占比（0-100%），总和可超过100%
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
                    {createMutation.isPending ? "创建中..." : "创建"}
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
              <SelectValue placeholder="选择分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="category-all">全部</SelectItem>
              <SelectItem value="uncategorized" data-testid="category-uncategorized">未分类</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} data-testid={`category-${cat}`}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            共 {filteredExercises.length} 项运动
          </span>
        </div>
      </div>

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
                      <CardTitle className="text-lg">{exercise.name}</CardTitle>
                      <CardDescription>单位: {exercise.unit}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
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
                    <span className="text-sm text-muted-foreground">重量系数</span>
                    <Badge variant="secondary" data-testid={`badge-weight-${exercise.id}`}>
                      × {exercise.weightFactor}
                    </Badge>
                  </div>
                  {exercise.category && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">分类</span>
                      <Badge variant="outline" data-testid={`badge-category-${exercise.id}`}>
                        {exercise.category}
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
                    基准值 = 数据 × {exercise.weightFactor}
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
              还没有运动类型，点击"创建运动"开始添加
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingExercise} onOpenChange={(open) => !open && setEditingExercise(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑运动类型</DialogTitle>
            <DialogDescription>修改运动的名称、单位或重量系数</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>运动名称</FormLabel>
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
                    <FormLabel>单位</FormLabel>
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
                    <FormLabel>重量系数</FormLabel>
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
                    <FormLabel>主要分类（可选）</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-category">
                          <SelectValue placeholder="选择分类" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none" data-testid="edit-category-option-none">无分类</SelectItem>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} data-testid={`edit-category-option-${cat}`}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="splitCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>次要分类（可选）</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-split-category">
                          <SelectValue placeholder="选择次要分类" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none" data-testid="edit-split-category-option-none">无次要分类</SelectItem>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} data-testid={`edit-split-category-option-${cat}`}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      混合运动可设置次要分类（如"跑步機負重"可同时算有氧和力量）
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
                      <FormLabel>次要分类分配比例</FormLabel>
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
                        分配给次要分类的比例（0-1），如0.5表示50%分给次要分类，50%分给主要分类
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="space-y-3">
                <FormLabel>肌群百分比（可选）</FormLabel>
                <FormDescription className="text-xs">
                  设置各肌群训练占比（0-100%），总和可超过100%
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
                  {updateMutation.isPending ? "保存中..." : "保存"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingExercise} onOpenChange={(open) => !open && setDeletingExercise(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除"{deletingExercise?.name}"吗？这将同时删除所有相关的运动记录，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingExercise && deleteMutation.mutate(deletingExercise.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
