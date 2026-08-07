import { NextResponse } from "next/server";
import { createSessionForUser, getRequestIp, hashPassword, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const token = String(body?.token ?? "").trim();
  const password = String(body?.password ?? "");

  if (!token || !password) {
    return NextResponse.json({ error: "Token and new password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const passwordResetTokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash,
      passwordResetTokenExpiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    }),
    prisma.session.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  const ipAddress = getRequestIp(request.headers);
  await createSessionForUser(user.id, {
    ipAddress,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ message: "Password updated successfully." });
}
