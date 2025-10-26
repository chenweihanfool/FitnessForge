import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Plus, Activity, Trash2, Calendar } from "lucide-react";
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
import { getTaipeiTime } from "@/lib/timezone";

export default function Entries() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<WorkoutEntryWithExercise | null>(null);
  const { toast } = useToast();

  const { data: exercises } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
  });

  const { data: entries, isLoading } = useQuery<WorkoutEntryWithExercise[]>({
    queryKey: ["/api/entries"],
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertWorkoutEntry) => apiRequest("POST", "/api/entries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/trends"] });
      setIsCreateOpen(false);
      form.reset();
      toast({
        title: "成功",
        description: "运动记录已添加",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/entries/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/trends"] });
      setDeletingEntry(null);
      toast({
        title: "成功",
        description: "运动记录已删除",
      });
    },
  });

  const form = useForm<InsertWorkoutEntry>({
    resolver: zodResolver(insertWorkoutEntrySchema),
    defaultValues: {
      exerciseId: "",
      value: 0,
      date: getTaipeiTime(),
      notes: "",
    },
  });

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

  const calculateBaselineValue = (value: number, exerciseId: string) => {
    const exercise = exercises?.find((e) => e.id === exerciseId);
    if (!exercise) return 0;
    return value * exercise.weightFactor;
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
          <DialogContent>
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
                    
                    return (
                      <FormItem>
                        <FormLabel>运动类型</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                        {field.value && weeklyAverage !== null && weeklyAverage !== undefined && (
                          <FormDescription className="text-primary font-medium">
                            历史周平均: {isAverageSteps ? `${(weeklyAverage / 7).toFixed(0)} 步/天 (${weeklyAverage.toFixed(0)} 步/周)` : `${weeklyAverage.toFixed(1)} ${selectedExercise?.unit || ''}`}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => {
                    const selectedExercise = exercises?.find((e) => e.id === form.watch("exerciseId"));
                    const isAverageSteps = selectedExercise?.name === '每周平均步数';
                    
                    return (
                      <FormItem>
                        <FormLabel>
                          {isAverageSteps ? '每日平均步数' : '数据值'}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder={isAverageSteps ? "输入每日平均步数" : "输入数据值"}
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-entry-value"
                          />
                        </FormControl>
                        {field.value > 0 && form.watch("exerciseId") && (
                          <FormDescription>
                            {isAverageSteps ? (
                              <>
                                每周总步数: {(field.value * 7).toFixed(0)} 步 | 
                                基准值: {calculateBaselineValue(field.value * 7, form.watch("exerciseId")).toFixed(2)}
                              </>
                            ) : (
                              <>
                                基准值: {calculateBaselineValue(field.value, form.watch("exerciseId")).toFixed(2)}
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
                  <TableHead>基准值</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const baselineValue = entry.value * entry.exercise.weightFactor;
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
                      <TableCell>
                        <Badge variant="secondary" data-testid={`badge-baseline-${entry.id}`}>
                          {baselineValue.toFixed(2)}
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
