import { verifyToken } from "../Utils/Token/token.js";
import * as db from "../database/dbService.js"
import { getDir, getMessage, normalizeLang } from "../Utils/i18n.js";

const getSocketLang = (socket) =>
  normalizeLang(socket.handshake.auth?.lang || socket.handshake.headers?.["accept-language"]);

const socketError = (key, lang, status = 401) => {
  const error = new Error(getMessage(key, lang), { cause: status });
  error.data = { status, lang: getDir(lang) };
  return error;
};


export const socketAuthentication = async (socket, next) => {
  try {
    const lang = getSocketLang(socket);
    socket.lang = lang;
    socket.t = (key, params) => getMessage(key, lang, params);

    const token = socket.handshake.auth.token;
    if (!token || typeof token !== "string") {
      return next(socketError("INVALID_TOKEN", lang));
    }

    const decoded = verifyToken({ token });
    if (!decoded || !decoded.id) {
      return next(socketError("INVALID_TOKEN", lang));
    }

    
    const user = await db.findFirst({
      model: "user",
      where: {
        id: decoded.id,
      },
      include: {
        student: true,
        teacher: true,
        role: true,
      },
    });
    
    if (!user) {
      return next(socketError("INVALID_TOKEN", lang));
    }

    socket.user = user;
    socket.decoded = decoded;

    next();
  } catch (error) {
    next(error);
  }
};
