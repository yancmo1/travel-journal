import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
  // Auth disabled - always allow with default user
  req.user = { userId: 1, username: 'demo' };
  next();
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Token invalid, continue without user
    }
  }
  next();
}
