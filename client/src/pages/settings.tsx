import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

type Settings = {
  strengthWeight: number;
  cardioWeight: number;
  activityWeight: number;
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [strengthWeight, setStrengthWeight] = useState(50);
  const [cardioWeight, setCardioWeight] = useState(30);
  const [activityWeight, setActivityWeight] = useState(20);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setStrengthWeight(settings.strengthWeight);
      setCardioWeight(settings.cardioWeight);
      setActivityWeight(settings.activityWeight);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Settings) => {
      const res = await apiRequest("POST", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "设置已保存", description: "权重比例已更新" });
    },
    onError: (error: Error) => {
      toast({ title: "保存失败", description: error.message, variant: "destructive" });
    },
  });

  const total = strengthWeight + cardioWeight + activityWeight;
  const isValid = Math.abs(total - 100) < 0.01;

  const handleSave = () => {
    if (!isValid) {
      toast({ title: "权重总和必须为100", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ strengthWeight, cardioWeight, activityWeight });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">设置</h1>
        <p className="text-muted-foreground">配置综合评分权重比例</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>综合评分权重</CardTitle>
          <CardDescription>
            调整力量、有氧、活动量在综合评分中的占比。三项权重总和必须为100。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="strength-weight">力量权重 (%)</Label>
            <Input
              id="strength-weight"
              type="number"
              min="0"
              max="100"
              step="1"
              value={strengthWeight}
              onChange={(e) => setStrengthWeight(Number(e.target.value))}
              data-testid="input-strength-weight"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cardio-weight">有氧权重 (%)</Label>
            <Input
              id="cardio-weight"
              type="number"
              min="0"
              max="100"
              step="1"
              value={cardioWeight}
              onChange={(e) => setCardioWeight(Number(e.target.value))}
              data-testid="input-cardio-weight"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-weight">活动量权重 (%)</Label>
            <Input
              id="activity-weight"
              type="number"
              min="0"
              max="100"
              step="1"
              value={activityWeight}
              onChange={(e) => setActivityWeight(Number(e.target.value))}
              data-testid="input-activity-weight"
            />
          </div>
          <div className="flex items-center justify-between gap-4 pt-2">
            <p className={`text-sm ${isValid ? "text-muted-foreground" : "text-destructive font-medium"}`} data-testid="text-weight-total">
              总计: {total}%{!isValid && " (必须为100%)"}
            </p>
            <Button
              onClick={handleSave}
              disabled={!isValid || saveMutation.isPending}
              data-testid="button-save-settings"
            >
              {saveMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>评分公式说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">力量评分</p>
            <p>重量系数 x 次数 x 组数 x 动作系数 / 10</p>
          </div>
          <div>
            <p className="font-medium text-foreground">有氧评分</p>
            <p>分钟数 x 组数 x 强度系数</p>
          </div>
          <div>
            <p className="font-medium text-foreground">活动量评分</p>
            <p>ln(1 + 步数/1000) x 5（递减收益）</p>
          </div>
          <div>
            <p className="font-medium text-foreground">综合评分</p>
            <p>力量分 x {strengthWeight}% + 有氧分 x {cardioWeight}% + 活动量分 x {activityWeight}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
