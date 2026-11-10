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
    <form onSubmit={onSubmit} className="panel space-y-4 p-5 sm:p-6">
      <label className="block space-y-1.5 text-[14px]">
        <span className="font-medium">Codice a 6 cifre</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="field-input tracking-[0.35em]"
        />
      </label>
      {message ? (
        <p className="text-[13px] text-[var(--negative)]" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !factorId}
        className="btn-primary w-full"
      >
        {busy ? "Verifica…" : "Conferma"}
      </button>
    </form>
  );
}
