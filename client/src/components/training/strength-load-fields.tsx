import { FormDescription, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// 力量項目的「動作強度 + 外加負重」輸入。
//  - 動作強度：計分用的強度「指標」（徒手動作是體重當量），由運動項目設定、不是公斤數，
//    所以不同動作之間的數值不必一致；這裡畫一條相對同類最高的長條，一眼看出這個動作在
//    你所有力量動作裡的相對強度。
//  - 外加負重：真正掛上去的公斤數（啞鈴、槓片、負重背心）。
//  - 合計 = 動作強度 + 外加負重，就是送去計分與追蹤的 weightFactor（計算方式沒有變）。
export function StrengthLoadFields({
  intensity,
  added,
  defaultIntensity,
  maxIntensity,
  readOnly,
  templateNote,
  total,
  onIntensityChange,
  onAddedChange,
}: {
  intensity: number | "";
  added: number | "";
  defaultIntensity: number;
  maxIntensity: number;
  readOnly: boolean;
  templateNote?: string;
  total: number;
  onIntensityChange: (v: number | "") => void;
  onAddedChange: (v: number | "") => void;
}) {
  const intensityNum = typeof intensity === "number" ? intensity : 0;
  const barPct = maxIntensity > 0 ? Math.min(100, (intensityNum / maxIntensity) * 100) : 0;
  const addedNum = typeof added === "number" ? added : 0;
  const changed = !readOnly && intensity !== "" && intensityNum !== defaultIntensity;

  return (
    <FormItem data-testid="strength-load-fields">
      <FormLabel>動作強度 ＋ 外加負重</FormLabel>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">動作強度（指標）</label>
          <Input
            type="number"
            step="0.5"
            min="0"
            placeholder="動作強度"
            value={readOnly ? total : intensity}
            readOnly={readOnly}
            className={readOnly ? "bg-muted" : ""}
            onChange={(e) => !readOnly && onIntensityChange(e.target.value ? parseFloat(e.target.value) : "")}
            data-testid="input-entry-weight-factor"
          />
          {!readOnly && (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${barPct}%` }} data-testid="intensity-bar" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">外加負重（kg，選填）</label>
          <Input
            type="number"
            step="0.5"
            min="0"
            placeholder="0"
            value={readOnly ? "" : added}
            readOnly={readOnly}
            className={readOnly ? "bg-muted" : ""}
            onChange={(e) => !readOnly && onAddedChange(e.target.value ? parseFloat(e.target.value) : "")}
            data-testid="input-entry-added-load"
          />
        </div>
      </div>
      {readOnly ? (
        <FormDescription className="text-xs">{templateNote}・合計強度 {total}</FormDescription>
      ) : (
        <FormDescription className="text-xs" data-testid="text-strength-total">
          合計強度 <span className="font-semibold text-foreground">{total}</span>
          {addedNum > 0 && `（${intensityNum} + 外加 ${addedNum}）`}
          ・動作強度預設 {defaultIntensity}
          {changed && "（本次已改）"}
          。強度是計分用的指標、不是公斤數；只有「外加負重」才是實際掛上去的重量。
        </FormDescription>
      )}
    </FormItem>
  );
}
