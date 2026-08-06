import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import StandingsPage from "@/components/standings-page";

export default async function StandingsRoutePage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return <StandingsPage />;
}
