import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import HomePage from "@/components/home-page";

export default async function AppHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <HomePage
      currentUser={{
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
      }}
    />
  );
}
