const authorizeRole = (allowedRoles) => {
    return (req, res, next) => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: "Access forbidden: insufficient role" });
      }
      next();
    };
  };
  
  module.exports = authorizeRole;