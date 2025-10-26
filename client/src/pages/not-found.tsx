import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground mb-6" />
          <h1 className="text-3xl font-bold mb-2">404</h1>
          <p className="text-muted-foreground mb-6">
            抱歉，找不到您访问的页面
          </p>
          <Link href="/">
            <Button data-testid="button-back-home">返回首页</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
