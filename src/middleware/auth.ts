import { Request, Response, NextFunction } from 'express';
import { getTokenFromHeader, verifyToken } from '../lib/auth';

export interface AuthRequest extends Request {
  user?: any;
  headers: Request['headers'];
  params: Request['params'];
  body: Request['body'];
  query: Request['query'];
}

export default function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization as string | undefined;
  const token = getTokenFromHeader(authHeader ?? '');
  if (!token) return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ success: false, error: 'Invalid token' });

  req.user = payload;
  next();
}
