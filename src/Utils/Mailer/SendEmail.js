import { transporter } from "./MailerClient.js";
import { mailTemp } from "./MailTemp.js";
import { getMessage } from "../i18n.js";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

export const sendEmail = async ({
  email,
  subject,
  text,
  otp,
  username,
  lang = "en",
  variant,
  metadata,
  actionUrl,
  actionText,
}) => {
  if (!email) {
    console.error("❌ Mailer Error: No recipient email provided.");
    return { success: false, error: "No recipient email provided" };
  }

  const emailSubject = subject || getMessage("EMAIL_DEFAULT_SUB", lang);
  const emailText = text || getMessage("EMAIL_BODY_TEXT", lang, { otp: otp || 'N/A' });
  const html = mailTemp({
    otp,
    title: emailSubject,
    text,
    username,
    lang,
    variant,
    metadata,
    actionUrl,
    actionText,
  });

  const senderEmail = process.env.APP_EMAIL || process.env.MAIL_FROM || process.env.MAIL_USER || "noreply@hedayaacademy.com";
  const senderName = "Hedaya Academy";

  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    replyTo: senderEmail,
    to: email,
    subject: emailSubject,
    text: emailText,
    html: html,
    headers: {
      'X-Entity-Ref-ID': Date.now().toString(),
    }
  };

  try {
    // 1) Send real email via SMTP
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Email sent successfully:", info.messageId);

    // 2) Save copy to IMAP Sent folder asynchronously (don't block the main flow)
    saveToImapSent(mailOptions).catch(err => {
      console.error("❌ Failed to save email to IMAP Sent folder:", err.message);
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      console.error("❌ Mailer Timeout: Could not connect to SMTP server.");
    } else {
      console.error("❌ Mailer Error:", error.message);
    }
    return { success: false, error: error.message, code: error.code };
  }
};

async function saveToImapSent(mailOptions) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    return;
  }

  const imapHost = process.env.IMAP_HOST || process.env.MAIL_HOST;
  if (!imapHost) {
    console.warn("⚠️ IMAP host is not configured; skipping Sent folder save");
    return;
  }

  const rawTransport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });

  const rawInfo = await rawTransport.sendMail(mailOptions);
  const rawMessage = rawInfo.message;

  const client = new ImapFlow({
    host: imapHost,
    port: Number(process.env.IMAP_PORT) || 993,
    secure: Number(process.env.IMAP_PORT || 993) === 993,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    logger: false,
  });

  await client.connect();
  try {
    const folders = await client.list();
    const sentFolder = folders.find(folder => folder.specialUse === "\\Sent")?.path;
    const commonSentFolders = [
      process.env.IMAP_SENT_FOLDER,
      sentFolder,
      "Sent",
      "INBOX.Sent",
      "Sent Messages",
      "Sent Mail",
      "[Gmail]/Sent Mail",
    ].filter(Boolean);

    const candidates = [...new Set(commonSentFolders)];
    for (const folder of candidates) {
      try {
        await client.append(folder, rawMessage, ["\\Seen"], new Date());
        console.log(`📧 Saved email copy to IMAP Sent folder: ${folder}`);
        return;
      } catch (e) {
        console.warn(`⚠️ Could not save email copy to IMAP folder "${folder}": ${e.message}`);
      }
    }

    console.warn("⚠️ Could not find a writable IMAP Sent folder");
  } finally {
    await client.logout();
  }
}
