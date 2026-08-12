import nodemailer from "nodemailer";

export type VerificationEmailPayload = {
  to: string;
  firstName: string;
  verificationUrl: string;
};

export type PasswordResetEmailPayload = {
  to: string;
  firstName: string;
  resetUrl: string;
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

export async function sendPasswordResetEmail({ to, firstName, resetUrl }: PasswordResetEmailPayload) {
  const smtpHost = process.env.EMAIL_HOST;
  const smtpPort = Number(process.env.EMAIL_PORT ?? 587);
  const smtpUser = process.env.EMAIL_USER;
  const smtpPass = process.env.EMAIL_PASS;
  const smtpSecure = process.env.EMAIL_SECURE === "true";
  const fromAddress = process.env.EMAIL_FROM ?? "college-football-fantasy@example.com";

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.info(`[auth] Password reset email skipped. To: ${to}`);
    console.info(`[auth] Password reset URL: ${resetUrl}`);
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
    subject: "Reset your College Football Fantasy password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2>Password reset request</h2>
        <p>Hi ${firstName || "there"},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 18px; border-radius: 999px;">
            Reset password
          </a>
        </p>
        <p>This link can only be used once and will expire soon.</p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p>${resetUrl}</p>
      </div>
    `,
  });

  return { delivered: true };
}

export type OnTheClockEmailPayload = {
  to: string;
  firstName: string;
  round: number;
  deadline: Date;
};

export async function sendOnTheClockEmail({ to, firstName, round, deadline }: OnTheClockEmailPayload) {
  const smtpHost = process.env.EMAIL_HOST;
  const smtpPort = Number(process.env.EMAIL_PORT ?? 587);
  const smtpUser = process.env.EMAIL_USER;
  const smtpPass = process.env.EMAIL_PASS;
  const smtpSecure = process.env.EMAIL_SECURE === "true";
  const fromAddress = process.env.EMAIL_FROM ?? "college-football-fantasy@example.com";

  const deadlineLabel = deadline.toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/New_York",
  });

  if (!smtpHost || !smtpUser || !smtpPass) {
        console.info(`[draft] On-the-clock email skipped. To: ${to}`);
        console.info(`[draft] Round: ${round}, Deadline: ${deadlineLabel}`);
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
        subject: `You're on the clock - Round ${round} draft pick`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
            <h2>You're on the clock!</h2>
            <p>Hi ${firstName || "there"},</p>
            <p>It's your turn to make a selection in <strong>Round ${round}</strong> of the draft.</p>
            <p>Your pick is due by:</p>
            <p style="font-size: 18px; font-weight: 600;">${deadlineLabel} (Eastern Time)</p>
            <p>Log in to the app to make your selection before the deadline.</p>
          </div>
        `,
  });

  return { delivered: true };
}
