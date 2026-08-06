import { NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    return NextResponse.json({ error: "Verification token is required." }, { status: 400 });
  }

  const verificationTokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: {
      verificationTokenHash,
      verificationTokenExpiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "This verification link is invalid or has expired." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verifiedAt: new Date(),
      verificationTokenHash: null,
      verificationTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ message: "Your account has been verified successfully." });
}
