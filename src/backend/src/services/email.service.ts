import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create minimal reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  service: 'gmail', // Standard fallback, user can configure process.env.SMTP_SERVICE
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'hello.hublet@gmail.com', // Replace with real one in production env
    pass: process.env.SMTP_PASS || 'dummy-password'
  },
});

/**
 * Super minimalistic email sender for matches
 */
export const sendMatchEmail = async (
  to: string,
  userName: string,
  isBuyer: boolean,
  matchCount: number
) => {
  try {
    const role = isBuyer ? 'properties' : 'buyers';
    const textMessage = `Hi ${userName},\n\nWe found ${matchCount} new ${role} that match your preferences perfectly.\n\nLog in to Hublet to check them out.\n\nBest,\nThe Hublet Team`;
    
    // For MVP, if there's no actual SMTP configured, just log to prevent crashes
    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@example.com') {
      console.log(`[SMTP Mock] Sent email to ${to}: ${matchCount} new matches found.`);
      return true;
    }

    const mailOptions = {
      from: `"Hublet Notifications" <${process.env.SMTP_USER}>`,
      to,
      subject: `New Matches Found on Hublet! 🎉`,
      text: textMessage,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <h2 style="color: #2F80ED; font-weight: 500;">Good news, ${userName}!</h2>
          <p style="font-size: 16px;">We found <strong>${matchCount}</strong> new ${role} that match your criteria perfectly.</p>
          <br/>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="background-color: #2F80ED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Matches</a>
          <br/><br/>
          <p style="font-size: 14px; color: #777;">Best,<br/>The Hublet Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP] Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[SMTP Error] Failed to send email to ${to}:`, error);
    return false;
  }
};
