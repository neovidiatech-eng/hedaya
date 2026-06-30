// export const mailTemp = ({ title, otp, text, username = "there", lang = "en" }) => {
//   const isAr = lang === "ar";
//   const defaultTitle = isAr ? "تفعيل حسابك" : "Verify your account";
//   const displayTitle = title || defaultTitle;
//   const safeOtp = String(otp ?? "").trim();
//   const otpDigits = safeOtp.split("");

//   // Generate OTP boxes HTML using the new design class and styling
//   const otpBoxesHtml = otpDigits.length > 0
//     ? otpDigits.map((digit) => `
//         <td style="padding:0 4px;">
//             <div style="
//                 width:48px; 
//                 height:58px; 
//                 background: linear-gradient(145deg, #F8FAFC, #EEF2FF);
//                 border: 2px solid #C7D2FE;
//                 border-radius:12px; 
//                 font-size:28px; 
//                 font-weight:800; 
//                 color:#1E40AF;
//                 line-height:58px;
//                 text-align:center;
//                 font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
//                 box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
//             ">${digit}</div>
//         </td>
//       `).join("")
//     : "";

//   return `<!DOCTYPE html>
// <html lang="${lang}" dir="${isAr ? 'rtl' : 'ltr'}">

// <head>
//     <meta charset="UTF-8" />
//     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
//     <meta name="color-scheme" content="light dark" />
//     <meta name="supported-color-schemes" content="light dark" />
//     <title>${title}</title>

//     <!--[if mso]>
//   <noscript>
//     <xml>
//       <o:OfficeDocumentSettings>
//         <o:PixelsPerInch>96</o:PixelsPerInch>
//       </o:OfficeDocumentSettings>
//     </xml>
//   </noscript>
//   <![endif]-->

//     <style>
//         /* Reset & Base */
//         body,
//         table,
//         td,
//         p,
//         a,
//         li,
//         blockquote {
//             -webkit-text-size-adjust: 100%;
//             -ms-text-size-adjust: 100%;
//         }

//         /* Animations */
//         @keyframes fadeIn {
//             from {
//                 opacity: 0;
//                 transform: translateY(20px);
//             }

//             to {
//                 opacity: 1;
//                 transform: translateY(0);
//             }
//         }

//         @keyframes pulse {

//             0%,
//             100% {
//                 transform: scale(1);
//             }

//             50% {
//                 transform: scale(1.05);
//             }
//         }

//         @keyframes shimmer {
//             0% {
//                 background-position: -1000px 0;
//             }

//             100% {
//                 background-position: 1000px 0;
//             }
//         }

//         .animated-card {
//             animation: fadeIn 0.6s ease-out;
//         }

//         .otp-box:hover {
//             transform: scale(1.05);
//             transition: transform 0.2s ease;
//         }

//         /* Responsive */
//         @media only screen and (max-width: 620px) {
//             .email-container {
//                 width: 100% !important;
//                 margin: 0 auto !important;
//             }

//             .fluid {
//                 width: 100% !important;
//                 max-width: 100% !important;
//                 height: auto !important;
//             }

//             .stack-column {
//                 display: block !important;
//                 width: 100% !important;
//                 max-width: 100% !important;
//             }

//             .mobile-padding {
//                 padding-left: 20px !important;
//                 padding-right: 20px !important;
//             }

//             .otp-digit {
//                 width: 40px !important;
//                 height: 50px !important;
//                 font-size: 22px !important;
//                 line-height: 50px !important;
//             }
//         }

//         /* Dark Mode */
//         @media (prefers-color-scheme: dark) {
//             .dark-bg {
//                 background-color: #1a1a2e !important;
//             }

//             .dark-card {
//                 background-color: #16213e !important;
//             }

//             .dark-text {
//                 color: #e4e4e7 !important;
//             }

//             .dark-muted {
//                 color: #a1a1aa !important;
//             }
//         }
//     </style>
// </head>

