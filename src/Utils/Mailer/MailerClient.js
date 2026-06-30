import nodemailer from "nodemailer";

const host = process.env.MAIL_HOST || "smtp.gmail.com";
const port = Number(process.env.MAIL_PORT) || 587;
const secure = port === 465;

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  pool: true, // تفعيل التجميع لإعادة استخدام الاتصال وتجنب الـ timeout
  maxConnections: 5,
  maxMessages: 100,
  auth: {
    user: process.env.MAIL_USER || process.env.APP_EMAIL,
    pass: process.env.MAIL_PASS || process.env.APP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
  // timeout كبير لتجنب disconnect
  connectionTimeout: 10000,
}); 

// فحص الاتصال عند التشغيل لضمان استجابة السيرفر
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Connection Error:", error.message);
    const user = process.env.MAIL_USER || process.env.APP_EMAIL;
    if (!user) console.error("   - SMTP Auth user (MAIL_USER / APP_EMAIL) is missing or empty");
  } else {
    console.log("📧 SMTP Server is ready to take messages");
  }
});
