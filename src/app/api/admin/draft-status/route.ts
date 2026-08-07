import { NextResponse } from "next/server";
import { UserRole, type Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PICK_WINDOW_MS = 48 * 60 * 60 * 1000;

type DraftStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";

function getSettingsObject(settings: Prisma.JsonValue | null) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {} as Record<string, Prisma.JsonValue>;
  }

  return settings as Record<string, Prisma.JsonValue>;
}

function getDraftStatus(settings: Prisma.JsonValue | null): DraftStatus {
  const value = getSettingsObject(settings).draftStatus;
  if (value === "IN_PROGRESS" || value === "PAUSED" || value === "COMPLETED") {
    return value;
  }
  return "NOT_STARTED";
}

function getCurrentPickStartedAt(settings: Prisma.JsonValue | null) {
  const value = getSettingsObject(settings).currentPickStartedAt;
  return typeof value === "string" ? value : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueId = String(searchParams.get("leagueId") ?? "").trim();

  if (!leagueId) {
    return NextResponse.json({ error: "leagueId is required." }, { status: 400 });
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, settings: true },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const draftStatus = getDraftStatus(league.settings);
  const currentPickStartedAt = getCurrentPickStartedAt(league.settings);
  const currentPickDeadlineAt =
    draftStatus === "IN_PROGRESS" && currentPickStartedAt
      ? new Date(new Date(currentPickStartedAt).getTime() + PICK_WINDOW_MS).toISOString()
      : null;

  return NextResponse.json({
    leagueId: league.id,
    draftStatus,
    currentPickStartedAt,
    currentPickDeadlineAt,
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json();
  const leagueId = String(body?.leagueId ?? "").trim();
  const action = String(body?.action ?? "").trim().toLowerCase();

  if (!leagueId) {
    return NextResponse.json({ error: "leagueId is required." }, { status: 400 });
  }

  if (!action || !["start", "pause", "resume"].includes(action)) {
    return NextResponse.json({ error: "action must be one of: start, pause, resume." }, { status: 400 });
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      leagueUsers: true,
      draftPicks: true,
    },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const currentStatus = getDraftStatus(league.settings);
  const pickCapacity = league.leagueUsers.length * 10;
  if (pickCapacity === 0) {
    return NextResponse.json({ error: "Cannot start draft without league managers." }, { status: 409 });
  }

  if (league.draftPicks.length >= pickCapacity) {
    return NextResponse.json({ error: "Draft is already complete." }, { status: 409 });
  }

  if (action === "start" && currentStatus !== "NOT_STARTED") {
    return NextResponse.json({ error: "Draft already started. Use pause/resume." }, { status: 409 });
  }

  if (action === "pause" && currentStatus !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Draft can only be paused while in progress." }, { status: 409 });
  }

  if (action === "resume" && currentStatus !== "PAUSED") {
    return NextResponse.json({ error: "Draft can only resume from paused state." }, { status: 409 });
  }

  const settings = getSettingsObject(league.settings);
  const draftStatus: DraftStatus = action === "pause" ? "PAUSED" : "IN_PROGRESS";
  const currentPickStartedAt = action === "pause" ? null : new Date().toISOString();
  const nextSettings = {
    ...settings,
    draftStatus,
    currentPickStartedAt,
  };

  const updatedLeague = await prisma.league.update({
    where: { id: leagueId },
    data: { settings: nextSettings },
    select: { id: true, settings: true },
  });

  return NextResponse.json({
    leagueId: updatedLeague.id,
    draftStatus,
    currentPickStartedAt,
    currentPickDeadlineAt:
      draftStatus === "IN_PROGRESS" && currentPickStartedAt
        ? new Date(new Date(currentPickStartedAt).getTime() + PICK_WINDOW_MS).toISOString()
        : null,
  });
}
