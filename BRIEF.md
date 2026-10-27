# Partner Portal BAC × Imment: brief di sviluppo per Cursor

Versione 0.1 del 27/10/2026. Fonte funzionale: specifica «Portale Partner BAC × Imment», in Claude Docs.
Repo: `immentdev/partner-portal`. Deploy: Netlify. Database e auth: Supabase.

Questo file va nella root del repo (`BRIEF.md`) e Cursor lo legge prima di ogni task.
La migrazione iniziale è in `supabase/migrations/0001_init.sql`. È già stata provata su Postgres 16: separazione dei territori, permessi sulle colonne e log di audit in sola aggiunta funzionano.

---

## 1. Cosa costruiamo

Il portale permette a ogni BAC (Business Angel Club) di inviare segnalazioni di startup a Imment e di verificare in autonomia, per ciascuna, lo stato commerciale e la fee. Imment continua a lavorare solo su Mokapen, il CRM. Il portale crea il deal su Mokapen e poi ne legge i cambi di fase.

**Controparte unica:** l'Associazione Business Angel Club, cioè il BAC Nazionale. I 20 BAC Locali segnalano per suo conto. Imment versa le fee solo all'Associazione, e al territorio spetta un'attribuzione di budget interna.

### Principi non negoziabili

1. **Fonte unica per ogni dato.** Segnalazione, territorio, liquidazioni e attribuzioni stanno nel portale. Fase del deal e «Fee partner» stanno su Mokapen. Il portale non ricalcola mai la fee.
2. **Separazione tra territori garantita dal database** (Row Level Security di Supabase), non dai filtri dell'interfaccia.
3. **Letture lato client tramite RLS. Scritture solo lato server**, con la service role key, dopo il controllo del ruolo nel codice. Per `authenticated` non esistono policy di insert, update o delete.
4. **Il BAC non vede mai** importi di contratto, fasi grezze di Mokapen, preventivi o fatture. Questo è imposto con permessi sulle colonne, già presenti nella migrazione.
5. **Nessun errore silenzioso.** Ogni fallimento di integrazione apre una riga in `anomalies` e invia una email.
6. **Log di audit in sola aggiunta**, per ogni ruolo. Un trigger blocca update e delete.

---

## 2. Stack

| Livello | Scelta | Motivo |
| --- | --- | --- |
| Frontend e API | Next.js 14 (App Router) + TypeScript + Tailwind | Pagine server-side, route handler per le scritture, un solo deploy |
| Auth e DB | Supabase (`@supabase/ssr`) | RLS, MFA TOTP nativo, stesso stack di Nursery AFC e Smart Compliance |
| Hosting | Netlify (runtime Next.js) | Già in uso, Scheduled Functions per i job notturni |
| Email | Resend | Già in uso nel dataroom |
| Validazione | Zod | Schemi condivisi tra form e route handler |

Le variabili d'ambiente vanno impostate su Netlify e non vanno mai committate:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only
MOKAPEN_CLIENT_ID=
MOKAPEN_CLIENT_SECRET=
MOKAPEN_ORG_ID=
MOKAPEN_ACCESS_TOKEN=               # client credentials, durata circa 1 anno
MOKAPEN_PARTNER_PIPELINE_ID=585
MOKAPEN_WEBHOOK_SECRET=             # segmento segreto nell'URL del webhook
RESEND_API_KEY=
APP_BASE_URL=
```

---

## 3. Struttura del repo

```
partner-portal/
  BRIEF.md
  supabase/migrations/0001_init.sql
  src/
    app/
      (auth)/login/            # email + password, step MFA
      (bac)/referrals/         # elenco + dettaglio, BAC Locale e Nazionale
      (bac)/referrals/new/     # form segnalazione
      (bac)/territories/       # riepilogo per territorio, solo Nazionale
      (bac)/statements/        # rendiconti, solo Nazionale
      (admin)/admin/           # coda validazione, deal da collegare, anomalie, utenti, sync
      api/
        referrals/route.ts     # POST: crea il referral e lo crea su Mokapen
        webhooks/mokapen/[secret]/route.ts
        admin/...              # collegamento deal, utenti, pagamenti, rendiconti
    lib/
      supabase/{client,server,admin}.ts
      mokapen/{client,deals,contacts,companies,tasks,webhooks}.ts
      domain/{macrostate,eligibility,fees,anomalies}.ts
      audit.ts
      email/
    components/
  netlify/functions/
    reconcile-nightly.mts      # schedule: ogni notte alle 02:00
    sla-check.mts              # schedule: ogni giorno feriale alle 08:00
  scripts/
    mokapen-smoke-test.ts      # fase 0
