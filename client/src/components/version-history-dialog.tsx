import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ChangelogEntry } from "@/data/changelog";
import { CHANGE_TYPE_LABEL, changeType, filterVersions, type ChangeType } from "@/lib/version-history";

// 版本歷程：時間軸版面（左＝版號與日期、中＝節點、右＝一行標題，點開看完整內容）。
// 版面參考 Aiportal 的版本歷程；上方可搜尋、依類型篩選、全部展開／收合。
const TYPE_STYLE: Record<ChangeType, { node: string; ring: string; badge: string }> = {
  major: { node: "bg-violet-500", ring: "ring-violet-500/25", badge: "border-violet-500/60 bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  minor: { node: "bg-primary", ring: "ring-primary/25", badge: "border-primary/60 bg-primary/10 text-primary" },
  patch: { node: "bg-muted-foreground", ring: "ring-muted-foreground/25", badge: "border-border bg-muted text-muted-foreground" },
};

export function VersionHistoryDialog({
  entries,
  open,
  onOpenChange,
}: {
  entries: ChangelogEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(entries[0] ? [entries[0].version] : []));
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ChangeType | "all">("all");

  const list = useMemo(() => filterVersions(entries, query, type), [entries, query, type]);
  const allOpen = list.length > 0 && list.every((v) => expanded.has(v.version));
  const toggle = (version: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[88vh] max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl"
        data-testid="dialog-version-history"
      >
        <header className="flex flex-col gap-3 border-b px-4 py-4 sm:px-7">
          <div className="flex flex-wrap items-baseline gap-2.5 pr-8">
            <span className="h-2 w-2 self-center rounded-sm bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.7)]" aria-hidden />
            <DialogTitle className="text-lg">版本歷程</DialogTitle>
            <DialogDescription className="text-xs">
              共 {entries.length} 版，目前 <b className="font-mono text-primary">{entries[0]?.version}</b>
            </DialogDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋版本、日期、標題或內容…"
                className="h-9 pl-8"
                aria-label="搜尋版本歷程"
                data-testid="input-version-search"
              />
            </div>
            <div className="flex gap-0.5 rounded-lg bg-muted p-[3px]" role="group" aria-label="依類型篩選">
              {(["all", "major", "minor", "patch"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`h-7 rounded-md px-3 text-xs font-medium transition-colors ${
                    type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`filter-version-${t}`}
                >
                  {t === "all" ? "全部" : CHANGE_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(allOpen ? new Set() : new Set(list.map((v) => v.version)))}
              className="h-9 rounded-lg px-3 text-xs font-medium text-primary hover:bg-primary/10 sm:ml-auto"
              data-testid="button-version-toggle-all"
            >
              {allOpen ? "全部收合" : "全部展開"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-7">
          {list.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">沒有符合的版本紀錄</div>
          ) : (
            <ol className="m-0 list-none p-0">
              {list.map((entry, i) => {
                const t = changeType(entry);
                const style = TYPE_STYLE[t];
                const isOpen = expanded.has(entry.version);
                const first = i === 0;
                const last = i === list.length - 1;
                return (
                  <li key={entry.version} className="grid grid-cols-[64px_18px_minmax(0,1fr)] sm:grid-cols-[132px_28px_minmax(0,1fr)]">
                    <div className="pr-1 pt-2.5 text-right sm:pr-2">
                      <div className="font-mono text-xs font-bold sm:text-sm" data-testid={`badge-version-${entry.version}`}>
                        {entry.version}
                      </div>
                      <div className="font-mono text-[10px] tabular-nums text-muted-foreground sm:text-[11px]">{entry.date}</div>
                    </div>
                    <div className="relative flex justify-center">
                      {!(first && last) && (
                        <span
                          className="absolute w-px bg-border"
                          style={{ top: first ? 15 : 0, ...(last ? { height: 15 } : { bottom: 0 }) }}
                        />
                      )}
                      <span className={`relative mt-[15px] h-2.5 w-2.5 rounded-full ring-4 ${style.node} ${style.ring}`} />
                    </div>
                    <div className="min-w-0 pb-2">
                      <button
                        type="button"
                        onClick={() => toggle(entry.version)}
                        aria-expanded={isOpen}
                        className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60 ${isOpen ? "bg-muted" : ""}`}
                      >
                        <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-px text-[10px] font-medium ${style.badge}`}>
                          {CHANGE_TYPE_LABEL[t]}
                        </span>
                        <span className={`min-w-0 flex-1 text-sm ${isOpen ? "font-semibold" : "truncate"}`}>{entry.title}</span>
                        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <ul className="my-1 ml-3 flex list-none flex-col gap-1.5 border-l pl-4">
                          {entry.items.map((item, idx) => (
                            <li key={idx} className="relative text-[13px] leading-7 text-muted-foreground">
                              <span className="absolute -left-[19px] top-[13px] h-1.5 w-1.5 rounded-full bg-border" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
