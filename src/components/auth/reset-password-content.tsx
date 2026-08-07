'use client';

import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("The reset link is missing its token.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "Unable to reset password.");
      setSubmitting(false);
      return;
    }

    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937,_#020617)] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-8">
        <div className="max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">College football fantasy</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Set a new password</h1>
          <p className="mt-3 text-base leading-7 text-slate-300">
            Enter your new password below. Once submitted, you&apos;ll be signed in and redirected to your homepage.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="w-full space-y-4 rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>New password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
              type="password"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>Confirm new password</span>
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
              type="password"
              placeholder="Re-enter password"
              minLength={8}
              required
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {submitting ? "Updating password..." : "Save new password"}
          </button>
          <p className="text-sm text-slate-400">
            Need a different reset link? <a className="text-emerald-400" href="/forgot-password">Request another one</a>
          </p>
        </form>
      </div>
    </main>
  );
}
