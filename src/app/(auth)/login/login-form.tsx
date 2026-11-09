/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({
  nextPath,
  error,
}: {
  nextPath?: string;
  error?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(error ?? "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (signError) {
      setMessage(signError.message);
      return;
    }

    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      router.replace(`/login/mfa?next=${encodeURIComponent(nextPath || "/")}`);
      return;
    }

    router.replace(nextPath || "/");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-card bg-white p-6 shadow-soft"
    >
      <label className="block space-y-1 text-sm">
        <span>Email</span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-control border border-trust-dark/15 px-3 py-2 outline-none focus:border-trust"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-control border border-trust-dark/15 px-3 py-2 outline-none focus:border-trust"
        />
      </label>
      {message ? (
        <p className="text-sm text-equity" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-control bg-trust-dark px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Accesso…" : "Accedi"}
      </button>
    </form>
  );
}