```

---

## 4. Ruoli

| Ruolo (`app_role`) | Chi | Accesso |
| --- | --- | --- |
| `super_admin` | Giuseppe (IT) | Tutto, più la gestione degli `imment_admin`, i segreti, i webhook, le migrazioni e il deploy. MFA obbligatoria |
| `super_admin` + `is_emergency` | admin@imment.it | Account di emergenza. A ogni login parte una email di avviso al Super Admin e una riga nel log di audit |
| `imment_admin` | Responsabile PP, amministrazione | Collegamento dei deal, anomalie, utenti BAC, pagamenti. MFA obbligatoria |
| `bac_nazionale` | 2–3 referenti | Tutti i territori della propria organizzazione, approvazione dei rendiconti, attribuzioni. MFA obbligatoria |
| `bac_locale` | circa 30 coordinatori | Solo il proprio territorio: invio delle segnalazioni, consultazione, contestazioni |

- **MFA:** usare Supabase MFA (TOTP). Il middleware blocca le route `(admin)` e quelle del Nazionale se la sessione non ha `aal2`.
- **Niente registrazione libera.** Gli utenti si invitano con `auth.admin.inviteUserByEmail` da route admin. Gli account `imment_admin` li può invitare solo un `super_admin`.

---

## 5. Integrazione Mokapen

Documentazione: https://mokapen.com/it/docs/api. Il file OpenAPI è `https://mokapen.com/docs?api-docs.json`: va scaricato e usato per generare i tipi.

- **Base URL:** `https://mokapen.com/api/v1/{MOKAPEN_ORG_ID}/`
- **Autenticazione:** private app con client credentials (`POST https://mokapen.com/oauth/token`). Bearer token.
- **Scope:** `deals.read`, `deals.write`, `contacts.write`, `companies.read`, `companies.write`, `tasks.write`
- **Limiti:** nessuna quota giornaliera sul piano Imment, 60 richieste al minuto. Implementare retry con backoff sugli errori 429.

### Fasi della pipeline Partner (id 585) e macrostati

| Fase Mokapen | `macrostate` | Effetto nel portale |
| --- | --- | --- |
| Nuovo lead | `in_valutazione` | Nessuno |
| Accettato | `in_valutazione` | `referrals.outcome = accepted`, `outcome_at`, `window_end = outcome_at + 12 mesi` |
| Rifiutato | `non_accettato` | `outcome = rejected` |
| Opportunità esistente | `non_accettato` | `outcome = existing` |
| Contratto mandato | `proposta_inviata` | Nessuno |
| Chiuso vinto | `incarico_attivo` | `signed_at`, calcolo di `eligible` |
| Chiuso perso | `chiuso_non_acquisito` | Nessuno |
| Fatturato | `incarico_attivo` | Nessuno |
| Incassato | `incarico_attivo` | `cashed_at`: la fee passa da prevista a maturata |

- La mappatura va in `lib/domain/macrostate.ts`, come costante indicizzata per **id di fase**, non per nome. Gli id si leggono via API in fase 0.
- Se un deal esce da Incassato, si azzera `cashed_at` e si apre l'anomalia `stage_regression`.
- **Fee:** è il campo Mokapen «Fee partner», oggi chiamato «Importo success fee», calcolato da Mokapen come 10% dell'importo netto. Il portale lo legge e non lo ricalcola.
- **Eleggibilità:** `eligible = signed_at <= referral.window_end`. Se il deal non è ancora firmato, `eligible` è null.

### Creazione al momento della segnalazione (`POST /api/referrals`)

