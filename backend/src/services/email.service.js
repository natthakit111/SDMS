/**
 * services/email.service.js
 * ส่ง email ด้วย SendGrid (HTTPS API)
 *
 * ⚠️ เดิมใช้ Nodemailer ส่งตรงผ่าน Gmail SMTP (port 465) แต่ Railway บล็อก
 * outbound SMTP port ทั้ง IPv4/IPv6 (ยืนยันจาก production log: connection
 * timeout เต็ม 2 นาทีทุกครั้งไม่ว่าจะบังคับ IPv4 หรือไม่ — เป็น policy
 * ระดับ platform กันสแปม ไม่มีทาง config ฝั่ง client แก้ได้) เปลี่ยนมาใช้
 * SendGrid ผ่าน HTTPS (port 443) แทน เพราะไม่มี platform ไหนบล็อก
 *
 * .env ที่ต้องเพิ่ม:
 *   SENDGRID_API_KEY=SG.xxxxxxxx
 *   SENDGRID_FROM_EMAIL=xxxxx@gmail.com   ← ต้อง verify ผ่าน SendGrid
 *                                            Single Sender Verification ก่อน
 *   FRONTEND_URL=http://localhost:3000
 *
 * วิธีตั้งค่า SendGrid:
 *   1. sendgrid.com → สมัครฟรี (100 อีเมล/วัน)
 *   2. Settings → Sender Authentication → Verify a Single Sender →
 *      กรอกอีเมลที่จะใช้ส่ง → กดลิงก์ยืนยันในอีเมลนั้น
 *   3. Settings → API Keys → Create API Key → Restricted Access →
 *      เปิดสิทธิ์ Mail Send เท่านั้น → copy key
 */

const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
          SDMS — ระบบบริหารจัดการหอพักและแจ้งเตือนอัตโนมัติ
        </div>
      </div>
    </body>
    </html>
  `;

  await sgMail.send({
    to: toEmail,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: 'SDMS' },
    subject: '🔐 รีเซ็ตรหัสผ่าน SDMS',
    html,
  });
};

module.exports = { sendResetPasswordEmail };
