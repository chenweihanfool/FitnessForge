import { useState, useEffect, createContext, useContext, type ReactNode, createElement } from "react";
import { queryClient } from "@/lib/queryClient";

export interface AuthUser {
  replitUserId: string;
  username: string;
  role: "admin" | "user";
  profileImage: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isWhitelisted: boolean;
  isAdmin: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
  loginWithReplit: () => void;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
        setIsWhitelisted(data.isWhitelisted ?? false);
      } else {
        setUser(null);
        setIsWhitelisted(false);
      }
    } catch {
      setUser(null);
      setIsWhitelisted(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Clear error params left by OIDC callback
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    fetchMe();
  }, []);

  const loginWithReplit = () => {
    window.location.href = "/api/auth/login";
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setIsWhitelisted(false);
    queryClient.clear();
  };

  return createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        isWhitelisted,
        isAdmin: user?.role === "admin",
        isLoggedIn: !!user,
        isLoading,
        loginWithReplit,
        logout,
        refetch: fetchMe,
      },
    },
    children
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
