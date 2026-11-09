/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MfaForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setMessage(error.message);
        return;
      }
      const totp = data.totp[0];
      if (!totp) {
        setMessage(
          "Nessun fattore TOTP configurato. Contatta il Super Admin per l'enrollment.",
        );
        return;
      }
      setFactorId(totp.id);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setBusy(false);
      setMessage(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    setBusy(false);
    if (verifyError) {
      setMessage(verifyError.message);
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
        <span>Codice a 6 cifre</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-control border border-trust-dark/15 px-3 py-2 tracking-widest outline-none focus:border-trust"
        />
      </label>
      {message ? (
        <p className="text-sm text-equity" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !factorId}
        className="w-full rounded-control bg-trust-dark px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Verifica…" : "Conferma"}
      </button>
    </form>
  );
}
