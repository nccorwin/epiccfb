import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const teams = await prisma.team.findMany({
    include: {
      conference: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(teams);
}
