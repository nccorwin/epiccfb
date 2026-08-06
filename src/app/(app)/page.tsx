import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import HomePage from "@/components/home-page";

export default async function AppHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <HomePage currentUserId={user.id} />;
}
