// middleware/authApiKey.js
module.exports = function (req, res, next) {
  const keyHeader = req.headers["x-api-key"] || (req.headers.authorization && req.headers.authorization.split(" ")[1]);
  const expected = process.env.API_READ_KEY || null;
  if (!expected) {
    console.warn("authApiKey: API_READ_KEY not set — allowing request (unsafe!)");
    return next();
  }
  if (!keyHeader || keyHeader !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  return next();
};