// <body
//     style="margin:0; padding:0; background:#F0F4FF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

//     <!-- Preview Text -->
//     <div
//         style="display:none; font-size:1px; color:#F0F4FF; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
//         ${otp ? (isAr ? `رمز التحقق الخاص بك هو ${safeOtp}. صالح لمدة 10 دقائق.` : `Your verification code is ${safeOtp}. Valid for 10 minutes.`) : displayTitle}
//         &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
//     </div>

//     <!-- Main Wrapper -->
//     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dark-bg"
//         style="background: linear-gradient(180deg, #F0F4FF 0%, #E0E7FF 100%); min-height:100vh;">
//         <tr>
//             <td align="center" style="padding:40px 15px;">

//                 <!-- Email Container -->
//                 <table role="presentation" class="email-container animated-card" width="600" cellpadding="0"
//                     cellspacing="0" border="0"
//                     style="max-width:600px; width:100%; background:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.1);">

//                     <!-- Decorative Top Bar -->
//                     <tr>
//                         <td
//                             style="height:6px; background: linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899, #6366F1); background-size: 300% 100%; animation: shimmer 3s ease-in-out infinite;">
//                         </td>
//                     </tr>

//                     <!-- Header -->
//                     <tr>
//                         <td style="padding:0;">
//                             <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
//                                 style="background: linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #3730A3 100%);">
//                                 <tr>
//                                     <td style="padding:32px 40px; text-align:center;">
//                                         <p
//                                             style="margin:0 0 4px 0; font-size:26px; font-weight:800; color:#FFFFFF; letter-spacing:1px;">
//                                             Neovidia for Software
//                                         </p>
//                                         <p
//                                             style="margin:0; font-size:13px; color:#A5B4FC; font-weight:400; letter-spacing:2px; text-transform:uppercase;">
//                                             ${isAr ? "نصنع تجارب رقمية آمنة" : "Powering Secure Digital Experiences"}
//                                         </p>
//                                     </td>
//                                 </tr>

//                                 <!-- Wave Decoration -->
//                                 <tr>
//                                     <td style="font-size:0; line-height:0;">
//                                         <svg viewBox="0 0 600 40" style="display:block; width:100%;">
//                                             <path d="M0,40 L0,20 Q150,0 300,20 T600,20 L600,40 Z" fill="#FFFFFF" />
//                                         </svg>
//                                     </td>
//                                 </tr>
//                             </table>
//                         </td>
//                     </tr>

//                     <!-- Body Content -->
//                     <tr>
//                         <td class="mobile-padding" style="padding:20px 48px 36px 48px;">

//                             <!-- Icon Badge -->
//                             <table role="presentation" cellpadding="0" cellspacing="0" border="0"
//                                 style="margin:0 auto 24px auto;">
//                                 <tr>
//                                     <td align="center">
//                                         <div style="
//                       width:90px; 
//                       height:90px; 
//                       background: linear-gradient(145deg, #EEF2FF, #E0E7FF);
//                       border-radius:22px; 
//                       box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255,255,255,0.8);
//                       text-align:center;
//                       line-height:90px;
//                     ">
//                                             <span style="font-size:42px;">🔐</span>
//                                         </div>
//                                     </td>
//                                 </tr>
//                             </table>

//                             <!-- Greeting -->
//                             <p
//                                 style="margin:0 0 8px 0; font-size:15px; color:#6366F1; font-weight:600; text-transform:uppercase; letter-spacing:1.5px; text-align:center;">
//                                 ${otp ? (isAr ? "مطلوب التحقق" : "Verification Required") : (isAr ? "مرحباً!" : "Hello!")}
//                             </p>

//                             <!-- Title -->
//                             <h1
//                                 style="margin:0 0 16px 0; font-size:30px; line-height:1.3; color:#0F172A; font-weight:800; text-align:center; letter-spacing:-0.5px;">
//                                 ${title}
//                             </h1>

