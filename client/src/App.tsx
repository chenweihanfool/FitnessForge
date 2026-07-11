import { Switch, Route, Link, Router as WouterRouter } from "wouter";
import { BASE_PATH } from "@/lib/basePath";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Home } from "lucide-react";
import { changelog } from "@/data/changelog";
import { useState } from "react";
import { useAuth, AuthProvider } from "@/hooks/use-auth";
import Dashboard from "@/pages/dashboard";
import Exercises from "@/pages/exercises";
import Entries from "@/pages/entries";
import Career from "@/pages/career";
import ImportPage from "@/pages/import";
import ExportPage from "@/pages/export";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/login";
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
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [showChangelog, setShowChangelog] = useState(false);
  const latestVersion = changelog[0]?.version ?? "";
  const { user, isLoggedIn, isWhitelisted, isAdmin, isLoading } = useAuth();

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">載入中…</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage />;
  }

  if (!isWhitelisted && !isAdmin) {
    return <LoginPage isWhitelistDenied username={user?.username} />;
  }

  return (
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
              <button
                onClick={() => setShowChangelog(true)}
                data-testid="button-version-badge"
                className="focus:outline-none"
              >
                <Badge variant="outline" className="font-mono text-xs cursor-pointer no-default-active-elevate">
                  {latestVersion}
                </Badge>
              </button>
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

      <Dialog open={showChangelog} onOpenChange={setShowChangelog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>版本歷程</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-5 py-1">
              {changelog.map((entry, idx) => (
                <div key={entry.version} className="relative pl-4">
                  <div className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary" />
                  {idx < changelog.length - 1 && (
                    <div className="absolute left-[3px] top-3.5 bottom-[-14px] w-px bg-border" />
                  )}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="secondary" className="font-mono text-xs" data-testid={`badge-version-${entry.version}`}>
                      {entry.version}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">{entry.date}</span>
                    <span className="text-sm font-medium">{entry.title}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {entry.items.map((item, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground/50 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={BASE_PATH}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AppShell />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}
