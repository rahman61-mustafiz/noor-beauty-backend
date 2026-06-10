const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'customer') {
      return res.status(401).json({ message: 'Invalid token type' });
    }
    req.userId = payload.sub;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
}

module.exports = authMiddleware;
