/**
 * middlewares/auth.middleware.js
 * Verifies the JWT in the Authorization header.
 * Attaches decoded payload to req.user.
 *
 * Responsibility: Authentication only ("who are you?")
 * For role-based access control ("what can you do?"), see role.middleware.js
 */

const jwt = require('jsonwebtoken');
const { sendUnauthorized } = require('../utils/response');

/**
 * authenticate
 * Middleware that validates the Bearer JWT token.
 * Usage: router.get('/protected', authenticate, controller)
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { user_id, username, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Token has expired');
    }
    return sendUnauthorized(res, 'Invalid token');
  }
};

module.exports = { authenticate };