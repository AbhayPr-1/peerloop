// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const config = require('../config').default;

module.exports = function(req, res, next) {
  const production = process.env.NODE_ENV === 'production';
  const cookieName = production ? '__Host-peerloop_session' : 'peerloop_session';
  const cookieValue = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  let cookieToken: string | null = null;
  try {
    cookieToken = cookieValue ? decodeURIComponent(cookieValue) : null;
  } catch {
    cookieToken = null;
  }
  const token = cookieToken;

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  const jwtSecret = process.env.JWT_SECRET || config.jwtSecret;
  if (!jwtSecret) {
    return res.status(503).json({ msg: 'Authentication is not configured on the server.' });
  }

  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.header('origin');
      const allowedOrigins = config.appOrigin.split(',').map((value) => value.trim()).filter(Boolean);
      if (!origin || !allowedOrigins.includes(origin)) {
        return res.status(403).json({ msg: 'Request origin is not allowed.' });
      }
    }
    const decoded = jwt.verify(token, jwtSecret);
    if (!decoded || typeof decoded !== 'object' || decoded.authVersion !== 2 || !decoded.user || !decoded.user.id) {
      return res.status(401).json({ msg: 'Please sign in again.' });
    }

    req.user = {
      ...decoded.user,
      id: String(decoded.user.id)
    };
    return next();
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token has expired. Please sign in again.' });
    }
    return res.status(401).json({ msg: 'Token is not valid' });
  }
};
