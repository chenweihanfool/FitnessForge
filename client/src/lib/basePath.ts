export const BASE_PATH = (import.meta.env.VITE_BASE_PATH as string | undefined) ?? "";

export function withBasePath(path: string): string {
  return path.startsWith("/") ? BASE_PATH + path : path;
}
