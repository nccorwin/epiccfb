'use client';

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "Unable to create your account.");
      setSubmitting(false);
      return;
    }

    setSuccess(payload.message ?? "Check your email to verify your account before signing in.");
    setForm({ firstName: "", lastName: "", username: "", email: "", password: "" });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Member access</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Create your profile</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          <span>First name</span>
          <input
            value={form.firstName}
            onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
            placeholder="First name"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          <span>Last name</span>
          <input
            value={form.lastName}
            onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
            placeholder="Last name"
            required
          />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm text-slate-300">
        <span>Username</span>
        <input
          value={form.username}
          onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
          placeholder="username"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-300">
        <span>Email</span>
        <input
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
          type="email"
          placeholder="member@example.com"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-300">
        <span>Password</span>
        <input
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
          type="password"
          placeholder="Choose a password"
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
        {submitting ? "Creating account..." : "Create account"}
      </button>
      <p className="text-sm text-slate-400">
        Already a member? <a className="text-emerald-400" href="/login">Sign in</a>
      </p>
    </form>
  );
}
