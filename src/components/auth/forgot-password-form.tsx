'use client';

import { type FormEvent, useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "Unable to process your request.");
      setSubmitting(false);
      return;
    }

    setSuccess(payload.message ?? "If your account exists, you will receive a reset email shortly.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Member access</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Forgot password</h2>
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
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        {submitting ? "Sending..." : "Send reset link"}
      </button>
      <p className="text-sm text-slate-400">
        Remembered your password? <a className="text-emerald-400" href="/login">Sign in</a>
      </p>
    </form>
  );
}
