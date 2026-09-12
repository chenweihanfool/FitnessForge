import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Shield, Trash2, UserPlus, Users, Download, Upload, RefreshCw, Dumbbell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Exercise } from "@shared/schema";

type WhitelistEntry = {
  username: string;
  addedBy: string;
  addedAt: string;
  note: string | null;
};

export default function AdminPage() {
  const { isAdmin, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newUsername, setNewUsername] = useState("");
  const [newNote, setNewNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: whitelist = [], isLoading: listLoading } = useQuery<WhitelistEntry[]>({
    queryKey: ["/api/admin/whitelist"],
    enabled: isAdmin,
  });

  const { data: exercises = [] } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
    enabled: isAdmin,
  });

  const handleExportExercises = () => {
    const blob = new Blob([JSON.stringify(exercises, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `exercises-${new Date().toISOString().slice(0, 10)}.json`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importMutation = useMutation({
    mutationFn: async (payload: unknown[]) => {
      const res = await apiRequest("POST", "/api/admin/exercises/import", { exercises: payload });
      return res.json() as Promise<{ created: number; updated: number; errors: string[] }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      toast({
        title: "匯入完成",
        description: `新建 ${result.created} 個、更新 ${result.updated} 個${
          result.errors.length > 0 ? `，${result.errors.length} 筆失敗：${result.errors.join("；")}` : ""
        }`,
        variant: result.errors.length > 0 ? "destructive" : undefined,
      });
    },
    onError: () => toast({ title: "匯入失敗", description: "請確認 JSON 格式正確", variant: "destructive" }),
  });

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允許連續選同一個檔案觸發 onChange
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : parsed?.exercises;
      if (!Array.isArray(items)) {
        toast({ title: "匯入失敗", description: "JSON 需要是運動項目陣列，或 { exercises: [...] } 物件", variant: "destructive" });
        return;
      }
      importMutation.mutate(items);
    } catch {
      toast({ title: "匯入失敗", description: "檔案不是合法的 JSON", variant: "destructive" });
    }
  };

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/recalculate-baselines");
      return res.json() as Promise<{ updatedEntries: number; updatedWeeks: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/ranking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/weekly-progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/current-week-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/category-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/muscle-group-weekly"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plan/progress"] });
      toast({
        title: "重新計算完成",
        description: `已更新 ${result.updatedEntries} 筆記錄、${result.updatedWeeks} 個週的肌群統計`,
      });
    },
    onError: () => toast({ title: "重新計算失敗", variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: (data: { username: string; note?: string }) =>
      apiRequest("POST", "/api/admin/whitelist", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whitelist"] });
      setNewUsername("");
      setNewNote("");
      toast({ title: "已新增白名單" });
    },
    onError: () => toast({ title: "新增失敗", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (username: string) =>
      apiRequest("DELETE", `/api/admin/whitelist/${encodeURIComponent(username)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whitelist"] });
      toast({ title: "已移除白名單" });
    },
    onError: () => toast({ title: "移除失敗", variant: "destructive" }),
  });

  if (isLoading) return null;

  if (!isAdmin) {
    setLocation("/");
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7" />
          管理員後台
        </h1>
        <p className="text-muted-foreground mt-2">管理可存取系統的用戶白名單</p>
      </div>

      {/* Add user */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            新增白名單
          </CardTitle>
          <CardDescription>輸入 Google 帳號 Email 即可授予存取權限</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Google 帳號 Email"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="flex-1"
              onKeyDown={e => {
                if (e.key === "Enter" && newUsername.trim()) {
                  addMutation.mutate({ username: newUsername.trim(), note: newNote.trim() || undefined });
                }
              }}
            />
            <Input
              placeholder="備註（可選）"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              className="flex-1 sm:max-w-[200px]"
            />
            <Button
              onClick={() => {
                if (newUsername.trim()) {
                  addMutation.mutate({ username: newUsername.trim(), note: newNote.trim() || undefined });
                }
              }}
              disabled={addMutation.isPending || !newUsername.trim()}
            >
              新增
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Whitelist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            白名單用戶
            <Badge variant="secondary">{whitelist.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <p className="text-sm text-muted-foreground">載入中…</p>
          ) : whitelist.length === 0 ? (
            <p className="text-sm text-muted-foreground">白名單為空，管理員本身可直接存取。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用戶名</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead>新增者</TableHead>
                  <TableHead>新增時間</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {whitelist.map(entry => (
                  <TableRow key={entry.username}>
                    <TableCell className="font-mono font-semibold">{entry.username}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{entry.note ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{entry.addedBy}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(entry.addedAt).toLocaleDateString("zh-TW")}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeMutation.mutate(entry.username)}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 運動項目參數：JSON 匯出/匯入 + 全歷史重新計算 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="h-4 w-4" />
            運動項目參數（JSON）
            <Badge variant="secondary">{exercises.length}</Badge>
          </CardTitle>
          <CardDescription>
            匯出全部運動項目的完整參數（重量係數、動作係數、強度因子、肌群分配）備份或批次調整，
            調整完再整份匯入覆蓋——匯入只會更新運動項目本身，不會自動套用到歷史記錄，
            需要的話請在匯入後另外按「重新計算歷史基準值」。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportExercises} disabled={exercises.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              匯出 JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importMutation.isPending ? "匯入中…" : "匯入 JSON"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={recalcMutation.isPending}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {recalcMutation.isPending ? "計算中…" : "重新計算歷史基準值"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>重新計算所有歷史記錄的基準值？</AlertDialogTitle>
                  <AlertDialogDescription>
                    會用目前運動項目的參數（重量係數、動作係數、強度因子）重新計算「每一筆」歷史運動記錄的基準值並覆蓋寫回，
                    連帶更新受影響週的肌群統計。這個動作沒有復原功能，請確認運動項目參數已經調整成你要的樣子再執行。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => recalcMutation.mutate()}>
                    確定重新計算
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
