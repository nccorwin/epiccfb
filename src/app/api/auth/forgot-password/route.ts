import { NextResponse } from "next/server";
import { createPasswordResetToken, hashToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60;

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({
      message: "If that email exists in our system, a password reset link has been sent.",
    });
  }

  const resetToken = createPasswordResetToken();
  const resetTokenHash = hashToken(resetToken);
  const resetTokenExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: resetTokenHash,
      passwordResetTokenExpiresAt: resetTokenExpiresAt,
    },
  });

  const origin = new URL(request.url).origin;
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(resetToken)}`;
  await sendPasswordResetEmail({
    to: user.email,
    firstName: user.firstName ?? user.name ?? "there",
    resetUrl,
  });

  return NextResponse.json({
    message: "If that email exists in our system, a password reset link has been sent.",
    resetUrl: process.env.NODE_ENV !== "production" ? resetUrl : undefined,
  });
}
