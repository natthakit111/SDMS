/**
 * middlewares/role.middleware.js
 * Role-based access control (RBAC).
 *
 * Responsibility: Authorization only ("what can you do?")
 * Must be used AFTER authenticate (auth.middleware.js), since it
 * relies on req.user being set by the JWT verification step.
 */

const { sendUnauthorized, sendForbidden } = require('../utils/response');

/**
 * authorizeRoles
 * Middleware factory that restricts access to specific roles.
 * Usage: router.post('/admin-only', authenticate, authorizeRoles('admin'), controller)
 *
 * @param {...string} roles - Allowed roles e.g. 'admin', 'tenant'
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendUnauthorized(res);
    }
    if (!roles.includes(req.user.role)) {
      return sendForbidden(
        res,
        `Role '${req.user.role}' is not allowed to access this resource`
      );
    }
    next();
  };
};

module.exports = { authorizeRoles };