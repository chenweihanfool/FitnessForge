import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Plus, Home } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import Exercises from "@/pages/exercises";
import Entries from "@/pages/entries";
import Career from "@/pages/career";
import ImportPage from "@/pages/import";
import ExportPage from "@/pages/export";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/exercises" component={Exercises} />
      <Route path="/entries" component={Entries} />
      <Route path="/career" component={Career} />
      <Route path="/import" component={ImportPage} />
      <Route path="/export" component={ExportPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex h-14 items-center justify-between gap-4 border-b bg-secondary px-4 lg:px-6 shrink-0">
                <div className="flex items-center gap-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <Button size="icon" variant="ghost" data-testid="button-home" asChild>
                    <Link href="/">
                      <Home className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="default" data-testid="button-quick-add" asChild>
                    <Link href="/entries">
                      <Plus className="h-4 w-4" />
                    </Link>
                  </Button>
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 overflow-auto p-4 lg:p-6">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
