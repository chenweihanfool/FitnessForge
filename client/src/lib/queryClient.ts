import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// 這些 query 都是由「運動記錄」算出來的衍生資料。staleTime 設成 Infinity，所以
// 任何會改動記錄的操作（新增/修改/刪除/匯入/重算基準值/調整權重…）之後都要主動
// 讓它們失效——集中在這一個函式，不要在各頁面各自列一份清單（先前各頁的清單
// 長短不一，漏列的頁面會顯示舊資料）。
const WORKOUT_DERIVED_PREFIXES = ["/api/entries", "/api/stats", "/api/training"];

export function invalidateWorkoutData() {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === "string" && WORKOUT_DERIVED_PREFIXES.some((prefix) => key.startsWith(prefix));
    },
  });
}

/** 運動項目的參數（肌群比例、係數…）變動也會影響所有衍生統計 */
export function invalidateExerciseData() {
  invalidateWorkoutData();
  return queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
}
