import { Request, Response, NextFunction } from 'express';

export interface ActorContext {
  userId: string | null;
  actorName: string;
  actorRole: string;
  ipOrDevice: string;
}

declare global {
  namespace Express {
    interface Request {
      actor: ActorContext;
    }
  }
}

/**
 * Middleware trích xuất thông tin người dùng thao tác và thiết bị phục vụ kiểm soát quyền & ghi Audit Log (Mục 12.2 & 14.4)
 */
export function attachActorContext(req: Request, _res: Response, next: NextFunction): void {
  const userId = (req.headers['x-user-id'] as string) || null;
  const rawName = (req.headers['x-actor-name'] as string) || '';
  const rawRole = (req.headers['x-actor-role'] as string) || '';

  let actorName = 'Quản trị viên';
  let actorRole = 'Super Admin';
  try {
    if (rawName) actorName = decodeURIComponent(rawName);
    if (rawRole) actorRole = decodeURIComponent(rawRole);
  } catch {
    actorName = rawName || 'Quản trị viên';
    actorRole = rawRole || 'Super Admin';
  }

  req.actor = {
    userId,
    actorName,
    actorRole,
    ipOrDevice: String(req.headers['user-agent'] || req.ip || 'Web Client').slice(0, 80),
  };
  next();
}
