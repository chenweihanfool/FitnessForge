import { Dumbbell, LogIn, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginPageProps {
  isWhitelistDenied?: boolean;
  username?: string;
}

function getReplitLoginUrl(): string {
  // Use the browser's actual hostname (no port) — this is what Replit's auth_with_repl_site expects
  const domain = window.location.hostname;
  return `https://replit.com/auth_with_repl_site?domain=${domain}`;
}

export default function LoginPage({ isWhitelistDenied, username }: LoginPageProps) {
  const handleLogin = () => {
    window.location.href = getReplitLoginUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <Dumbbell className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">健身追蹤</CardTitle>
          <CardDescription>
            {isWhitelistDenied
              ? "此帳號尚未獲得授權"
              : "請使用 Replit 帳號登入"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isWhitelistDenied ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">存取遭拒</p>
                  {username && (
                    <p className="text-muted-foreground mt-0.5">
                      帳號 <span className="font-mono font-semibold">{username}</span> 不在白名單中，請聯繫管理員新增授權。
                    </p>
                  )}
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={handleLogin}>
                <LogIn className="h-4 w-4 mr-2" />
                切換其他帳號登入
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={handleLogin}>
              <LogIn className="h-4 w-4 mr-2" />
              使用 Replit 帳號登入
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            登入後即同意系統記錄您的健身數據
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
