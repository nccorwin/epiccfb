import LoginForm from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937,_#020617)] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-8">
        <div className="max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">College football fantasy</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Welcome back</h1>
          <p className="mt-3 text-base leading-7 text-slate-300">
            Sign in to access the league draft board, the weekly scoreboard, and the standings dashboard.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
