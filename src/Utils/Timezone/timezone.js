import geoip from "geoip-lite";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { DEFAULT_TIMEZONE } from "../Date/time.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const LOCAL_IPS = new Set(["127.0.0.1", "::1", "localhost", "0.0.0.0"]);

const normalizeIp = (ip) => {
  if (!ip || typeof ip !== "string") return null;

  let normalized = ip.trim();
  if (!normalized) return null;

  if (normalized.startsWith("::ffff:")) {
    normalized = normalized.replace("::ffff:", "");
  }

  if (normalized.includes(","))
    normalized = normalized.split(",")[0].trim();

  return normalized || null;
};

const isLocalIp = (ip) => {
  if (!ip) return true;
  return LOCAL_IPS.has(ip) || ip.startsWith("127.") || ip === "::";
};

export const getClientIp = (req) => {
  const headers = req.headers || {};
  const candidates = [
    headers["cf-connecting-ip"],
    headers["x-real-ip"],
    headers["x-forwarded-for"],
    req.socket?.remoteAddress,
    req.ip,
  ];

  for (const candidate of candidates) {
    const ip = normalizeIp(Array.isArray(candidate) ? candidate[0] : candidate);
    if (ip) return ip;
  }

  return null;
};

export const getTimezoneFromIp = (req) => {
  const ip = getClientIp(req);
  if (isLocalIp(ip)) {
    return {
      ip,
      geo: null,
      timezone: DEFAULT_TIMEZONE,
      country: null,
    };
  }

  const geo = geoip.lookup(ip);
  return {
    ip,
    geo,
    timezone: geo?.timezone || DEFAULT_TIMEZONE,
    country: geo?.country || null,
  };
};

export const resolveRequestTimezone = (req) => {
  const result = getTimezoneFromIp(req);
  return result.timezone || DEFAULT_TIMEZONE;
};

export const formatDateTimeForTimezone = (
  date,
  tz = DEFAULT_TIMEZONE,
  format = "YYYY-MM-DD hh:mm A",
) => {
  if (!date) return null;
  const parsed = dayjs.utc(date);
  return parsed.isValid() ? parsed.tz(tz || DEFAULT_TIMEZONE).format(format) : null;
};