//                             <!-- Subtitle -->
//                             <p
//                                 style="margin:0 0 28px 0; font-size:16px; line-height:1.7; color:#64748B; text-align:center;">
//                                 ${isAr ? "مرحباً" : "Hi"} <strong style="color:#0F172A;">${username}</strong>,
//                                 ${otp ? (isAr ? "لقد تلقينا طلباً للتحقق من حسابك. استخدم الرمز أدناه للمتابعة:" : "we received a request to verify your account. Use the code below to continue:") : (isAr ? "شكراً لوجودك معنا." : "thank you for being with us.")}
//                             </p>

//                             ${otp ? `
//                             <!-- OTP Section -->
//                             <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
//                                 style="margin:0 auto 24px auto;">
//                                 <tr>
//                                     <td align="center">
//                                         <div
//                                             style="background: linear-gradient(145deg, #FAFBFF, #F0F4FF); border-radius:20px; padding:28px 20px; border: 1px solid #E0E7FF;">

//                                             <!-- OTP Digits -->
//                                             <table role="presentation" cellpadding="0" cellspacing="0" border="0"
//                                                 style="margin:0 auto;">
//                                                 <tr>
//                                                     ${otpBoxesHtml}
//                                                 </tr>
//                                             </table>

//                                             <!-- Timer Badge -->
//                                             <table role="presentation" cellpadding="0" cellspacing="0" border="0"
//                                                 style="margin:18px auto 0 auto;">
//                                                 <tr>
//                                                     <td
//                                                         style="background: linear-gradient(135deg, #FEF3C7, #FDE68A); padding:8px 16px; border-radius:50px;">
//                                                         <span style="font-size:13px; color:#92400E; font-weight:600;">
//                                                             ${isAr ? "⏱️ تنتهي الصلاحية خلال 10 دقائق" : "⏱️ Expires in 10 minutes"}
//                                                         </span>
//                                                     </td>
//                                                 </tr>
//                                             </table>

//                                         </div>
//                                     </td>
//                                 </tr>
//                             </table>

//                             <!-- Security Notice -->
//                             <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
//                                 style="margin:0 auto 20px auto;">
//                                 <tr>
//                                     <td
//                                         style="background: #FEF2F2; border-radius:12px; padding:16px 20px; border-left:4px solid #EF4444;">
//                                         <table cellpadding="0" cellspacing="0" border="0">
//                                             <tr>
//                                                 <td style="padding-right:12px;">
//                                                     <span style="font-size:20px;">🛡️</span>
//                                                 </td>
//                                                 <td>
//                                                     <p
//                                                         style="margin:0; font-size:13px; color:#991B1B; line-height:1.5; font-weight:500;">
//                                                         <strong>${isAr ? "نصيحة أمان:" : "Security Tip:"}</strong> ${isAr ? "لا تشارك هذا الرمز مع أي شخص أبداً. فريقنا لن يطلب منك رمز التحقق الخاص بك." : "Never share this code with anyone. Our team will never ask for your verification code."}
//                                                     </p>
//                                                 </td>
//                                             </tr>
//                                         </table>
//                                     </td>
//                                 </tr>
//                             </table>
//                             ` : ""}

//                             ${text ? `
//                             <!-- Custom Message -->
//                             <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px auto;">
//                               <tr>
//                                 <td style="background: linear-gradient(145deg, #F0FDF4, #DCFCE7); border-radius:16px; padding:24px; border:1px solid #BBF7D0;">
//                                   <p style="margin:0; font-size:15px; color:#166534; line-height:1.7; text-align:center;">
//                                     ${text}
//                                   </p>
//                                 </td>
//                               </tr>
//                             </table>
//                             ` : ""}

