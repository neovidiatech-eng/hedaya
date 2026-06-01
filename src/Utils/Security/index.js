import bcrypt from "bcryptjs";
import CryptoJS from "crypto-js";

export const hash = async ({ password, salt = process.env.SALT }) => {
  return await bcrypt.hash(password, Number(salt));
};
export const compare = async ({ password, hash }) => {
  return await bcrypt.compare(password, hash);
};

export const encryptText = ({ text }) => {
  return CryptoJS.AES.encrypt(text, process.env.ENCRYPT_KEY).toString();
};

export const decryptText = async ({ text }) => {
  try {
    if (!text) return null;

    const bytes = CryptoJS.AES.decrypt(text, process.env.ENCRYPT_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch (err) {
    console.error("Decrypt error:", err);
    return null;
  }
};

export const looksEncrypted = (value) => {
  if (typeof value !== "string") return false;

  return (
    value.startsWith("U2FsdGVkX1") || /^[a-f0-9]{32}:[a-f0-9]+$/i.test(value)
  );
};

export const looksBcrypt = (value) => {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
};

export const encryptPassword = ({ password }) => {
  return encryptText({ text: password });
};

export const comparePassword = async ({ password, storedPassword }) => {
  if (!storedPassword) return false;

  if (looksEncrypted(storedPassword)) {
    const decryptedPassword = await decryptText({ text: storedPassword });
    return decryptedPassword === password;
  }

  if (looksBcrypt(storedPassword)) {
    return await compare({ password, hash: storedPassword });
  }

  return storedPassword === password;
};

export const decryptPasswordForResponse = async (storedPassword) => {
  if (!storedPassword || !looksEncrypted(storedPassword)) return null;
  return await decryptText({ text: storedPassword });
};
