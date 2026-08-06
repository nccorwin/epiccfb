import { Suspense } from "react";
import VerifyEmailContent from "@/components/auth/verify-email-content";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937,_#020617)] px-4 py-10 text-slate-100 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-xl items-center justify-center rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl shadow-black/30"><p className="text-base text-slate-300">Preparing verification...</p></div></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
