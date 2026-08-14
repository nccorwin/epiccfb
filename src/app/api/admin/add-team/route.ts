import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Admin-only tool to add a team that is missing from the database (e.g. a
 * school that was never seeded, or is otherwise unavailable in draft/roster
 * dropdowns). Attaches the team to an existing conference by id. Idempotent:
 * if a team with the same (case-insensitive) name already exists, this
 * returns a conflict instead of creating a duplicate.
 */
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body?.name ?? "").trim();
  const conferenceId = String(body?.conferenceId ?? "").trim();
  const isFcs = Boolean(body?.isFcs);

  if (!name || !conferenceId) {
    return NextResponse.json({ error: "name and conferenceId are required." }, { status: 400 });
  }

  const conference = await prisma.conference.findUnique({ where: { id: conferenceId } });
  if (!conference) {
    return NextResponse.json({ error: "Conference not found." }, { status: 404 });
  }

  const existing = await prisma.team.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: `A team named "${existing.name}" already exists.` }, { status: 409 });
  }

  const team = await prisma.team.create({
    data: {
      name,
      shortName: name.slice(0, 24),
      schoolSlug: toSlug(name),
      conferenceId,
      isFcs,
    },
    include: { conference: true },
  });

  return NextResponse.json({ team });
}
