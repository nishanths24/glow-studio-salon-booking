import { config } from "../config.js";

export function adminAuth(req, res, next) {
  const provided =
    req.get("x-admin-passcode") ||
    req.body?.passcode ||
    req.query?.passcode ||
    "";
  if (provided !== config.adminPasscode) {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Admin passcode required",
    });
  }
  next();
}
