import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileDown, CheckCircle } from "lucide-react";
import { WorkoutEntryWithExercise } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ExportPage() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const { data: entries } = useQuery<WorkoutEntryWithExercise[]>({
    queryKey: ["/api/entries"],
  });

  const handleExport = async () => {
    if (!entries || entries.length === 0) {
      toast({
        title: "无数据可导出",
        description: "请先添加运动记录",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const csvHeaders = [
        "运动名称",
        "单位",
        "重量系数",
        "数据值",
        "日期",
        "备注",
      ];

      const csvRows = entries.map((entry) => [
        entry.exercise.name,
        entry.exercise.unit,
        entry.exercise.weightFactor.toString(),
        entry.value.toString(),
        format(new Date(entry.date), "yyyy-MM-dd HH:mm"),
        entry.notes || "",
      ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row) =>
          row.map((cell) => `"${cell}"`).join(",")
        ),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `fitness-data-${format(new Date(), "yyyy-MM-dd")}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "导出成功",
        description: `已导出 ${entries.length} 条记录`,
      });
    } catch (error) {
      toast({
        title: "导出失败",
        description: "导出过程中发生错误",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-export">
      <div>
        <h1 className="text-3xl font-bold">数据导出</h1>
        <p className="text-muted-foreground mt-2">导出您的运动数据为CSV文件</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>导出运动数据</CardTitle>
          <CardDescription>
            将所有运动记录导出为CSV文件，便于备份和跨平台使用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-6 bg-muted rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <FileDown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">准备导出</p>
                <p className="text-sm text-muted-foreground">
                  {entries ? `共 ${entries.length} 条记录` : "加载中..."}
                </p>
              </div>
            </div>
            <Button
              onClick={handleExport}
              disabled={isExporting || !entries || entries.length === 0}
              size="lg"
              data-testid="button-export"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "导出中..." : "导出CSV"}
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">导出内容包括：</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-3" />
                运动名称和单位信息
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-3" />
                重量转换系数
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-3" />
                所有运动数据值和日期
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-3" />
                备注信息
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. 点击"导出CSV"按钮下载数据文件</p>
          <p>2. 导出的文件包含所有运动记录和相关信息</p>
          <p>3. CSV文件可以在Excel、Google Sheets等软件中打开</p>
          <p>4. 您可以使用此文件在其他设备上导入数据</p>
          <p>5. 建议定期导出数据以备份您的健身记录</p>
        </CardContent>
      </Card>
    </div>
  );
}
