export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const payload = {
    error: err.code || (status === 500 ? "SERVER_ERROR" : "ERROR"),
    message: status === 500 ? "Something went wrong. Please try again." : err.message,
  };
  if (err.fields) payload.fields = err.fields;
  if (status === 500) console.error(err);
  res.status(status).json(payload);
}

export function notFound(req, res) {
  res.status(404).json({ error: "NOT_FOUND", message: "Route not found" });
}
