import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "cfb_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  lastSeenIp: string | null;
  role: "ADMIN" | "MANAGER";
};

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function createVerificationToken() {
  return randomBytes(32).toString("hex");
}

export function createPasswordResetToken() {
  return randomBytes(32).toString("hex");
}

export function getRequestIp(headers: Headers | undefined) {
  const forwardedFor = headers?.get("x-forwarded-for") ?? "";
  return forwardedFor.split(",")[0]?.trim() || headers?.get("x-real-ip") || "unknown";
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashToken(sessionToken),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });

  if (!session?.user) {
    // Server Components (e.g. page/layout rendering) are not allowed to mutate
    // cookies in Next.js - only Server Actions and Route Handlers can. Attempting
    // to delete a stale/expired session cookie here would throw and crash the
    // page render, so we only clear it when we're in a context that allows it.
    try {
      cookieStore.delete(SESSION_COOKIE_NAME);
    } catch {
      // Ignore: the stale cookie will be cleared next time this runs inside a
      // Server Action or Route Handler (e.g. login/logout).
    }
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    username: session.user.username,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    name: session.user.name,
    lastSeenIp: session.user.lastSeenIp,
    role: session.user.role as "ADMIN" | "MANAGER",
  };
}

export async function createSessionForUser(userId: string, options?: { ipAddress?: string; userAgent?: string }) {
  const token = createSessionToken();
  const cookieStore = await cookies();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      ipAddress: options?.ipAddress ?? null,
      userAgent: options?.userAgent ?? null,
      expiresAt,
    },
  });

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return token;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: hashToken(sessionToken),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
