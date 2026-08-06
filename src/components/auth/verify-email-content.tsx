'use client';

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your account...");

  useEffect(() => {
    let cancelled = false;

    async function verifyAccount() {
      if (!token) {
        setStatus("error");
        setMessage("The verification link is missing its token.");
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
        const payload = await response.json().catch(() => ({}));

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setStatus("error");
          setMessage(payload.error ?? "We could not verify your account.");
          return;
        }

        setStatus("success");
        setMessage(payload.message ?? "Account Verified!");
        window.setTimeout(() => {
          router.replace("/login");
        }, 1600);
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "We could not verify your account.");
        }
      }
    }

    void verifyAccount();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937,_#020617)] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl shadow-black/30">
        <div className={`mb-4 h-14 w-14 rounded-full ${status === "success" ? "bg-emerald-500/20" : status === "error" ? "bg-rose-500/20" : "bg-slate-700/40"} flex items-center justify-center`}>
          <span className={`text-2xl font-semibold ${status === "success" ? "text-emerald-300" : status === "error" ? "text-rose-300" : "text-slate-300"}`}>
            {status === "success" ? "✓" : status === "error" ? "!" : "…"}
          </span>
        </div>
        <h1 className="text-3xl font-semibold text-white">
          {status === "success" ? "Account Verified!" : status === "error" ? "Verification issue" : "Checking your verification link"}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-300">{message}</p>
        {status === "success" ? (
          <p className="mt-4 text-sm text-slate-400">You&apos;ll be sent to the login page shortly.</p>
        ) : null}
      </div>
    </main>
  );
}
