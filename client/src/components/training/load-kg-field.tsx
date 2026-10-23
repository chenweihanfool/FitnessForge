import type { Control } from "react-hook-form";
import type { InsertWorkoutEntry } from "@shared/schema";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// 非力量項目的「負重（公斤）」欄位（跑步機負重背心、手持啞鈴等）。
// 只用來追蹤歷史，不影響基準值；力量項目的負重就是強度系數，不需要這一欄。
export function LoadKgField({ control, testId }: { control: Control<InsertWorkoutEntry>; testId: string }) {
  return (
    <FormField
      control={control}
      name="loadKg"
      render={({ field }) => (
        <FormItem>
          <FormLabel>負重（kg，選填）</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.5"
              min="0"
              placeholder="沒有負重就留空"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
              data-testid={testId}
            />
          </FormControl>
          <FormDescription className="text-xs text-muted-foreground">
            例如負重背心、手持啞鈴。只用來追蹤歷史負重，不影響分數。
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
