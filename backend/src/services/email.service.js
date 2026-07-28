/**
 * services/email.service.js
 * ส่ง email ด้วย Nodemailer + Gmail
 *
 * Install:
 *   npm install nodemailer
 *
 * .env ที่ต้องเพิ่ม:
 *   GMAIL_USER=youremail@gmail.com
 *   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   ← App Password (ไม่ใช่รหัส Gmail จริง)
 *   FRONTEND_URL=http://localhost:3000
 *
 * วิธีสร้าง App Password:
 *   1. myaccount.google.com → Security → 2-Step Verification (ต้องเปิดก่อน)
 *   2. App passwords → สร้างใหม่ → Copy 16 หลัก
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * ส่ง Reset Password Email
 * @param {string} toEmail  - อีเมลผู้รับ
 * @param {string} username - ชื่อผู้ใช้
 * @param {string} token    - reset token
 */
const sendResetPasswordEmail = async (toEmail, username, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .header { background: #2563eb; padding: 32px 24px; text-align: center; }
        .header h1 { color: #fff; margin: 0; font-size: 22px; }
        .body { padding: 32px 24px; color: #333; }
        .body p { line-height: 1.7; margin: 0 0 16px; }
        .btn { display: inline-block; background: #2563eb; color: #fff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 8px 0 24px; }
        .note { font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 16px; }
        .footer { background: #f9f9f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #aaa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏠 SDMS</h1>
        </div>
        <div class="body">
          <p>สวัสดี <strong>${username}</strong>,</p>
          <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>

          <div style="text-align:center">
            <a href="${resetLink}" class="btn">ตั้งรหัสผ่านใหม่</a>
          </div>

          <p class="note">
            ⏱ ลิงก์นี้จะหมดอายุใน <strong>15 นาที</strong><br>
            หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน สามารถเพิกเฉยอีเมลนี้ได้เลย
          </p>
        </div>
        <div class="footer">
          SDMS — ระบบบริหารจัดการหอพัก
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"SDMS" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: '🔐 รีเซ็ตรหัสผ่าน SDMS',
    html,
  });
};

module.exports = { sendResetPasswordEmail };