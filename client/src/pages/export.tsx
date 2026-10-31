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
        title: "無資料可匯出",
        description: "請先新增運動記錄",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const csvHeaders = [
        "運動名稱",
        "單位",
        "重量係數",
        "資料值",
        "日期",
        "備註",
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
        title: "匯出成功",
        description: `已匯出 ${entries.length} 條記錄`,
      });
    } catch (error) {
      toast({
        title: "匯出失敗",
        description: "匯出過程中發生錯誤",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-export">
      <div>
        <h1 className="text-3xl font-bold">資料匯出</h1>
        <p className="text-muted-foreground mt-2">匯出您的運動資料為CSV檔案</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>匯出運動資料</CardTitle>
          <CardDescription>
            將所有運動記錄匯出為CSV檔案，便於備份和跨平臺使用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-6 bg-muted rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <FileDown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">準備匯出</p>
                <p className="text-sm text-muted-foreground">
                  {entries ? `共 ${entries.length} 條記錄` : "載入中..."}
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
              {isExporting ? "匯出中..." : "匯出CSV"}
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium">匯出內容包括：</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-3" />
                運動名稱和單位資訊
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-3" />
                重量轉換系數
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-3" />
                所有運動資料值和日期
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-chart-3" />
                備註資訊
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>使用說明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. 點選"匯出CSV"按鈕下載資料檔案</p>
          <p>2. 匯出的檔案包含所有運動記錄和相關資訊</p>
          <p>3. CSV檔案可以在Excel、Google Sheets等軟體中開啟</p>
          <p>4. 您可以使用此檔案在其他裝置上匯入資料</p>
          <p>5. 建議定期匯出資料以備份您的健身記錄</p>
        </CardContent>
      </Card>
    </div>
  );
}
