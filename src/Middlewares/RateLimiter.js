import rateLimit from "express-rate-limit";
import { getDir } from "../Utils/i18n.js";

// ─── Shared response handler ──────────────────────────────────────────────────
const rateLimitHandler = (messageKey) => (req, res) => {
  const lang = req?.lang || "en";
  return res.status(429).json({
    message: req.t ? req.t(messageKey) : messageKey,
    status: 429,
    lang: getDir(lang),
  });
};

// ─── Config from environment (with safe fallbacks) ───────────────────────────
const GLOBAL_WINDOW  = parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min
const GLOBAL_MAX     = parseInt(process.env.GLOBAL_RATE_LIMIT_MAX)        || 300;            // 300 req / window

const AUTH_WINDOW    = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS)    || 15 * 60 * 1000; // 15 min
const AUTH_MAX       = parseInt(process.env.AUTH_RATE_LIMIT_MAX)          || 20;             // 20 req / window

const OTP_WINDOW     = parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS)     || 60 * 60 * 1000; // 1 hour
const OTP_MAX        = parseInt(process.env.OTP_RATE_LIMIT_MAX)           || 5;              // 5 req / hour

// ─── Global limiter — apply to every incoming request ────────────────────────
export const globalRateLimiter = rateLimit({
  windowMs: GLOBAL_WINDOW,
  max: GLOBAL_MAX,
  handler: rateLimitHandler("RATE_LIMIT_EXCEEDED"),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// ─── Auth limiter — login, signup, google auth ────────────────────────────────
export const authRateLimiter = rateLimit({
  windowMs: AUTH_WINDOW,
  max: AUTH_MAX,
  handler: rateLimitHandler("RATE_LIMIT_AUTH"),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// ─── OTP limiter — resend-otp, forget-password ───────────────────────────────
export const otpRateLimiter = rateLimit({
  windowMs: OTP_WINDOW,
  max: OTP_MAX,
  handler: rateLimitHandler("RATE_LIMIT_OTP"),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});
