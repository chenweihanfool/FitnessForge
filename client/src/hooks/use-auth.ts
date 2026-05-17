import { useQuery } from "@tanstack/react-query";

export interface AuthUser {
  replitUserId: string;
  username: string;
  role: "admin" | "user";
  profileImage: string | null;
}

interface AuthResponse {
  user: AuthUser | null;
  isWhitelisted?: boolean;
}

export function useAuth() {
  const { data, isLoading } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: 30_000,
  });

  return {
    user: data?.user ?? null,
    isWhitelisted: data?.isWhitelisted ?? false,
    isAdmin: data?.user?.role === "admin",
    isLoading,
    isLoggedIn: !!data?.user,
  };
}