//                             <!-- CTA Button -->
//                             <table role="presentation" cellpadding="0" cellspacing="0" border="0"
//                                 style="margin:10px auto 0 auto;">
//                                 <tr>
//                                     <td align="center">
//                                         <a href="${process.env.FRONTEND_URL || 'http://localhost:4200'}/#/" target="_blank" style="
//                         display:inline-block; 
//                         padding:16px 40px; 
//                         background: linear-gradient(135deg, #6366F1 0%, #4F46E5 50%, #4338CA 100%);
//                         border-radius:14px; 
//                         color:#FFFFFF; 
//                         text-decoration:none; 
//                         font-size:15px; 
//                         font-weight:700;
//                         box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5), 0 4px 6px -2px rgba(99, 102, 241, 0.3);
//                         letter-spacing:0.3px;
//                       ">
//                                             ${isAr ? "الذهاب إلى لوحة التحكم ←" : "Go to Dashboard →"}
//                                         </a>
//                                     </td>
//                                 </tr>
//                             </table>

//                         </td>
//                     </tr>

//                     <!-- Features Section -->
//                     <tr>
//                         <td class="mobile-padding" style="padding:0 48px 36px 48px;">
//                             <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
//                                 <tr>
//                                     <!-- Feature 1 -->
//                                     <td width="33%" style="text-align:center; padding:0 8px;">
//                                         <div style="background:#F0FDF4; border-radius:14px; padding:20px 12px;">
//                                             <span style="font-size:28px;">🔒</span>
//                                             <p
//                                                 style="margin:10px 0 0 0; font-size:12px; color:#166534; font-weight:600;">
//                                                 ${isAr ? "آمن" : "Secure"}</p>
//                                         </div>
//                                     </td>
//                                     <!-- Feature 2 -->
//                                     <td width="33%" style="text-align:center; padding:0 8px;">
//                                         <div style="background:#EFF6FF; border-radius:14px; padding:20px 12px;">
//                                             <span style="font-size:28px;">⚡</span>
//                                             <p
//                                                 style="margin:10px 0 0 0; font-size:12px; color:#1E40AF; font-weight:600;">
//                                                 ${isAr ? "سريع" : "Fast"}</p>
//                                         </div>
//                                     </td>
//                                     <!-- Feature 3 -->
//                                     <td width="33%" style="text-align:center; padding:0 8px;">
//                                         <div style="background:#FDF4FF; border-radius:14px; padding:20px 12px;">
//                                             <span style="font-size:28px;">💎</span>
//                                             <p
//                                                 style="margin:10px 0 0 0; font-size:12px; color:#86198F; font-weight:600;">
//                                                 ${isAr ? "مميز" : "Premium"}</p>
//                                         </div>
//                                     </td>
//                                 </tr>
//                             </table>
//                         </td>
//                     </tr>

//                     <!-- Divider -->
//                     <tr>
//                         <td style="padding:0 48px;">
//                             <div
//                                 style="height:1px; background: linear-gradient(90deg, transparent, #E2E8F0, transparent);">
//                             </div>
//                         </td>
//                     </tr>



//                     <!-- Bottom Decorative Bar -->
//                     <tr>
//                         <td
//                             style="height:6px; background: linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899, #6366F1); background-size: 300% 100%;">
//                         </td>
//                     </tr>

//                 </table>

//                 <!-- Email Client Tiny Footer -->
//                 <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0 auto;">
//                     <tr>
//                         <td align="center">
//                             <p style="margin:0; font-size:11px; color:#94A3B8;">
//                                 Powered with 💜 by <strong style="color:#6366F1;">${isAr ? "نيوفيديا للبرمجيات" : "Neovidia for Software"}</strong>
//                             </p>
//                         </td>
//                     </tr>
//                 </table>

//             </td>
//         </tr>
//     </table>

// </body>

