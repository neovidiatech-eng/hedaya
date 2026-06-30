import rateLimit from "express-rate-limit";
import { getDir } from "../Utils/i18n.js";

const rateLimitHandler = (messageKey) => (req, res) => {
  const lang = req?.lang || "en";

  return res.status(429).json({
    message: req.t ? req.t(messageKey) : messageKey,
    status: 429,
    lang: getDir(lang),
  });
};

// Generic rate limiter for auth routes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  handler: rateLimitHandler("RATE_LIMIT_AUTH"),
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// More strict limiter for OTP requests
export const otpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 OTP requests per hour
  handler: rateLimitHandler("RATE_LIMIT_OTP"),
  standardHeaders: true,
  legacyHeaders: false,
});
