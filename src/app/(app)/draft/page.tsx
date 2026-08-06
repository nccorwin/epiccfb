import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DraftPage from "@/components/draft-page";

export default async function DraftRoutePage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return <DraftPage currentUser={currentUser} />;
}