Replica l'automazione del form pubblico Partner Program:

1. Validazione con Zod. Il territorio e l'organizzazione si leggono dal profilo, mai dal body della richiesta.
2. Controllo duplicati su P.IVA: nel portale (`referrals.vat_number`) e su Mokapen (ricerca azienda). Se c'è un riscontro, la segnalazione si crea comunque e si apre l'anomalia `possible_duplicate`.
3. Su Mokapen:
    - creare o riusare l'azienda segnalata;
    - creare il contatto referente;
    - creare il deal nella pipeline 585, fase Nuovo lead, con il partner (l'Associazione BAC, cioè `partner_orgs.mokapen_company_id`), il contatto segnalatore (`profiles.mokapen_contact_id`), il prodotto e la natura della relazione;
    - scrivere nel deal il codice referral e il codice territorio;
    - creare un task per la Responsabile PP.
4. Salvare `referral_deals` con `is_primary = true`, scrivere il log di audit e inviare una email di conferma al segnalatore.
5. Se Mokapen fallisce, il referral resta salvato, si apre un'anomalia `sync_stalled` e un retry automatico riprova. L'utente vede «inviata, in registrazione».

### Webhook (`/api/webhooks/mokapen/[secret]`)

- Registrazione via `POST /api/webhooks` con gli eventi `deal.created` e `deal.updated`.
- Si verifica il segmento `secret` dell'URL. Se non corrisponde, la risposta è 404 e la chiamata viene registrata nel log.
- **Il payload non va considerato attendibile.** Dal payload si prende solo l'id del deal, poi il deal si rilegge con `GET` e da lì si aggiornano fase, importo, fee e date.
- Ogni cambio di fase scrive una riga in `deal_stage_events` e una in `audit_log`. Se cambia il macrostato, parte una email al BAC Locale.
- Un `deal.created` su un'azienda già collegata a un referral attivo apre l'anomalia `unlinked_deal`. Non si collega in automatico: lo fa l'admin.

### Riconciliazione notturna

Rilegge tutti i deal collegati a referral non chiusi, riallinea le differenze, apre le anomalie e scrive `last_synced_at`. Se in 7 giorni non arriva nessun webhook, apre l'anomalia `sync_stalled`.

---

## 6. Schermate per ruolo

**BAC Locale**
- Elenco referral: codice, startup, data, macrostato, ultimo aggiornamento, fee prevista, fee maturata, fee liquidata. Dove la fee è zero si scrive «nessuna fee maturata».
- Dettaglio: cronologia dei macrostati (`deal_stage_events`), deal collegati con eleggibilità, scadenza della finestra, pulsante «apri contestazione».
- Form di nuova segnalazione.

**BAC Nazionale**
- Tutto quello che vede il Locale, per tutti i territori, con filtri per territorio, macrostato e periodo.
- Riepilogo per territorio: referral inviati, accettati, convertiti, fee maturata, liquidata e da liquidare.
- Rendiconti trimestrali da approvare, pagamenti ricevuti, attribuzione ai territori.

**Admin Imment e Super Admin**
- Anomalie aperte, con assegnatario e scadenza.
- Collegamento di un deal successivo a un referral: si sceglie tra i deal Mokapen della stessa azienda.
- Utenti e territori. La gestione degli admin è riservata al Super Admin.
- Rendiconti: generazione e registrazione dei pagamenti.
- Stato della sincronizzazione: ultimo webhook ricevuto, ultima riconciliazione, errori. Visibile solo al Super Admin.

**Footer di tutte le pagine:** «Powered by Imment · Progettato e sviluppato da Giuseppe Pistoia · © Imment S.r.l.». Inoltre `<meta name="author" content="Giuseppe Pistoia">`, intestazione nei file sorgente e credito nel README.

**Brand Imment**
- Font: Inter Tight per il testo, Syne per gli accenti.
- Colori: Trust Blue `#5195FF`, Trust Blue Dark `#0E2D54`, Equity Magenta `#D30083`, Signal Teal `#05D8C8`.
- Raggi: 8px per le card, 4px per input e pulsanti. Ombra: `0 2px 8px rgba(14,45,84,0.08)`.
- Su tutte le pagine `noindex, nofollow`.

---

## 7. Alert

| Tipo | Quando | Destinatari |
| --- | --- | --- |
| `sla_validation` | Il referral è ancora in Nuovo lead dopo 5 giorni lavorativi | Responsabile PP, in copia il BAC Nazionale |
| `possible_duplicate` | La P.IVA è già presente | Responsabile PP |
| `unlinked_deal` | Nuovo deal su un'azienda collegata a un referral attivo | Admin |
| `deal_out_of_window` | Deal collegato firmato dopo `window_end` | Admin |
| `fee_decreased` | La fee è diminuita dopo l'incasso | Admin, BAC Nazionale |
| `fee_unpaid` | Fee maturata e non liquidata a fine trimestre | Amministrazione Imment |
| `sync_stalled` | Webhook assente o riconciliazione fallita | Super Admin |
| `stage_regression` | Il deal è uscito da Incassato | Admin |
| `dispute` | Contestazione aperta da un BAC | Admin, BAC Nazionale |

---

## 8. Ordine di sviluppo e criteri di accettazione

**Fase 0: smoke test Mokapen** (`scripts/mokapen-smoke-test.ts`)
- [ ] Il token si ottiene con client credentials.
- [ ] Lettura della pipeline 585, con elenco degli id di fase.
- [ ] Il campo «Fee partner» del deal è leggibile e se ne conosce la chiave.
- [ ] La ricerca dell'azienda per P.IVA è possibile (endpoint e filtro).
- [ ] Creazione di un deal di test nella pipeline 585, con task.
- [ ] Spostando il deal di fase arriva `deal.updated` (verificare su un tunnel o su un deploy preview).

**Fase 1: fondamenta**
- [ ] Migrazione applicata. Seed con l'Associazione BAC, 2 territori pilota e gli utenti di test.
- [ ] Login, MFA e middleware dei ruoli.
- [ ] Test RLS automatici: il territorio A non vede B, né via UI né via API Supabase; un BAC non legge `deal_amount`.

**Fase 2: segnalazione**
- [ ] Form, route `POST /api/referrals` e creazione completa su Mokapen.
- [ ] Controllo duplicati e anomalia, email di conferma, log di audit.

**Fase 3: sincronizzazione**
- [ ] Webhook, `deal_stage_events`, macrostati, email al cambio di macrostato.
- [ ] Riconciliazione notturna e controllo SLA.
- [ ] Viste del BAC Locale e del Nazionale.
- [ ] Criterio di uscita: un referral pilota va da Nuovo lead a Chiuso vinto senza email manuali.

**Fase 4: admin ed economia**
- [ ] Collegamento dei deal successivi, eleggibilità, vista `v_deal_fees`.
- [ ] Rendiconto trimestrale, approvazione del Nazionale, pagamenti, attribuzioni ai territori.
- [ ] Criterio di uscita: il primo rendiconto è approvato dal Nazionale.

**Fase 5: rollout**
- [ ] 20 territori, inviti, guida rapida per i coordinatori.
- [ ] Test di separazione ripetuti su tutti i territori.

---

## 9. Cosa NON fare

- Non dare a nessun utente BAC un accesso a Mokapen.
- Non calcolare la fee nel portale, né scriverla su Mokapen.
- Non usare il payload del webhook come dato attendibile.
- Non esporre `SUPABASE_SERVICE_ROLE_KEY` o il token Mokapen al browser.
- Non aggiungere policy RLS di scrittura per `authenticated`.
- Non cancellare referral o deal: si chiudono o si annullano, e il log ne conserva la storia.

## 10. Decisioni ancora aperte (non bloccano l'MVP)

- Pagamenti parziali: per ora la fee matura al saldo, cioè quando il deal entra in Incassato.
- Tetto temporale per i servizi ricorrenti.
- Esclusione delle success fee sul capitale raccolto.
- Fiscalità del BAC e accordo quadro.
- Rinomina su Mokapen di «Importo success fee» in «Fee partner».
