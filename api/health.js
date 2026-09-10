module.exports = function healthHandler(_req, res) {
  res.status(200).json({
    ok: true,
    service: "hktube",
    timestamp: new Date().toISOString(),
  });
};
