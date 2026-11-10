import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ScoreboardPage from "@/components/scoreboard-page";

export default async function ScoreboardRoutePage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return (
    <ScoreboardPage
      currentUser={{
        id: currentUser.id,
        email: currentUser.email,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        name: currentUser.name,
      }}
    />
  );
}
