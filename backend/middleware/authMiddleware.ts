// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const config = require('../config').default;

module.exports = function(req, res, next) {
  const authorization = req.header('authorization');
  const bearerToken = authorization && authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
  const token = req.header('x-auth-token') || bearerToken;

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  const jwtSecret = process.env.JWT_SECRET || config.jwtSecret;
  if (!jwtSecret) {
    return res.status(503).json({ msg: 'Authentication is not configured on the server.' });
  }

  try {
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
