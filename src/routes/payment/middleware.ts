import { Request, Response } from 'express';
import { verifyToken, TokenPayload } from '../../lib/auth';

export const authMiddleware = (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}
