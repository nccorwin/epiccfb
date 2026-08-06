import { NextResponse } from "next/server";
import { createVerificationToken, hashPassword, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  const body = await request.json();
  const firstName = String(body?.firstName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const username = String(body?.username ?? "").trim().toLowerCase();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!firstName || !lastName || !username || !email || !password) {
    return NextResponse.json({ error: "Please complete every field." }, { status: 400 });
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
  }

  const existingUsername = username ? await prisma.user.findUnique({ where: { username } }) : null;
  if (existingUsername) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = createVerificationToken();
  const verificationTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      username,
      email,
      passwordHash,
      name: `${firstName} ${lastName}`.trim(),
      emailVerified: false,
      verificationTokenHash: hashToken(verificationToken),
      verificationTokenExpiresAt,
    },
  });

  await prisma.leagueHistoryEntry.updateMany({
    where: {
      userId: null,
      firstName: {
        equals: firstName,
        mode: "insensitive",
      },
      lastName: {
        equals: lastName,
        mode: "insensitive",
      },
    },
    data: {
      userId: user.id,
    },
  });

  const origin = new URL(request.url).origin;
  const verificationUrl = `${origin}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  await sendVerificationEmail({
    to: user.email,
    firstName: user.firstName ?? firstName,
    verificationUrl,
  });

  return NextResponse.json({
    message: "Check your email to verify your account before signing in.",
    verificationUrl: process.env.NODE_ENV !== "production" ? verificationUrl : undefined,
  });
}
