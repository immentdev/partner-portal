/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FieldProps = {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
};

function Field({
  label,
  name,
  required,
  type = "text",
  placeholder,
  value,
  onChange,
}: FieldProps) {
  return (
    <label className="block space-y-1.5 text-[14px]">
      <span className="font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      />
    </label>
  );
}

export function ReferralForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    company_name: "",
    vat_number: "",
    website: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    product: "",
    relationship_nature: "",
    notes: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          website: form.website || undefined,
          contact_phone: form.contact_phone || undefined,
          product: form.product || undefined,
          relationship_nature: form.relationship_nature || undefined,
          notes: form.notes || undefined,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        code?: string;
        message?: string;
        syncStatus?: string;
      };
      if (!res.ok) {
        setError(json.error || "Invio non riuscito");
        setBusy(false);
        return;
      }
      setSuccess(
        `${json.message ?? "Ok"} Codice: ${json.code}${
          json.syncStatus === "stalled" ? " (in registrazione)" : ""
        }`,
      );
      setBusy(false);
      router.push("/referrals");
      router.refresh();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Errore di rete");
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 p-5 sm:p-6">
      <Field
        label="Ragione sociale startup"
        name="company_name"
        required
        value={form.company_name}
        onChange={(v) => set("company_name", v)}
      />
      <Field
        label="P.IVA"
        name="vat_number"
        required
        placeholder="IT12345678901"
        value={form.vat_number}
        onChange={(v) => set("vat_number", v)}
      />
      <Field
        label="Sito web"
        name="website"
        type="url"
        placeholder="https://"
        value={form.website}
        onChange={(v) => set("website", v)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Referente"
          name="contact_name"
          required
          value={form.contact_name}
          onChange={(v) => set("contact_name", v)}
        />
        <Field
          label="Email referente"
          name="contact_email"
          type="email"
          required
          value={form.contact_email}
          onChange={(v) => set("contact_email", v)}
        />
      </div>
      <Field
        label="Telefono"
        name="contact_phone"
        value={form.contact_phone}
        onChange={(v) => set("contact_phone", v)}
      />
      <Field
        label="Prodotto / servizio"
        name="product"
        value={form.product}
        onChange={(v) => set("product", v)}
      />
      <Field
        label="Natura della relazione"
        name="relationship_nature"
        value={form.relationship_nature}
        onChange={(v) => set("relationship_nature", v)}
      />
      <label className="block space-y-1.5 text-[14px]">
        <span className="font-medium">Note</span>
        <textarea
          name="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="w-full rounded-[var(--radius-control)] border border-[var(--control)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
        />
      </label>

      {error ? (
        <p className="text-[13px] text-[var(--negative)]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-[13px] text-[var(--positive)]" role="status">
          {success}
        </p>
      ) : null}

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Invio…" : "Invia segnalazione"}
      </button>
    </form>
  );
}
