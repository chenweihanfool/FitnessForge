import { BarChart3, FileText, Home, Plus, Trophy } from "lucide-react";
import { Link, useLocation } from "wouter";

const ITEMS = [
  { title: "儀表板", url: "/", icon: Home },
  { title: "記錄", url: "/entries", icon: BarChart3 },
  { title: "週報告", url: "/report", icon: FileText },
  { title: "生涯", url: "/career", icon: Trophy },
];

// 手機底部導覽：訓練時單手就能記錄與切換，桌面版用側邊欄（md 以上隱藏）。
export function MobileBottomNav({ onQuickAdd }: { onQuickAdd: () => void }) {
  const [location] = useLocation();

  const renderLink = (item: (typeof ITEMS)[number]) => {
    const active = location === item.url;
    return (
      <Link
        key={item.url}
        href={item.url}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "font-semibold text-primary" : "text-muted-foreground"}`}
        data-testid={`mobile-nav-${item.url === "/" ? "dashboard" : item.url.slice(1)}`}
      >
        <item.icon className="h-5 w-5" />
        {item.title}
      </Link>
    );
  };

  return (
    <nav
      className="flex shrink-0 items-center border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="主要導覽"
      data-testid="mobile-bottom-nav"
    >
      {ITEMS.slice(0, 2).map(renderLink)}
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onQuickAdd}
          aria-label="快速記錄"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
          data-testid="mobile-nav-quick-add"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
      {ITEMS.slice(2).map(renderLink)}
    </nav>
  );
}
