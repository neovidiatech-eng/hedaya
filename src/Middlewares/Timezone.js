import { getTimezoneFromIp } from "../Utils/Timezone/timezone.js";

export const timezoneMiddleware = (req, res, next) => {
  const { ip, geo, timezone, country } = getTimezoneFromIp(req);

  req.clientIp = ip;
  req.geo = geo;
  req.timezone = timezone;
  req.request_country = country;
  next();
};
