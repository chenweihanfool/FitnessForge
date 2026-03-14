import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, RotateCcw } from "lucide-react";

const DEFAULT_PLAN_CUSTOM_RULES = `週一到週四是上班日，強度保持中低：安排較短或較輕的訓練（有氧、核心），週一到週四中可有 1-2 天休息，但不要全部跳過。週五到週日是假日，可安排較高容量與較重的力量訓練，但不要把所有項目都集中在這三天。整體強度應自然地朝週末逐漸提升。`;

type Settings = {
  strengthWeight: number;
  cardioWeight: number;
  activityWeight: number;
  planCustomRules: string;
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [strengthWeight, setStrengthWeight] = useState(50);
  const [cardioWeight, setCardioWeight] = useState(30);
  const [activityWeight, setActivityWeight] = useState(20);
  const [planCustomRules, setPlanCustomRules] = useState(DEFAULT_PLAN_CUSTOM_RULES);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setStrengthWeight(settings.strengthWeight);
      setCardioWeight(settings.cardioWeight);
      setActivityWeight(settings.activityWeight);
      setPlanCustomRules(settings.planCustomRules ?? DEFAULT_PLAN_CUSTOM_RULES);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Pick<Settings, 'strengthWeight' | 'cardioWeight' | 'activityWeight'>) => {
      const res = await apiRequest("POST", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "設置已保存", description: "權重比例已更新" });
    },
    onError: (error: Error) => {
      toast({ title: "保存失敗", description: error.message, variant: "destructive" });
    },
  });

  const savePlanRulesMutation = useMutation({
    mutationFn: async (rules: string) => {
      const res = await apiRequest("POST", "/api/settings/plan-rules", { planCustomRules: rules });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "已保存", description: "訓練計畫偏好已更新，下次生成計畫時生效" });
    },
    onError: (error: Error) => {
      toast({ title: "保存失敗", description: error.message, variant: "destructive" });
    },
  });

  const total = strengthWeight + cardioWeight + activityWeight;
  const isValid = Math.abs(total - 100) < 0.01;

  const handleSave = () => {
    if (!isValid) {
      toast({ title: "權重總和必須為100", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ strengthWeight, cardioWeight, activityWeight });
  };

  const handleSavePlanRules = () => {
    savePlanRulesMutation.mutate(planCustomRules);
  };

  const handleResetPlanRules = () => {
    setPlanCustomRules(DEFAULT_PLAN_CUSTOM_RULES);
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
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">設置</h1>
        <p className="text-muted-foreground">配置綜合評分權重與 AI 訓練計畫偏好</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>綜合評分權重</CardTitle>
          <CardDescription>
            調整力量、有氧、活動量在綜合評分中的佔比。三項權重總和必須為 100。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="strength-weight">力量權重 (%)</Label>
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
            <Label htmlFor="cardio-weight">有氧權重 (%)</Label>
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
            <Label htmlFor="activity-weight">活動量權重 (%)</Label>
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
          <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
            <p className={`text-sm ${isValid ? "text-muted-foreground" : "text-destructive font-medium"}`} data-testid="text-weight-total">
              總計: {total}%{!isValid && " (必須為100%)"}
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
          <CardTitle>AI 訓練計畫排程偏好</CardTitle>
          <CardDescription>
            自定義 AI 生成每週訓練計畫時的排程規則，例如上班日強度、週末安排等。修改後下次點「生成計畫」即可生效。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={planCustomRules}
            onChange={(e) => setPlanCustomRules(e.target.value)}
            rows={6}
            className="text-sm font-mono"
            data-testid="textarea-plan-custom-rules"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetPlanRules}
              data-testid="button-reset-plan-rules"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              還原預設
            </Button>
            <Button
              onClick={handleSavePlanRules}
              disabled={savePlanRulesMutation.isPending}
              data-testid="button-save-plan-rules"
            >
              {savePlanRulesMutation.isPending ? "保存中..." : "保存偏好"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>評分公式說明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">力量評分</p>
            <p>重量係數 × 次數 × 組數 × 動作係數 / 10</p>
          </div>
          <div>
            <p className="font-medium text-foreground">有氧評分</p>
            <p>分鐘數 × 組數 × 強度係數</p>
          </div>
          <div>
            <p className="font-medium text-foreground">活動量評分</p>
            <p>ln(1 + 步數/1000) × 5（遞減收益）</p>
          </div>
          <div>
            <p className="font-medium text-foreground">綜合評分</p>
            <p>力量分 × {strengthWeight}% + 有氧分 × {cardioWeight}% + 活動量分 × {activityWeight}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
