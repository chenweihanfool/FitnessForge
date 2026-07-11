import { Dumbbell, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

function GoogleLogo() {
  return (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

interface LoginPageProps {
  isWhitelistDenied?: boolean;
  username?: string;
}

export default function LoginPage({ isWhitelistDenied, username }: LoginPageProps) {
  const { loginWithGoogle } = useAuth();

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
            {isWhitelistDenied ? "此帳號尚未獲得授權" : "請使用 Google 帳號登入"}
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
              <Button variant="outline" className="w-full" onClick={loginWithGoogle}>
                <GoogleLogo />
                切換其他帳號登入
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={loginWithGoogle}>
              <GoogleLogo />
              以 Google 帳號登入
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
