# LendSwift — multi-step loan application form

An 8-step production-style loan application flow for Personal, Home, and Business loans, built in React with real-time validation, conditional rendering, simulated PAN/Aadhaar verification, PIN code autocomplete, document upload with client-side compression, e-signature capture, and a pre-approval summary.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run lint
npm run test:e2e   # Cypress interactive runner
npm run test:e2e:headless
```

## Architecture

**Pattern**: single-form-with-registry (Part A1.4 Pattern 3 hybrid). One component tree holds all form state in `useState`; a `STEP_META` registry drives navigation, and `activeSteps` is recomputed from `needsCoApplicant()` so Step 6 mounts/unmounts declaratively rather than via manual skip logic.

**Validation**: `validateStep(step, formState)` is a pure function returning an errors map for the *current* step, reading whatever cross-step fields it needs directly off `formState` (e.g. Step 1's tenure check reads `dob` from Step 2; Step 5's employment check reads `loanType` from Step 1). This keeps validation declarative without a schema-compiler dependency — see "Why no RHF/Zod" below.

**Cross-step dependency map**: implemented as described in the spec (§B3). Each rule lives next to the field it validates, e.g.:
- `age + tenure ≤ 65` — Step 1, reads Step 2's `dob`
- Business loan ⇒ Step 5 employment type ≠ Salaried
- `loanAmount`/`loanType` ⇒ `needsCoApplicant()` ⇒ Step 6 visibility
- PAN verified ⇒ Step 7 PAN-copy upload becomes optional
- Employment type switch ⇒ stale sub-form fields are cleared (data-integrity effect in the main component)

**Why no React Hook Form / Zod**: the sandboxed preview environment this was built and rendered in doesn't ship those packages, so the validation layer was hand-rolled to keep the live preview runnable. The `package.json` in this repo is set up for a real project; swapping `validateStep()` for `useForm` + a per-step Zod schema (as specified in the brief) is a mechanical refactor — the field list, error copy, and cross-step rules translate directly into `.refine()`/`.superRefine()` calls.

**Auto-save**: the live preview simulates the 30-second encrypted-localStorage flow with an in-memory snapshot (`savedSnapshot` ref) plus the same debounce/toast UX, because `localStorage`/`sessionStorage` are unavailable inside the artifact sandbox. `src/utils/autosave.js` contains the real AES-256-GCM + `window.localStorage` implementation (Web Crypto `PBKDF2` → `AES-GCM`, 72-hour TTL, schema-version check) for use once this is deployed outside the sandbox.

**Documents**: `requiredDocuments(loanType, employmentType, panVerified)` computes the checklist per the spec's document table. Images run through `compressImage()` (Canvas → JPEG, quality steps down from 0.7 to 0.3 until under 2MB); PDFs pass through unmodified.

**E-signature**: hand-rolled canvas (`SignaturePad`) rather than `react-signature-canvas`, for the same sandbox-dependency reason as above — same behaviour (draw, clear, export PNG, non-empty validation), trivial to swap.

**PAN/Aadhaar**: `validatePAN()` checks the `AAAAA9999A` format and 4th-character entity type; `validateAadhaar()` implements the actual Verhoeff checksum (tables `VD`/`VP`), not just a 12-digit length check. Both feed a 1.5s `setTimeout` verification simulation with a visible spinner → verified badge.

**PIN lookup**: `PIN_DATA` is a small representative dataset (~15 codes across major cities/states); swap for an India Post API call behind the same `useEffect` debounce in production.

## Known limitations (sandbox vs. production)

| Area | This build | Production |
|---|---|---|
| Auto-save persistence | In-memory (session only) | `localStorage` + AES-256-GCM, 72h TTL (`src/utils/autosave.js`) |
| Validation engine | Hand-rolled `validateStep()` | React Hook Form + Zod resolver |
| PIN/PAN/Aadhaar verification | Simulated, client-side only | NSDL / UIDAI / India Post API integration |
| E2E coverage | 1 representative spec + command library | Full 15-journey suite per spec §E1 |

## Cross-step dependency map

See `validateStep()` in `LoanApplicationForm.jsx` and the table in the original brief (§B3) — every row there has a corresponding `req(...)` line or `useEffect` in the component.
