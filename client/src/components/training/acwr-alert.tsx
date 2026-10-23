import { AlertTriangle, ChevronRight } from "lucide-react";
import { useTrainingOverview } from "@/hooks/use-training";
import { ACWR_ZONE_META } from "./acwr-meta";

// 疲勞風險只有在「注意」或「高風險」時才出現的提示條，平常不佔版面。
// 有傳 onShowDetails 才會顯示「詳情」按鈕（快速記錄對話框裡不需要）。
export function AcwrAlert({ onShowDetails }: { onShowDetails?: () => void }) {
  const { data } = useTrainingOverview();
  const acwr = data?.acwr;
  if (!acwr || (acwr.zone !== "caution" && acwr.zone !== "danger")) return null;
  const meta = ACWR_ZONE_META[acwr.zone];
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
        acwr.zone === "danger" ? "border-red-500/40 bg-red-500/10" : "border-amber-500/40 bg-amber-500/10"
      }`}
      role="alert"
      data-testid="alert-acwr"
    >
      <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${meta.text}`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium">
          疲勞風險「{meta.label}」・ACWR {acwr.ratio}
        </p>
        <p className="text-xs text-muted-foreground">{meta.advice}</p>
      </div>
      {onShowDetails && (
        <button
          type="button"
          onClick={onShowDetails}
          className="flex shrink-0 items-center text-xs text-muted-foreground hover:text-foreground"
          data-testid="button-acwr-details"
        >
          詳情<ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
