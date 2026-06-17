// Simple shared-key guard for the in-salon tablet endpoints.
//
// Rollout-friendly: enforcement turns ON only once TABLET_KEY is set in the
// environment. So you can deploy this first with nothing breaking, then set
// TABLET_KEY on Railway and ship the tablet build that sends the matching key.
module.exports = function tabletAuth(req, res, next) {
  const expected = process.env.TABLET_KEY;
  if (!expected) return next(); // not configured yet -> stays open (legacy behaviour)

  const got = req.headers['x-tablet-key'];
  if (got && got === expected) return next();

  return res.status(401).json({ message: 'Unauthorized tablet device' });
};
