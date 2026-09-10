/**
 * Production auto-save layer: AES-256-GCM encrypted LocalStorage persistence.
 * The in-app preview (LoanApplicationForm.jsx) simulates this with in-memory
 * state because browser storage APIs are disabled in the sandboxed artifact
 * preview. Drop this module into a real deployment and wire it into
 * useAutoSave() as shown at the bottom of this file.
 */

const TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
const SCHEMA_VERSION = "1.0";

// In production, derive this from a per-session secret (e.g. a value minted
// server-side at session start), never a hardcoded string checked into git.
const PASSPHRASE = "lendswift-demo-passphrase-replace-me";

async function deriveKey(passphrase) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("lendswift-salt"), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptState(obj) {
  const key = await deriveKey(PASSPHRASE);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const data = enc.encode(JSON.stringify(obj));
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(cipherBuf)),
  };
}

export async function decryptState(payload) {
  const key = await deriveKey(PASSPHRASE);
  const iv = new Uint8Array(payload.iv);
  const cipherBuf = new Uint8Array(payload.data).buffer;
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBuf);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

export function draftKey(loanType) {
  return `lendswift_draft_${loanType || "unset"}`;
}

export async function saveDraft(loanType, formState, currentStep) {
  const encrypted = await encryptState(formState);
  const record = {
    version: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    step: currentStep,
    loanType,
    payload: encrypted,
  };
  window.localStorage.setItem(draftKey(loanType), JSON.stringify(record));
}

export async function loadDraft(loanType) {
  const raw = window.localStorage.getItem(draftKey(loanType));
  if (!raw) return null;
  const record = JSON.parse(raw);

  if (record.version !== SCHEMA_VERSION) {
    window.localStorage.removeItem(draftKey(loanType));
    return null;
  }
  const age = Date.now() - new Date(record.timestamp).getTime();
  if (age > TTL_MS) {
    window.localStorage.removeItem(draftKey(loanType));
    return null;
  }
  try {
    const formState = await decryptState(record.payload);
    return { formState, step: record.step, timestamp: record.timestamp };
  } catch {
    // Corrupted or tampered payload — do not load, force a fresh start.
    window.localStorage.removeItem(draftKey(loanType));
    return null;
  }
}

export function clearDraft(loanType) {
  window.localStorage.removeItem(draftKey(loanType));
}

/**
 * React hook wiring example (not used by the sandboxed preview build):
 *
 *   function useAutoSave(formState, loanType, currentStep, interval = 30000) {
 *     const timer = useRef(null);
 *     useEffect(() => {
 *       clearTimeout(timer.current);
 *       timer.current = setTimeout(() => {
 *         saveDraft(loanType, formState, currentStep);
 *       }, interval);
 *       return () => clearTimeout(timer.current);
 *     }, [formState, loanType, currentStep, interval]);
 *   }
 */
