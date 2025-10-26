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

const CATEGORIES = ["力量", "有氧", "柔韧性", "核心", "平衡", "其他"];

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
      setDeletingExercise(null);
      toast({
        title: "成功",
        description: "运动类型已删除",
      });
    },
  });

  const form = useForm<InsertExercise>({
    resolver: zodResolver(insertExerciseSchema),
    defaultValues: {
      name: "",
      unit: "",
      weightFactor: 1,
      category: "",
    },
  });

  const editForm = useForm<InsertExercise>({
    resolver: zodResolver(insertExerciseSchema),
    defaultValues: {
      name: "",
      unit: "",
      weightFactor: 1,
      category: "",
    },
  });

  const onCreateSubmit = (data: InsertExercise) => {
    createMutation.mutate(data);
  };

  const onUpdateSubmit = (data: InsertExercise) => {
    if (editingExercise) {
      updateMutation.mutate({ id: editingExercise.id, data });
    }
  };

  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise);
    editForm.reset({
      name: exercise.name,
      unit: exercise.unit,
      weightFactor: exercise.weightFactor,
      category: exercise.category || "",
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
                          step="0.1"
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
      ) : exercises && exercises.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exercises.map((exercise) => (
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">重量系数</span>
                  <Badge variant="secondary" data-testid={`badge-weight-${exercise.id}`}>
                    × {exercise.weightFactor}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  基准值 = 数据 × {exercise.weightFactor}
                </p>
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
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        data-testid="input-edit-weight"
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
