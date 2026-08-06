import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, clearSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.role === "ADMIN";

  const tabs = [
    { href: "/", label: "Home" },
    { href: "/draft", label: "Draft" },
    { href: "/scoreboard", label: "Scoreboard" },
    { href: "/standings", label: "Standings" },
    { href: "/league-history", label: "League History" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937,_#020617)] text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">College football fantasy</p>
            <h1 className="mt-2 text-2xl font-semibold">League control center</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <nav className="flex flex-wrap gap-2 rounded-full border border-white/10 bg-white/5 p-1">
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={
                    tab.label === "Admin"
                      ? "rounded-full px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-400/10 hover:text-amber-200"
                      : "rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                  }
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
            <form
              action={async () => {
                "use server";
                await clearSession();
                redirect("/login");
              }}
              className="flex items-center"
            >
              <button
                type="submit"
                className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