// </html>`
// };
const createAcademyMailTemp = ({
  academyName,
  academyNameAr,
  taglineEn,
  taglineAr,
  colors,
  icon = "📖",
}) => {
  return ({ title, otp, text, username = "there", lang = "en" }) => {
    const isAr = lang === "ar";
    const defaultTitle = isAr ? "تفعيل حسابك" : "Verify your account";
    const displayTitle = title || defaultTitle;
    const safeOtp = String(otp ?? "").trim();
    const otpDigits = safeOtp.split("");

    const otpBoxesHtml =
      otpDigits.length > 0
        ? otpDigits
            .map(
              (digit) => `
          <td style="padding:0 6px;">
            <div class="otp-digit-box" style="
              width:50px;
              height:60px;
              background: linear-gradient(145deg, #ffffff, ${colors.soft});
              border: 2px solid ${colors.light};
              border-radius:14px;
              font-size:30px;
              font-weight:800;
              color:${colors.primaryDark};
              line-height:60px;
              text-align:center;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              box-shadow: 0 4px 10px -2px rgba(0,0,0,0.05);
              transition: all 0.2s ease;
            ">${digit}</div>
          </td>
        `
            )
            .join("")
        : "";

    const academyDisplayName = isAr ? academyNameAr : academyName;

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${isAr ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${displayTitle}</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <style>
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Inter', 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes shimmer {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-6px); }
    }

    .animated-card {
      animation: fadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .floating-icon {
      animation: float 3s ease-in-out infinite;
    }

    .otp-digit-box:hover {
      border-color: ${colors.primary} !important;
      transform: scale(1.05);
      box-shadow: 0 8px 16px -4px ${colors.shadow} !important;
    }
    
    .cta-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px -6px ${colors.shadow} !important;
    }

    .feature-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.05) !important;
    }

    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        margin: 0 auto !important;
        border-radius: 16px !important;
      }

      .mobile-padding {
        padding-left: 24px !important;
        padding-right: 24px !important;
      }

      .otp-digit {
        width: 42px !important;
        height: 52px !important;
        font-size: 24px !important;
        line-height: 52px !important;
      }
      
      .features-table td {
        display: block !important;
        width: 100% !important;
        margin-bottom: 12px !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
    }
  </style>
</head>

