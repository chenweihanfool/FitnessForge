import { Home, Dumbbell, BarChart3, FileUp, FileDown, Settings, Trophy } from "lucide-react";
import { useLocation } from "wouter";
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

const menuItems = [
  {
    title: "仪表板",
    url: "/",
    icon: Home,
  },
  {
    title: "运动管理",
    url: "/exercises",
    icon: Dumbbell,
  },
  {
    title: "数据记录",
    url: "/entries",
    icon: BarChart3,
  },
  {
    title: "生涯全览",
    url: "/career",
    icon: Trophy,
  },
  {
    title: "数据导入",
    url: "/import",
    icon: FileUp,
  },
  {
    title: "数据导出",
    url: "/export",
    icon: FileDown,
  },
  {
    title: "设置",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="rounded-md bg-sidebar-accent p-3">
          <p className="text-xs text-sidebar-accent-foreground/80">
            追踪您的健身数据，突破个人记录
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
