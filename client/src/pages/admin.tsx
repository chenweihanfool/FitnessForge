import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Shield, Trash2, UserPlus, Users } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

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

  const { data: whitelist = [], isLoading: listLoading } = useQuery<WhitelistEntry[]>({
    queryKey: ["/api/admin/whitelist"],
    enabled: isAdmin,
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
          <CardDescription>輸入 Replit 用戶名即可授予存取權限</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Replit 用戶名"
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
    </div>
  );
}
