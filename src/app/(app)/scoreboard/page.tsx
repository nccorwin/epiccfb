import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ScoreboardPage from "@/components/scoreboard-page";

export default async function ScoreboardRoutePage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return <ScoreboardPage />;
}
