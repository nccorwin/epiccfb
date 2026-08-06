'use client';

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "Unable to sign in.");
      setSubmitting(false);
      return;
    }

    router.replace("/");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Member access</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Log in</h2>
      </div>
      <label className="flex flex-col gap-2 text-sm text-slate-300">
        <span>Email</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
          type="email"
          placeholder="member@example.com"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-300">
        <span>Password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
          type="password"
          placeholder="your password"
          required
        />
      </label>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>
      <p className="text-sm text-slate-400">
        New to the league? <a className="text-emerald-400" href="/signup">Create an account</a>
      </p>
    </form>
  );
}



