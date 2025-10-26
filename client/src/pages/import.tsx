import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/trends"] });
      setFile(null);
      toast({
        title: "导入成功",
        description: `已导入 ${data.exercisesCount} 个运动类型和 ${data.entriesCount} 条记录`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "导入失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    importMutation.mutate(formData);
  };

  return (
    <div className="space-y-6" data-testid="page-import">
      <div>
        <h1 className="text-3xl font-bold">数据导入</h1>
        <p className="text-muted-foreground mt-2">从CSV文件导入运动数据</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>CSV格式说明</AlertTitle>
        <AlertDescription>
          CSV文件应包含以下列：运动名称、单位、重量系数、数据值、日期（YYYY-MM-DD HH:mm）、备注
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>上传CSV文件</CardTitle>
          <CardDescription>支持拖放或点击选择文件</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              accept=".csv"
              onChange={handleChange}
              className="hidden"
              data-testid="input-file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FileUp className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm font-medium">
                {file ? file.name : "拖放CSV文件到这里，或点击选择"}
              </p>
              <p className="text-xs text-muted-foreground">
                支持 .csv 文件格式
              </p>
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-chart-3" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFile(null)}
                data-testid="button-remove-file"
              >
                移除
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              onClick={handleImport}
              disabled={!file || importMutation.isPending}
              data-testid="button-import"
            >
              <Upload className="mr-2 h-4 w-4" />
              {importMutation.isPending ? "导入中..." : "开始导入"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>导入说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. CSV文件第一行应为列标题</p>
          <p>2. 运动名称和单位将自动创建（如果不存在）</p>
          <p>3. 重量系数必须是数字，默认为1.0</p>
          <p>4. 日期格式：YYYY-MM-DD HH:mm（例如：2024-01-15 14:30）</p>
          <p>5. 备注列可以为空</p>
        </CardContent>
      </Card>
    </div>
  );
}
