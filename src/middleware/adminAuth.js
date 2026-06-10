const jwt = require('jsonwebtoken');

function adminAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Admin authorization required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'admin') {
      return res.status(401).json({ message: 'Admin token required' });
    }
    req.adminId = payload.sub;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Admin token invalid or expired' });
  }
}

module.exports = adminAuthMiddleware;
