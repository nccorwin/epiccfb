import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LeagueHistoryPage from "@/components/league-history-page";

export default async function LeagueHistoryRoutePage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return <LeagueHistoryPage />;
}
