import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Gauge } from "lucide-react";
import type { Exercise } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 力量項目的「動作強度」一覽：把所有力量動作的強度指標排成長條，數值不平衡（例如同樣
// 是深蹲，啞鈴版卻比徒手版高很多、或某個徒手動作比深蹲還高）一眼就看得出來，
// 方便回頭到運動項目調整。強度是計分用的指標，不是公斤數，所以只比相對高低。
export function IntensityOverview({ exercises }: { exercises: Exercise[] | undefined }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(
    () =>
      (exercises ?? [])
        .filter((e) => e.category === "力量")
        .sort((a, b) => b.weightFactor - a.weightFactor || a.name.localeCompare(b.name, "zh-Hant")),
    [exercises],
  );
  if (rows.length < 2) return null;
  const max = rows[0].weightFactor || 1;

  return (
    <Card data-testid="card-intensity-overview">
      <CardHeader className="pb-2">
        <CardTitle
          className="flex cursor-pointer items-center gap-2 text-base"
          onClick={() => setOpen((v) => !v)}
          role="button"
          aria-expanded={open}
        >
          <Gauge className="h-5 w-5" />
          動作強度一覽
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-1.5">
          <p className="pb-1 text-xs text-muted-foreground">
            每個力量動作的強度指標（計分用，不是公斤數）。想讓動作之間更平衡，回到下面的卡片調整「動作強度」。
          </p>
          {rows.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-sm" data-testid={`intensity-row-${e.id}`}>
              <span className="w-28 shrink-0 truncate sm:w-40">{e.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${(e.weightFactor / max) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{e.weightFactor}</span>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
