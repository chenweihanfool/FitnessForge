import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

export interface AuthUser {
  replitUserId: string;
  username: string;
  role: "admin" | "user";
  profileImage: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Read Replit auth headers and resolve user from DB
export async function resolveUser(req: Request): Promise<AuthUser | null> {
  const replitUserId = req.headers["x-replit-user-id"] as string | undefined;
  const username = req.headers["x-replit-user-name"] as string | undefined;
  const profileImage = req.headers["x-replit-user-profile-image"] as string | undefined;

  if (!replitUserId || !username) return null;

  const user = await storage.upsertUser({ replitUserId, username, profileImage: profileImage || null });
  return { replitUserId: user.replitUserId, username: user.username, role: user.role as "admin" | "user", profileImage: user.profileImage };
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({ error: "未登入，請透過 Replit 帳號登入" });
    }

    // Check whitelist (admin is always allowed)
    if (user.role !== "admin") {
      const allowed = await storage.isWhitelisted(user.username);
      if (!allowed) {
        return res.status(403).json({ error: "此帳號尚未獲得授權，請聯繫管理員", username: user.username });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "未登入" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "需要管理員權限" });
  }
  next();
}
