import { Home, Dumbbell, BarChart3, FileUp, FileDown, Settings, Trophy, Star, Shield, User } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { RankingData } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const menuItems = [
  { title: "仪表板", url: "/", icon: Home },
  { title: "运动管理", url: "/exercises", icon: Dumbbell },
  { title: "数据记录", url: "/entries", icon: BarChart3 },
  { title: "生涯全览", url: "/career", icon: Trophy },
  { title: "数据导入", url: "/import", icon: FileUp },
  { title: "数据导出", url: "/export", icon: FileDown },
  { title: "设置", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isAdmin } = useAuth();

  const { data: rankingData } = useQuery<RankingData>({
    queryKey: ["/api/stats/ranking"],
  });

  const achievedCount = (() => {
    if (!rankingData) return 0;
    const currentTotal = rankingData.currentWeek?.totalBaselineValue || 0;
    const avgTotal = rankingData.averageWeeklyValue || 0;
    const entryCount = rankingData.currentWeek?.entryCount || 0;
    if (entryCount < 1) return 0;
    let count = 1;
    if (entryCount >= 3) count++;
    if (currentTotal >= avgTotal && avgTotal > 0) count++;
    const totalWeeks = rankingData.totalWeeks || 1;
    const percentile = (rankingData.rank / totalWeeks) * 100;
    if (count >= 3 && percentile <= 25) count++;
    if (count >= 4 && percentile <= 10) count++;
    return Math.min(count, 5);
  })();

  const compositeScore = rankingData?.currentWeek?.totalBaselineValue || 0;
  const avgScore = rankingData?.averageWeeklyValue || 0;
  const diffPct = avgScore > 0 ? ((compositeScore - avgScore) / avgScore * 100) : 0;
  const isAbove = compositeScore >= avgScore;

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Dumbbell className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-sidebar-foreground">健身追踪</h2>
            <p className="text-xs text-sidebar-foreground/70">数据管理系统</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航菜单</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`nav-${item.url === "/" ? "dashboard" : item.url.slice(1)}`}>
                      <a href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/admin"} data-testid="nav-admin">
                    <a href="/admin">
                      <Shield className="h-4 w-4" />
                      <span>管理員後台</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {rankingData && (
          <SidebarGroup>
            <SidebarGroupLabel>本周快報</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-3 space-y-3" data-testid="sidebar-weekly-snapshot">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-sidebar-foreground/70">里程碑</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${star <= achievedCount ? 'text-yellow-500 fill-yellow-500' : 'text-sidebar-foreground/20'}`}
                        data-testid={`sidebar-star-${star}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-sidebar-foreground/70">排名</span>
                  <span className="text-xs font-semibold text-sidebar-foreground" data-testid="sidebar-rank">
                    #{rankingData.rank} / {rankingData.totalWeeks} 週
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-sidebar-foreground/70">綜合分</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-sidebar-foreground" data-testid="sidebar-score">
                      {compositeScore.toFixed(0)}
                    </span>
                    <span className="text-xs text-sidebar-foreground/50">
                      / 均 {avgScore.toFixed(0)}
                    </span>
                    {avgScore > 0 && (
                      <span className={`text-xs font-semibold ${isAbove ? 'text-green-500' : 'text-red-500'}`} data-testid="sidebar-diff">
                        {isAbove ? '+' : ''}{diffPct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-1">
            {user.profileImage ? (
              <img src={user.profileImage} alt={user.username} className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user.username}</p>
            </div>
            {isAdmin && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">管理員</Badge>
            )}
          </div>
        )}
        <div className="rounded-md bg-sidebar-accent p-3">
          <p className="text-xs text-sidebar-accent-foreground/80">
            追踪您的健身数据，突破个人记录
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
