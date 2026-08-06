import nodemailer from "nodemailer";

export type VerificationEmailPayload = {
  to: string;
  firstName: string;
  verificationUrl: string;
};

export async function sendVerificationEmail({ to, firstName, verificationUrl }: VerificationEmailPayload) {
  const smtpHost = process.env.EMAIL_HOST;
  const smtpPort = Number(process.env.EMAIL_PORT ?? 587);
  const smtpUser = process.env.EMAIL_USER;
  const smtpPass = process.env.EMAIL_PASS;
  const smtpSecure = process.env.EMAIL_SECURE === "true";
  const fromAddress = process.env.EMAIL_FROM ?? "college-football-fantasy@example.com";

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.info(`[auth] Verification email skipped. To: ${to}`);
    console.info(`[auth] Verification URL: ${verificationUrl}`);
    return { delivered: false, reason: "smtp-not-configured" as const };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: "Verify your College Football Fantasy account",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2>Welcome to College Football Fantasy</h2>
        <p>Hi ${firstName || "there"},</p>
        <p>Thanks for signing up. Please verify your account by clicking the button below:</p>
        <p>
          <a href="${verificationUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 18px; border-radius: 999px;">
            Verify account
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p>${verificationUrl}</p>
      </div>
    `,
  });

  return { delivered: true };
}