<body style="margin:0; padding:0; background-color:${colors.soft}; font-family:'Inter', 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">

  <div style="display:none; font-size:1px; color:${colors.soft}; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
    ${
      otp
        ? isAr
          ? `رمز التحقق الخاص بك هو ${safeOtp}. صالح لمدة 10 دقائق.`
          : `Your verification code is ${safeOtp}. Valid for 10 minutes.`
        : displayTitle
    }
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background: linear-gradient(180deg, ${colors.soft} 0%, ${colors.light} 100%); min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 15px;">

        <table role="presentation" class="email-container animated-card" width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px; width:100%; background:#FFFFFF; border-radius:28px; overflow:hidden; box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px ${colors.light};">

          <tr>
            <td style="height:6px; background:linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.accent}, ${colors.primary}); background-size:300% 100%; animation:shimmer 3s ease-in-out infinite;"></td>
          </tr>

          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background:linear-gradient(135deg, ${colors.dark} 0%, ${colors.primaryDark} 50%, ${colors.primary} 100%);">
                <tr>
                  <td style="padding:40px 40px 30px 40px; text-align:center;">
                    <p style="margin:0 0 6px 0; font-size:28px; font-weight:800; color:#FFFFFF; letter-spacing:0.5px;">
                      ${academyDisplayName}
                    </p>

                    <p style="margin:0; font-size:12px; color:${colors.light}; font-weight:600; letter-spacing:2px; text-transform:uppercase; opacity:0.9;">
                      ${isAr ? taglineAr : taglineEn}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="font-size:0; line-height:0;">
                    <svg viewBox="0 0 600 40" style="display:block; width:100%;">
                      <path d="M0,40 L0,20 Q150,0 300,20 T600,20 L600,40 Z" fill="#FFFFFF" />
                    </svg>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="mobile-padding" style="padding:20px 48px 36px 48px;">

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px auto;">
                <tr>
                  <td align="center">
                    <div class="floating-icon" style="
                      width:96px;
                      height:96px;
                      background:linear-gradient(145deg, #ffffff, ${colors.soft});
                      border: 4px solid #ffffff;
                      border-radius:24px;
                      box-shadow: 0 16px 32px -8px ${colors.shadow};
                      text-align:center;
                      line-height:88px;
                    ">
                      <span style="font-size:46px; display:inline-block; vertical-align:middle; line-height:1;">${icon}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 10px 0; font-size:14px; color:${colors.primary}; font-weight:700; text-transform:uppercase; letter-spacing:2px; text-align:center;">
                ${
                  otp
                    ? isAr
                      ? "مطلوب التحقق"
                      : "Verification Required"
                    : isAr
                    ? "مرحباً!"
                    : "Hello!"
                }
              </p>

              <h1 style="margin:0 0 20px 0; font-size:32px; line-height:1.25; color:${colors.dark}; font-weight:800; text-align:center; letter-spacing:-0.5px;">
                ${displayTitle}
              </h1>

              <p style="margin:0 0 32px 0; font-size:16px; line-height:1.8; color:${colors.muted}; text-align:center; padding: 0 10px;">
                ${isAr ? "مرحباً" : "Hi"} <strong style="color:${colors.dark}; font-weight: 700;">${username}</strong>,
                ${
                  otp
                    ? isAr
                      ? `لقد تلقينا طلباً للتحقق من حسابك في ${academyDisplayName}. استخدم الرمز أدناه للمتابعة:`
                      : `we received a request to verify your ${academyDisplayName} account. Use the code below to continue:`
                    : isAr
                    ? `شكراً لوجودك معنا في ${academyDisplayName}.`
                    : `thank you for being with ${academyDisplayName}.`
                }
              </p>

              ${
                otp
                  ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px auto;">
                <tr>
                  <td align="center">
                    <div style="
                      background: linear-gradient(145deg, #ffffff, ${colors.soft}); 
                      border-radius:24px; 
                      padding:32px 24px; 
                      border:1px solid ${colors.light};
                      box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                    ">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                        <tr>
                          ${otpBoxesHtml}
                        </tr>
                      </table>

                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0 auto;">
                        <tr>
                          <td style="background:${colors.light}; padding:10px 20px; border-radius:50px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                            <span style="font-size:13px; color:${colors.primaryDark}; font-weight:700; letter-spacing:0.5px; display:inline-block; vertical-align:middle;">
                              ${isAr ? "⏱️ تنتهي الصلاحية خلال 10 دقائق" : "⏱️ Expires in 10 minutes"}
                            </span>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px auto;">
                <tr>
                  <td style="
                    background:${colors.warningBg}; 
                    border-radius:16px; 
                    padding:18px 24px; 
                    border-left:4px solid ${colors.accent};
                    box-shadow: 0 4px 12px -2px rgba(217, 119, 6, 0.05);
                  ">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right:12px; vertical-align:middle;">
                          <span style="font-size:24px;">🛡️</span>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0; font-size:13px; color:${colors.warningText}; line-height:1.6; font-weight:600;">
                            <strong style="color:${colors.accent}; text-transform:uppercase; font-size:11px; letter-spacing:1px; display:block; margin-bottom:2px;">
                              ${isAr ? "نصيحة أمان:" : "Security Tip:"}
                            </strong>
                            ${
                              isAr
                                ? "لا تشارك هذا الرمز مع أي شخص أبداً. فريقنا لن يطلب منك رمز التحقق الخاص بك."
                                : "Never share this code with anyone. Our team will never ask for your verification code."
                            }
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              `
                  : ""
              }

              ${
                text
                  ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px auto;">
                <tr>
                  <td style="
                    background: linear-gradient(145deg, ${colors.soft}, #ffffff); 
                    border-radius:20px; 
                    padding:24px 30px; 
                    border:1px solid ${colors.light};
                    box-shadow: 0 4px 15px rgba(0,0,0,0.02);
                  ">
                    <p style="margin:0; font-size:15px; color:${colors.primaryDark}; line-height:1.8; text-align:center; font-weight:500;">
                      ${text}
                    </p>
                  </td>
                </tr>
              </table>
              `
                  : ""
              }

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto 0 auto;">
                <tr>
                  <td align="center">
                    <a href="${process.env.FRONTEND_URL || "http://localhost:4200"}/#/" target="_blank" class="cta-btn" style="
                      display:inline-block;
                      padding:18px 44px;
                      background:linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.primaryDark} 100%);
                      border-radius:16px;
                      color:#FFFFFF;
                      text-decoration:none;
                      font-size:16px;
                      font-weight:700;
                      box-shadow:0 12px 30px -8px ${colors.shadow};
                      letter-spacing:0.5px;
                      transition: all 0.2s ease;
                    ">
                      ${isAr ? "الدخول إلى الأكاديمية ←" : "Go to Academy →"}
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td class="mobile-padding" style="padding:0 48px 36px 48px;">
              <table role="presentation" class="features-table" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33%" style="text-align:center; padding:0 8px;">
                    <div class="feature-card" style="
                      background:${colors.soft}; 
                      border-radius:18px; 
                      padding:24px 12px;
                      border:1px solid ${colors.light};
                      transition: all 0.2s ease;
                    ">
                      <span style="font-size:32px; display:block; margin-bottom:8px;">🤲</span>
                      <p style="margin:0; font-size:13px; color:${colors.primaryDark}; font-weight:700;">
                        ${isAr ? "ثقة" : "Trusted"}
                      </p>
                    </div>
                  </td>

                  <td width="33%" style="text-align:center; padding:0 8px;">
                    <div class="feature-card" style="
                      background:${colors.warningBg}; 
                      border-radius:18px; 
                      padding:24px 12px;
                      border:1px solid ${colors.warningBg};
                      transition: all 0.2s ease;
                    ">
                      <span style="font-size:32px; display:block; margin-bottom:8px;">🌙</span>
                      <p style="margin:0; font-size:13px; color:${colors.warningText}; font-weight:700;">
                        ${isAr ? "تعلم مرن" : "Flexible"}
                      </p>
                    </div>
                  </td>

                  <td width="33%" style="text-align:center; padding:0 8px;">
                    <div class="feature-card" style="
                      background:${colors.soft}; 
                      border-radius:18px; 
                      padding:24px 12px;
                      border:1px solid ${colors.light};
                      transition: all 0.2s ease;
                    ">
                      <span style="font-size:32px; display:block; margin-bottom:8px;">📖</span>
                      <p style="margin:0; font-size:13px; color:${colors.primaryDark}; font-weight:700;">
                        ${isAr ? "إتقان" : "Excellence"}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px; background:linear-gradient(90deg, transparent, ${colors.light}, transparent);"></div>
            </td>
          </tr>

          <tr>
            <td style="height:6px; background:linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.accent}, ${colors.primary}); background-size:300% 100%;"></td>
          </tr>

        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0 auto;">
          <tr>
            <td align="center">
              <p style="margin:0; font-size:11px; color:${colors.muted};">
                ${isAr ? "مرسل من" : "Sent by"}
                <strong style="color:${colors.primary};">${academyDisplayName}</strong>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
  };
};



const hedayaMailTemp = createAcademyMailTemp({
  academyName: "Hedaya Academy",
  academyNameAr: "أكاديمية هداية",
  taglineEn: "Guided Learning for a Brighter Future",
  taglineAr: "تعلم بهداية نحو مستقبل أفضل",
  icon: "✨",
  colors: {
    primary: "#0D9488",
    primaryDark: "#115E59",
    secondary: "#059669",
    accent: "#D97706",
    dark: "#0F172A",
    soft: "#F0FDFA",
    light: "#CCFBF1",
    muted: "#64748B",
    warningBg: "#FEF3C7",
    warningText: "#92400E",
    shadow: "rgba(13, 148, 136, 0.25)",
  },
});

export const mailTemp = hedayaMailTemp;