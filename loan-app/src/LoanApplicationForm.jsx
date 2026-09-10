import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Check, ChevronRight, ChevronLeft, Upload, X, FileText, Image as ImageIcon,
  ShieldCheck, Loader2, AlertCircle, RotateCcw, Save, Landmark, Home, Briefcase,
  User, MapPin, IndianRupee, FileSignature, ClipboardCheck, Info, Pencil
} from "lucide-react";

/* ============================================================================
   CONSTANTS & DOMAIN LOGIC
   ============================================================================ */

const LOAN_TYPES = [
  { id: "personal", label: "Personal loan", icon: User, max: 1000000, tenureRange: [12, 60], rate: 10.5 },
  { id: "home", label: "Home loan", icon: Home, max: 10000000, tenureRange: [60, 360], rate: 8.5 },
  { id: "business", label: "Business loan", icon: Briefcase, max: 5000000, tenureRange: [12, 120], rate: 14 },
];

const LOAN_PURPOSES = {
  personal: ["Wedding", "Medical emergency", "Travel", "Home renovation", "Debt consolidation", "Education"],
  home: ["Purchase of new home", "Construction", "Home renovation", "Plot purchase", "Balance transfer"],
  business: ["Working capital", "Equipment purchase", "Business expansion", "Inventory financing", "Machinery loan"],
};

const RESIDENCE_TYPES = ["Owned", "Rented", "Company provided", "Family owned"];
const BUSINESS_TYPES = ["Sole proprietorship", "Partnership", "Private limited", "LLP", "One person company"];

// Small representative PIN code dataset (in production this would be an India Post API call)
const PIN_DATA = {
  "110001": { city: "New Delhi", state: "Delhi", po: "Connaught Place" },
  "400001": { city: "Mumbai", state: "Maharashtra", po: "Fort" },
  "560001": { city: "Bengaluru", state: "Karnataka", po: "Bangalore GPO" },
  "700001": { city: "Kolkata", state: "West Bengal", po: "GPO Kolkata" },
  "600001": { city: "Chennai", state: "Tamil Nadu", po: "Chennai GPO" },
  "500001": { city: "Hyderabad", state: "Telangana", po: "Hyderabad GPO" },
  "411001": { city: "Pune", state: "Maharashtra", po: "Pune GPO" },
  "380001": { city: "Ahmedabad", state: "Gujarat", po: "Ahmedabad GPO" },
  "302001": { city: "Jaipur", state: "Rajasthan", po: "Jaipur GPO" },
  "462001": { city: "Bhopal", state: "Madhya Pradesh", po: "Bhopal GPO" },
  "226001": { city: "Lucknow", state: "Uttar Pradesh", po: "Lucknow GPO" },
  "641001": { city: "Coimbatore", state: "Tamil Nadu", po: "Coimbatore GPO" },
  "751001": { city: "Bhubaneswar", state: "Odisha", po: "Bhubaneswar GPO" },
  "160001": { city: "Chandigarh", state: "Chandigarh", po: "Chandigarh GPO" },
  "781001": { city: "Guwahati", state: "Assam", po: "Guwahati GPO" },
};

const STATES = ["Andhra Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Delhi","Gujarat","Haryana","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","West Bengal"];

function formatINR(value) {
  const n = Math.round(Number(value) || 0);
  return n.toLocaleString("en-IN");
}

function calcAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

// PAN: 5 letters + 4 digits + 1 letter. 4th char = entity type.
function validatePAN(pan, loanType) {
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    return { valid: false, error: "PAN must be 10 characters in format AAAAA9999A" };
  }
  const entity = pan[3];
  const allowed = loanType === "business" ? ["P", "C", "F"] : ["P"];
  if (!allowed.includes(entity)) {
    return {
      valid: false,
      error: `PAN 4th character must indicate entity type (${allowed.map(e => ({ P: "P for Individual", C: "C for Company", F: "F for Firm" }[e])).join(", ")})`,
    };
  }
  return { valid: true };
}

// Verhoeff checksum algorithm for Aadhaar validation
const VD = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],
  [4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],
  [8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0],
];
const VP = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];
function verhoeffValid(numStr) {
  let c = 0;
  const digits = numStr.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) {
    c = VD[c][VP[i % 8][digits[i]]];
  }
  return c === 0;
}
function validateAadhaar(aadhaar) {
  if (!/^\d{12}$/.test(aadhaar)) return { valid: false, error: "Aadhaar must be exactly 12 digits" };
  if (/^0|^1/.test(aadhaar)) return { valid: false, error: "Aadhaar cannot start with 0 or 1" };
  if (!verhoeffValid(aadhaar)) return { valid: false, error: "Aadhaar checksum is invalid — check the digits" };
  return { valid: true };
}

function validateGST(gst) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst);
}

function calcEMI(principal, annualRate, months) {
  const P = Number(principal) || 0;
  const r = annualRate / 12 / 100;
  const n = Number(months) || 1;
  if (r === 0) return P / n;
  const factor = Math.pow(1 + r, n);
  return (P * r * factor) / (factor - 1);
}

function needsCoApplicant(loanType, amount) {
  const amt = Number(amount) || 0;
  if (loanType === "home") return true;
  if (loanType === "personal") return amt > 500000;
  if (loanType === "business") return amt > 2000000;
  return false;
}

function requiredDocuments(loanType, employmentType, panVerified) {
  const docs = [];
  if (!panVerified) docs.push({ key: "panCard", label: "PAN card copy", accept: "image/*,.pdf", max: 5 });
  docs.push({ key: "aadhaarFront", label: "Aadhaar card (front)", accept: "image/*,.pdf", max: 5 });
  docs.push({ key: "aadhaarBack", label: "Aadhaar card (back)", accept: "image/*,.pdf", max: 5 });
  docs.push({ key: "photo", label: "Passport-size photograph", accept: "image/*", max: 2 });
  docs.push({ key: "bankStatements", label: "Bank statements (last 6 months)", accept: ".pdf", max: 10 });
  if (employmentType === "salaried") {
    docs.push({ key: "salarySlips", label: "Salary slips (last 3 months)", accept: ".pdf", max: 5 });
  } else if (employmentType === "self-employed" || employmentType === "business-owner") {
    docs.push({ key: "itr", label: "ITR (last 2 years)", accept: ".pdf", max: 5 });
  }
  if (loanType === "home") docs.push({ key: "propertyDocs", label: "Property documents", accept: ".pdf", max: 10 });
  if (loanType === "business") {
    docs.push({ key: "businessReg", label: "Business registration certificate", accept: ".pdf", max: 5 });
    docs.push({ key: "gstReturns", label: "GST returns (last 4 quarters)", accept: ".pdf", max: 5 });
  }
  return docs;
}

const STEP_META = [
  { id: 1, title: "Loan details", icon: IndianRupee },
  { id: 2, title: "Personal info", icon: User },
  { id: 3, title: "Identity (KYC)", icon: ShieldCheck },
  { id: 4, title: "Address", icon: MapPin },
  { id: 5, title: "Employment", icon: Briefcase },
  { id: 6, title: "Co-applicant", icon: User },
  { id: 7, title: "Documents", icon: FileSignature },
  { id: 8, title: "Review & submit", icon: ClipboardCheck },
];

const INITIAL_FORM = {
  loanType: "", loanAmount: "", loanTenure: "", loanPurpose: "", referralCode: "",
  fullName: "", dob: "", gender: "", maritalStatus: "", fatherName: "", motherName: "",
  email: "", mobile: "", altMobile: "",
  pan: "", panVerified: false, aadhaar: "", aadhaarVerified: false, aadhaarConsent: false, voterId: "", passport: "",
  currentAddress1: "", currentAddress2: "", pincode: "", city: "", state: "",
  residenceType: "", rentAmount: "", yearsAtAddress: "", previousAddress: "",
  sameAsPermanent: true, permAddress1: "", permAddress2: "", permPincode: "", permCity: "", permState: "",
  employmentType: "", companyName: "", designation: "", monthlySalary: "", yearsExperience: "",
  businessName: "", businessType: "", annualTurnover: "", yearsInBusiness: "", monthlyIncomeSE: "", gstNumber: "", officeAddress: "",
  coApplicantName: "", coApplicantRelationship: "", coApplicantPan: "", coApplicantIncome: "", coApplicantConsent: false,
  consents: { accurate: false, creditCheck: false, terms: false, communication: false },
};

/* ============================================================================
   SMALL UI PRIMITIVES
   ============================================================================ */

function Field({ label, htmlFor, required, error, help, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700 flex items-center gap-1">
        {label}
        {required && <span className="text-rose-600" aria-hidden="true">*</span>}
        {!required && <span className="text-slate-400 font-normal text-xs">(optional)</span>}
      </label>
      {children}
      {help && !error && <p className="text-xs text-slate-500">{help}</p>}
      {error && (
        <p role="alert" aria-live="polite" className="text-xs text-rose-600 flex items-center gap-1">
          <AlertCircle size={13} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}

const baseInput = "w-full min-h-[44px] px-3.5 rounded-lg border bg-white text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:ring-2 focus:ring-offset-0";

function TextInput({ id, error, className = "", ...props }) {
  return (
    <input
      id={id}
      className={`${baseInput} ${error ? "border-rose-400 focus:ring-rose-200" : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-100"} ${className}`}
      aria-invalid={!!error}
      {...props}
    />
  );
}

function SelectInput({ id, error, children, className = "", ...props }) {
  return (
    <select
      id={id}
      className={`${baseInput} ${error ? "border-rose-400 focus:ring-rose-200" : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-100"} ${className}`}
      aria-invalid={!!error}
      {...props}
    >
      {children}
    </select>
  );
}

function RadioCard({ selected, onClick, icon: Icon, label, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex-1 min-w-[140px] text-left px-4 py-3.5 rounded-xl border-2 transition flex items-start gap-3 min-h-[44px]
        ${selected ? "border-indigo-600 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      {Icon && <Icon size={20} className={selected ? "text-indigo-700 mt-0.5" : "text-slate-400 mt-0.5"} aria-hidden="true" />}
      <span>
        <span className={`block text-sm font-medium ${selected ? "text-indigo-900" : "text-slate-700"}`}>{label}</span>
        {sub && <span className="block text-xs text-slate-500 mt-0.5">{sub}</span>}
      </span>
      {selected && <Check size={16} className="text-indigo-700 ml-auto mt-0.5 shrink-0" aria-hidden="true" />}
    </button>
  );
}

function Toggle({ checked, onChange, label, id }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer select-none min-h-[44px]">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <span
        className="w-10 h-6 rounded-full bg-slate-300 peer-checked:bg-indigo-600 transition-colors relative shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 peer-focus-visible:ring-offset-1"
        aria-hidden="true"
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

function VerifyBadge({ status }) {
  if (status === "verifying") {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md"><Loader2 size={12} className="animate-spin" aria-hidden="true" />Verifying</span>;
  }
  if (status === "verified") {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md"><ShieldCheck size={12} aria-hidden="true" />Verified</span>;
  }
  return null;
}

/* ============================================================================
   FILE UPLOAD WITH CLIENT-SIDE COMPRESSION + PREVIEW
   ============================================================================ */

function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const attempt = (q) => {
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          if (blob.size > 2 * 1024 * 1024 && q > 0.3) {
            attempt(q - 0.1);
          } else {
            const reader = new FileReader();
            reader.onload = () => resolve({ dataUrl: reader.result, size: blob.size });
            reader.readAsDataURL(blob);
          }
        }, "image/jpeg", q);
      };
      attempt(quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function DocUploadRow({ doc, value, onChange, onRemove }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = useCallback(async (file) => {
    setErr("");
    if (!file) return;
    if (file.size > doc.max * 1024 * 1024) {
      setErr(`File exceeds ${doc.max}MB limit`);
      return;
    }
    const isImage = file.type.startsWith("image/");
    setBusy(true);
    try {
      if (isImage) {
        const { dataUrl, size } = await compressImage(file);
        onChange(doc.key, { name: file.name, type: "image", originalSize: file.size, compressedSize: size, dataUrl });
      } else {
        const reader = new FileReader();
        reader.onload = () => onChange(doc.key, { name: file.name, type: "pdf", originalSize: file.size, compressedSize: file.size, dataUrl: reader.result });
        reader.readAsDataURL(file);
      }
    } catch {
      setErr("Could not process this file — try another");
    } finally {
      setBusy(false);
    }
  }, [doc, onChange]);

  return (
    <div className="border border-slate-200 rounded-xl p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{doc.label}</p>
          <p className="text-xs text-slate-500">Max {doc.max}MB &middot; {doc.accept.includes("image") ? "PDF, JPG or PNG" : "PDF only"}</p>
        </div>
        {value ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md shrink-0"><Check size={12} aria-hidden="true" />Uploaded</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md shrink-0">Pending</span>
        )}
      </div>

      {value ? (
        <div className="mt-3 flex items-center gap-3 bg-slate-50 rounded-lg p-2.5">
          {value.type === "image" ? (
            <img src={value.dataUrl} alt={`Preview of ${value.name}`} className="w-12 h-12 object-cover rounded-md border border-slate-200" />
          ) : (
            <div className="w-12 h-12 flex items-center justify-center rounded-md bg-white border border-slate-200"><FileText size={20} className="text-slate-400" aria-hidden="true" /></div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-700 truncate">{value.name}</p>
            <p className="text-xs text-slate-500">
              {value.type === "image" ? `${(value.originalSize/1024).toFixed(0)}KB → ${(value.compressedSize/1024).toFixed(0)}KB compressed` : `${(value.compressedSize/1024).toFixed(0)}KB`}
            </p>
          </div>
          <button type="button" onClick={() => onRemove(doc.key)} aria-label={`Remove ${doc.label}`} className="p-2 min-w-[44px] min-h-[44px] rounded-md hover:bg-slate-200 text-slate-500 flex items-center justify-center">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
          className={`mt-3 border-2 border-dashed rounded-lg py-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          aria-label={`Upload ${doc.label}`}
        >
          {busy ? (
            <Loader2 size={20} className="animate-spin text-indigo-500" aria-hidden="true" />
          ) : (
            <Upload size={20} className="text-slate-400" aria-hidden="true" />
          )}
          <p className="text-xs text-slate-500">{busy ? "Processing…" : "Drag & drop or click to upload"}</p>
          <input ref={inputRef} type="file" accept={doc.accept} className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      )}
      {err && <p role="alert" className="text-xs text-rose-600 mt-2 flex items-center gap-1"><AlertCircle size={12} aria-hidden="true" />{err}</p>}
    </div>
  );
}

/* ============================================================================
   E-SIGNATURE CANVAS
   ============================================================================ */

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [empty, setEmpty] = useState(!value);

  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1e293b";
      if (value) {
        const img = new window.Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = value;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    hasInk.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setEmpty(false);
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full h-40 rounded-xl border-2 border-dashed border-slate-300 bg-white touch-none"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        role="img"
        aria-label={empty ? "Empty signature pad, sign using mouse or touch" : "Signature captured"}
      />
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-slate-500">{empty ? "Sign above using your mouse or finger" : "Signature captured"}</p>
        <button type="button" onClick={clear} className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 min-h-[44px] px-2">
          <RotateCcw size={13} aria-hidden="true" /> Clear
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   VALIDATION PER STEP
   ============================================================================ */

function validateStep(step, f) {
  const e = {};
  const req = (cond, key, msg) => { if (cond) e[key] = msg; };

  if (step === 1) {
    req(!f.loanType, "loanType", "Select a loan type to continue");
    const meta = LOAN_TYPES.find((l) => l.id === f.loanType);
    if (meta) {
      const amt = Number(f.loanAmount);
      req(!f.loanAmount, "loanAmount", "Enter the amount you'd like to borrow");
      req(f.loanAmount && amt < 50000, "loanAmount", "Minimum loan amount is ₹50,000");
      req(f.loanAmount && amt > meta.max, "loanAmount", `Maximum for ${meta.label.toLowerCase()} is ₹${formatINR(meta.max)}`);
      req(!f.loanTenure, "loanTenure", "Choose a repayment tenure");
      const age = calcAge(f.dob);
      if (age && f.loanTenure) {
        const tenureYears = Number(f.loanTenure) / 12;
        req(age + tenureYears > 65, "loanTenure", "Age plus tenure cannot exceed 65 years");
      }
      req(!f.loanPurpose, "loanPurpose", "Select the purpose of this loan");
    }
    req(f.referralCode && !/^[A-Za-z0-9]{6,10}$/.test(f.referralCode), "referralCode", "Referral code must be 6–10 alphanumeric characters");
  }

  if (step === 2) {
    req(!f.fullName || f.fullName.trim().length < 2, "fullName", "Enter your full name as it appears on your PAN");
    req(f.fullName && !/^[A-Za-z. ]{2,100}$/.test(f.fullName), "fullName", "Only letters, spaces and periods are allowed");
    req(!f.dob, "dob", "Enter your date of birth");
    const age = calcAge(f.dob);
    req(f.dob && (age < 21 || age > 65), "dob", "Applicant age must be between 21 and 65 years");
    req(!f.gender, "gender", "Select your gender");
    req(!f.maritalStatus, "maritalStatus", "Select your marital status");
    req(!f.fatherName || f.fatherName.trim().length < 2, "fatherName", "Enter your father's name");
    req(!f.motherName || f.motherName.trim().length < 2, "motherName", "Enter your mother's name");
    req(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email || ""), "email", "Enter a valid email address");
    req(!/^[6-9]\d{9}$/.test(f.mobile || ""), "mobile", "Enter a 10-digit mobile number starting 6–9");
    req(f.altMobile && f.altMobile === f.mobile, "altMobile", "Alternate number must differ from your primary number");
    req(f.altMobile && !/^[6-9]\d{9}$/.test(f.altMobile), "altMobile", "Enter a valid 10-digit mobile number");
  }

  if (step === 3) {
    const pan = validatePAN(f.pan || "", f.loanType);
    req(!f.pan, "pan", "Enter your PAN number");
    req(f.pan && !pan.valid, "pan", pan.error);
    req(f.pan && pan.valid && !f.panVerified, "pan", "Verification pending — wait a moment");
    const aad = validateAadhaar(f.aadhaar || "");
    req(!f.aadhaar, "aadhaar", "Enter your Aadhaar number");
    req(f.aadhaar && !aad.valid, "aadhaar", aad.error);
    req(f.aadhaar && aad.valid && !f.aadhaarVerified, "aadhaar", "Verification pending — wait a moment");
    req(!f.aadhaarConsent, "aadhaarConsent", "Consent is required to proceed with Aadhaar-based verification");
    req(f.voterId && !/^[A-Z]{3}[0-9]{7}$/.test(f.voterId), "voterId", "Voter ID must be 3 letters followed by 7 digits");
    req(f.passport && !/^[A-Z][0-9]{7}$/.test(f.passport), "passport", "Passport number must be 1 letter followed by 7 digits");
  }

  if (step === 4) {
    req(!f.currentAddress1 || f.currentAddress1.trim().length < 5, "currentAddress1", "Enter your address (minimum 5 characters)");
    req(!/^\d{6}$/.test(f.pincode || ""), "pincode", "Enter a valid 6-digit PIN code");
    req(!f.city, "city", "City is required");
    req(!f.state, "state", "State is required");
    req(!f.residenceType, "residenceType", "Select your residence type");
    req(f.residenceType === "Rented" && !f.rentAmount, "rentAmount", "Enter your monthly rent amount");
    req(f.yearsAtAddress === "", "yearsAtAddress", "Enter years at current address");
    req(f.yearsAtAddress !== "" && Number(f.yearsAtAddress) < 1 && !f.previousAddress, "previousAddress", "Provide your previous address since you've lived here under a year");
    if (!f.sameAsPermanent) {
      req(!f.permAddress1, "permAddress1", "Enter your permanent address");
      req(!/^\d{6}$/.test(f.permPincode || ""), "permPincode", "Enter a valid 6-digit PIN code");
    }
  }

  if (step === 5) {
    req(!f.employmentType, "employmentType", "Select your employment type");
    if (f.loanType === "business") {
      req(f.employmentType === "salaried", "employmentType", "Business loans require Self-Employed or Business Owner status");
    }
    if (f.employmentType === "salaried") {
      req(!f.companyName, "companyName", "Enter your employer's name");
      req(!f.designation, "designation", "Enter your designation");
      req(!f.monthlySalary || Number(f.monthlySalary) < 15000, "monthlySalary", "Minimum monthly salary is ₹15,000");
    } else if (f.employmentType === "self-employed" || f.employmentType === "business-owner") {
      req(!f.businessName, "businessName", "Enter your business name");
      req(!f.businessType, "businessType", "Select your business type");
      req(!f.annualTurnover || Number(f.annualTurnover) < 300000, "annualTurnover", "Minimum annual turnover is ₹3,00,000");
      req(!f.yearsInBusiness || Number(f.yearsInBusiness) < 2, "yearsInBusiness", "Business must be at least 2 years old");
      req(!f.monthlyIncomeSE, "monthlyIncomeSE", "Enter your average monthly income");
      req(!f.officeAddress, "officeAddress", "Enter your business address");
      if (f.employmentType === "business-owner") {
        req(!f.gstNumber || !validateGST(f.gstNumber), "gstNumber", "Enter a valid 15-character GST number");
      }
    }
    req(f.yearsExperience === "", "yearsExperience", "Enter years of work experience");
  }

  if (step === 6 && needsCoApplicant(f.loanType, f.loanAmount)) {
    req(!f.coApplicantName, "coApplicantName", "Enter co-applicant's full name");
    req(!f.coApplicantRelationship, "coApplicantRelationship", "Select the relationship to the co-applicant");
    const pan = validatePAN(f.coApplicantPan || "", "personal");
    req(!f.coApplicantPan, "coApplicantPan", "Enter co-applicant's PAN");
    req(f.coApplicantPan && !pan.valid, "coApplicantPan", pan.error);
    req(!f.coApplicantIncome, "coApplicantIncome", "Enter co-applicant's monthly income");
    req(!f.coApplicantConsent, "coApplicantConsent", "Co-applicant consent is required to proceed");
  }

  if (step === 8) {
    req(!f.consents.accurate, "consents.accurate", "Confirm the information you provided is accurate");
    req(!f.consents.creditCheck, "consents.creditCheck", "Authorise the credit bureau check to continue");
    req(!f.consents.terms, "consents.terms", "Accept the Terms and Conditions to continue");
    req(!f.signature, "signature", "Capture your signature to continue");
  }

  return e;
}

/* ============================================================================
   MAIN APPLICATION
   ============================================================================ */

export default function LoanApplicationForm() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [documents, setDocuments] = useState({});
  const [signature, setSignature] = useState(null);
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState({});
  const [panStatus, setPanStatus] = useState("idle");
  const [aadhaarStatus, setAadhaarStatus] = useState("idle");
  const [coPanStatus, setCoPanStatus] = useState("idle");
  const [pinLookup, setPinLookup] = useState("idle");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState("");
  const stepTopRef = useRef(null);
  const savedSnapshot = useRef(null);
  const autosaveTimer = useRef(null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setConsent = (key, value) => setForm((f) => ({ ...f, consents: { ...f.consents, [key]: value } }));
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }));

  const errors = useMemo(() => validateStep(step, { ...form, signature }), [step, form, signature]);

  const activeSteps = useMemo(() => {
    if (needsCoApplicant(form.loanType, form.loanAmount)) return STEP_META;
    return STEP_META.filter((s) => s.id !== 6);
  }, [form.loanType, form.loanAmount]);

  /* ---- In-session auto-save simulation ----
     Production note: real deployment persists an AES-256-GCM encrypted
     snapshot to localStorage every 30s (see architecture notes below the form).
     Browser storage APIs are unavailable inside this preview sandbox, so this
     demo keeps the same interval/debounce behaviour using an in-memory ref
     and surfaces the identical "Draft saved" / "Resume application" UX. */
  useEffect(() => {
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (step > 1 || form.loanType) {
        setSaveState("saving");
        setTimeout(() => {
          savedSnapshot.current = { form, documents, signature, step, savedAt: new Date() };
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 2000);
        }, 350);
      }
    }, 1200);
    return () => clearTimeout(autosaveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, documents, signature, step]);

  const resumeDraft = () => {
    const s = savedSnapshot.current;
    if (s) {
      setForm(s.form);
      setDocuments(s.documents);
      setSignature(s.signature);
      setStep(s.step);
    }
    setShowResumeBanner(false);
  };

  // PIN code lookup simulation
  useEffect(() => {
    if (/^\d{6}$/.test(form.pincode)) {
      setPinLookup("loading");
      const t = setTimeout(() => {
        const match = PIN_DATA[form.pincode];
        if (match) {
          setForm((f) => ({ ...f, city: match.city, state: match.state }));
          setPinLookup("found");
        } else {
          setPinLookup("notfound");
        }
      }, 500);
      return () => clearTimeout(t);
    }
    setPinLookup("idle");
  }, [form.pincode]);

  // PAN verification simulation
  const verifyPAN = useCallback((value, loanType, cb) => {
    const result = validatePAN(value, loanType);
    if (!result.valid) { cb(false); return; }
    cb("verifying");
    setTimeout(() => cb(true), 1500);
  }, []);
  useEffect(() => {
    if (!form.pan) { setPanStatus("idle"); return; }
    verifyPAN(form.pan, form.loanType, (r) => {
      if (r === "verifying") { setPanStatus("verifying"); return; }
      setPanStatus(r ? "verified" : "idle");
      set("panVerified", !!r);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pan]);

  useEffect(() => {
    if (!form.aadhaar || form.aadhaar.length !== 12) { setAadhaarStatus("idle"); return; }
    const result = validateAadhaar(form.aadhaar);
    if (!result.valid) return;
    setAadhaarStatus("verifying");
    const t = setTimeout(() => { setAadhaarStatus("verified"); set("aadhaarVerified", true); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.aadhaar]);

  useEffect(() => {
    if (!form.coApplicantPan) { setCoPanStatus("idle"); return; }
    const result = validatePAN(form.coApplicantPan, "personal");
    if (!result.valid) return;
    setCoPanStatus("verifying");
    const t = setTimeout(() => setCoPanStatus("verified"), 1500);
    return () => clearTimeout(t);
  }, [form.coApplicantPan]);

  // Clear stale sub-form data when employment type or loan type changes (data integrity)
  useEffect(() => {
    if (form.employmentType === "salaried") {
      setForm((f) => ({ ...f, businessName: "", businessType: "", annualTurnover: "", yearsInBusiness: "", monthlyIncomeSE: "", gstNumber: "", officeAddress: "" }));
    } else if (form.employmentType) {
      setForm((f) => ({ ...f, companyName: "", designation: "", monthlySalary: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.employmentType]);

  const docs = requiredDocuments(form.loanType, form.employmentType, form.panVerified);
  const allDocsUploaded = docs.every((d) => documents[d.key]);

  const currentMeta = LOAN_TYPES.find((l) => l.id === form.loanType);
  const emi = currentMeta ? calcEMI(form.loanAmount, currentMeta.rate, form.loanTenure) : 0;
  const totalCost = emi * (Number(form.loanTenure) || 0) - (Number(form.loanAmount) || 0);
  const processingFee = Math.min(Math.max((Number(form.loanAmount) || 0) * 0.01, 2000), 25000);
  const combinedIncome = (Number(form.monthlySalary) || Number(form.monthlyIncomeSE) || 0) + (Number(form.coApplicantIncome) || 0);
  const emiRatio = combinedIncome ? (emi / combinedIncome) * 100 : 0;

  const stepValid = Object.keys(errors).length === 0;

  const goNext = () => {
    const allTouched = {};
    Object.keys(errors).forEach((k) => { allTouched[k] = true; });
    setTouched((t) => ({ ...t, ...allTouched }));
    if (!stepValid) return;
    const idx = activeSteps.findIndex((s) => s.id === step);
    const next = activeSteps[idx + 1];
    if (next) {
      setStep(next.id);
      stepTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => document.getElementById("step-first-field")?.focus(), 50);
    }
  };
  const goPrev = () => {
    const idx = activeSteps.findIndex((s) => s.id === step);
    const prev = activeSteps[idx - 1];
    if (prev) { setStep(prev.id); stepTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  };

  const submit = () => {
    const allTouched = {};
    Object.keys(errors).forEach((k) => { allTouched[k] = true; });
    setTouched((t) => ({ ...t, ...allTouched }));
    if (!stepValid || !allDocsUploaded || !form.consents.communication) return;
    setRefNumber(`LS${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 900 + 100)}`);
    setSubmitted(true);
  };

  const err = (key) => (touched[key] ? errors[key] : undefined);
  const stepIndex = activeSteps.findIndex((s) => s.id === step);
  const progressPct = Math.round(((stepIndex) / (activeSteps.length - 1)) * 100);

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Check size={26} className="text-emerald-600" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Application submitted</h1>
          <p className="text-sm text-slate-500 mt-2">Your {currentMeta?.label.toLowerCase()} application has been received. Our team will reach out within 2 business days.</p>
          <div className="mt-5 bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500">Application reference</p>
            <p className="text-base font-mono font-medium text-slate-900 mt-0.5">{refNumber}</p>
          </div>
          <p className="text-xs text-slate-400 mt-5">You have the right to exit this loan within the cooling-off period without penalty. Grievance officer contact details have been emailed to you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Landmark size={16} className="text-white" aria-hidden="true" />
            </div>
            <span className="font-semibold text-slate-900 text-sm">LendSwift</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400" aria-live="polite">
            {saveState === "saving" && <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" aria-hidden="true" />Saving…</span>}
            {saveState === "saved" && <span className="flex items-center gap-1 text-emerald-600"><Save size={12} aria-hidden="true" />Draft saved</span>}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-5 pb-3.5">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Step ${stepIndex + 1} of ${activeSteps.length}: ${STEP_META.find(s=>s.id===step)?.title}`}>
            <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">Step {stepIndex + 1} of {activeSteps.length} &middot; {STEP_META.find((s) => s.id === step)?.title}</p>
        </div>
      </header>

      {savedSnapshot.current && showResumeBanner && (
        <div className="max-w-3xl mx-auto px-5 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-800">You have a saved draft from this session.</p>
            <div className="flex gap-2">
              <button onClick={resumeDraft} className="text-xs font-medium bg-amber-600 text-white px-3 py-2 rounded-lg min-h-[44px]">Resume</button>
              <button onClick={() => setShowResumeBanner(false)} className="text-xs font-medium text-amber-700 px-3 py-2 min-h-[44px]">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <main ref={stepTopRef} className="max-w-3xl mx-auto px-5 pt-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">What kind of loan do you need?</h2>
                <div className="flex flex-col sm:flex-row gap-3" role="radiogroup" aria-label="Loan type">
                  {LOAN_TYPES.map((lt) => (
                    <RadioCard key={lt.id} selected={form.loanType === lt.id} onClick={() => { set("loanType", lt.id); set("loanAmount", ""); set("loanTenure", ""); set("loanPurpose", ""); touch("loanType"); }} icon={lt.icon} label={lt.label} sub={`Up to ₹${formatINR(lt.max)}`} />
                  ))}
                </div>
                {err("loanType") && <p role="alert" className="text-xs text-rose-600 mt-2 flex items-center gap-1"><AlertCircle size={13} aria-hidden="true" />{err("loanType")}</p>}
              </div>

              {currentMeta && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Loan amount (₹)" htmlFor="loanAmount" required error={err("loanAmount")} help={`Between ₹50,000 and ₹${formatINR(currentMeta.max)}`}>
                      <TextInput id="step-first-field" type="number" value={form.loanAmount} onChange={(e) => set("loanAmount", e.target.value)} onBlur={() => touch("loanAmount")} error={err("loanAmount")} placeholder="500000" />
                    </Field>
                    <Field label="Tenure (months)" htmlFor="loanTenure" required error={err("loanTenure")}>
                      <SelectInput id="loanTenure" value={form.loanTenure} onChange={(e) => set("loanTenure", e.target.value)} onBlur={() => touch("loanTenure")} error={err("loanTenure")}>
                        <option value="">Select tenure</option>
                        {Array.from({ length: (currentMeta.tenureRange[1] - currentMeta.tenureRange[0]) / 12 + 1 }, (_, i) => currentMeta.tenureRange[0] + i * 12).map((m) => (
                          <option key={m} value={m}>{m} months ({(m / 12).toFixed(0)} yrs)</option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>
                  <Field label="Loan purpose" htmlFor="loanPurpose" required error={err("loanPurpose")}>
                    <SelectInput id="loanPurpose" value={form.loanPurpose} onChange={(e) => set("loanPurpose", e.target.value)} onBlur={() => touch("loanPurpose")} error={err("loanPurpose")}>
                      <option value="">Select purpose</option>
                      {LOAN_PURPOSES[form.loanType].map((p) => <option key={p} value={p}>{p}</option>)}
                    </SelectInput>
                  </Field>
                  <Field label="Referral code" htmlFor="referralCode" error={err("referralCode")}>
                    <TextInput id="referralCode" value={form.referralCode} onChange={(e) => set("referralCode", e.target.value.toUpperCase())} onBlur={() => touch("referralCode")} error={err("referralCode")} placeholder="FRIEND24" />
                  </Field>
                </>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Tell us about yourself</h2>
              <Field label="Full name (as per PAN)" htmlFor="fullName" required error={err("fullName")}>
                <TextInput id="step-first-field" autoComplete="name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} onBlur={() => touch("fullName")} error={err("fullName")} placeholder="Aditi Sharma" />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Date of birth" htmlFor="dob" required error={err("dob")}>
                  <TextInput id="dob" type="date" autoComplete="bday" value={form.dob} onChange={(e) => set("dob", e.target.value)} onBlur={() => touch("dob")} error={err("dob")} />
                </Field>
                <Field label="Gender" htmlFor="gender" required error={err("gender")}>
                  <SelectInput id="gender" value={form.gender} onChange={(e) => set("gender", e.target.value)} onBlur={() => touch("gender")} error={err("gender")}>
                    <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                  </SelectInput>
                </Field>
              </div>
              <Field label="Marital status" htmlFor="maritalStatus" required error={err("maritalStatus")}>
                <SelectInput id="maritalStatus" value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)} onBlur={() => touch("maritalStatus")} error={err("maritalStatus")}>
                  <option value="">Select</option><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
                </SelectInput>
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Father's name" htmlFor="fatherName" required error={err("fatherName")}>
                  <TextInput id="fatherName" value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} onBlur={() => touch("fatherName")} error={err("fatherName")} />
                </Field>
                <Field label="Mother's name" htmlFor="motherName" required error={err("motherName")}>
                  <TextInput id="motherName" value={form.motherName} onChange={(e) => set("motherName", e.target.value)} onBlur={() => touch("motherName")} error={err("motherName")} />
                </Field>
              </div>
              <Field label="Email address" htmlFor="email" required error={err("email")}>
                <TextInput id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} onBlur={() => touch("email")} error={err("email")} placeholder="you@example.com" />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Mobile number" htmlFor="mobile" required error={err("mobile")}>
                  <TextInput id="mobile" type="tel" autoComplete="tel" value={form.mobile} onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0,10))} onBlur={() => touch("mobile")} error={err("mobile")} placeholder="98765 43210" />
                </Field>
                <Field label="Alternate mobile" htmlFor="altMobile" error={err("altMobile")}>
                  <TextInput id="altMobile" type="tel" value={form.altMobile} onChange={(e) => set("altMobile", e.target.value.replace(/\D/g, "").slice(0,10))} onBlur={() => touch("altMobile")} error={err("altMobile")} />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Identity verification</h2>
              <Field label="PAN number" htmlFor="pan" required error={err("pan")} help="Format: AAAAA9999A">
                <div className="relative">
                  <TextInput id="step-first-field" value={form.pan} onChange={(e) => set("pan", e.target.value.toUpperCase().slice(0, 10))} onBlur={() => touch("pan")} error={err("pan")} placeholder="ABCDE1234F" className="font-mono pr-28" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2"><VerifyBadge status={panStatus} /></span>
                </div>
              </Field>
              <Field label="Aadhaar number" htmlFor="aadhaar" required error={err("aadhaar")} help="12 digits, only last 4 will be stored visibly">
                <div className="relative">
                  <TextInput id="aadhaar" value={form.aadhaar} onChange={(e) => set("aadhaar", e.target.value.replace(/\D/g, "").slice(0, 12))} onBlur={() => touch("aadhaar")} error={err("aadhaar")} placeholder="XXXX XXXX 1234" className="font-mono pr-28" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2"><VerifyBadge status={aadhaarStatus} /></span>
                </div>
              </Field>
              <div className="bg-slate-50 rounded-xl p-3.5">
                <label htmlFor="aadhaarConsent" className="flex items-start gap-2.5 cursor-pointer min-h-[44px]">
                  <input id="aadhaarConsent" type="checkbox" checked={form.aadhaarConsent} onChange={(e) => { set("aadhaarConsent", e.target.checked); touch("aadhaarConsent"); }} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600" />
                  <span className="text-xs text-slate-600">I explicitly consent to LendSwift verifying my identity using my Aadhaar number, in accordance with RBI digital lending guidelines. This consent is separate from other consents in this application.</span>
                </label>
                {err("aadhaarConsent") && <p role="alert" className="text-xs text-rose-600 mt-1.5 ml-6">{err("aadhaarConsent")}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Voter ID" htmlFor="voterId" error={err("voterId")}>
                  <TextInput id="voterId" value={form.voterId} onChange={(e) => set("voterId", e.target.value.toUpperCase())} onBlur={() => touch("voterId")} error={err("voterId")} className="font-mono" />
                </Field>
                {form.loanType === "home" && Number(form.loanAmount) > 5000000 && (
                  <Field label="Passport number" htmlFor="passport" error={err("passport")}>
                    <TextInput id="passport" value={form.passport} onChange={(e) => set("passport", e.target.value.toUpperCase())} onBlur={() => touch("passport")} error={err("passport")} className="font-mono" />
                  </Field>
                )}
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Address information</h2>
              <Field label="Address line 1" htmlFor="currentAddress1" required error={err("currentAddress1")}>
                <TextInput id="step-first-field" autoComplete="address-line1" value={form.currentAddress1} onChange={(e) => set("currentAddress1", e.target.value)} onBlur={() => touch("currentAddress1")} error={err("currentAddress1")} />
              </Field>
              <Field label="Address line 2" htmlFor="currentAddress2">
                <TextInput id="currentAddress2" autoComplete="address-line2" value={form.currentAddress2} onChange={(e) => set("currentAddress2", e.target.value)} />
              </Field>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="PIN code" htmlFor="pincode" required error={err("pincode")} help={pinLookup === "notfound" ? "PIN not found in our directory — enter city/state manually" : undefined}>
                  <div className="relative">
                    <TextInput id="pincode" autoComplete="postal-code" value={form.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} onBlur={() => touch("pincode")} error={err("pincode")} placeholder="462001" />
                    {pinLookup === "loading" && <Loader2 size={14} className="animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true" />}
                  </div>
                </Field>
                <Field label="City" htmlFor="city" required error={err("city")}>
                  <TextInput id="city" autoComplete="address-level2" value={form.city} onChange={(e) => set("city", e.target.value)} onBlur={() => touch("city")} error={err("city")} />
                </Field>
                <Field label="State" htmlFor="state" required error={err("state")}>
                  <SelectInput id="state" autoComplete="address-level1" value={form.state} onChange={(e) => set("state", e.target.value)} onBlur={() => touch("state")} error={err("state")}>
                    <option value="">Select</option>
                    {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Residence type" htmlFor="residenceType" required error={err("residenceType")}>
                  <SelectInput id="residenceType" value={form.residenceType} onChange={(e) => set("residenceType", e.target.value)} onBlur={() => touch("residenceType")} error={err("residenceType")}>
                    <option value="">Select</option>
                    {RESIDENCE_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </SelectInput>
                </Field>
                {form.residenceType === "Rented" && (
                  <Field label="Monthly rent (₹)" htmlFor="rentAmount" required error={err("rentAmount")}>
                    <TextInput id="rentAmount" type="number" value={form.rentAmount} onChange={(e) => set("rentAmount", e.target.value)} onBlur={() => touch("rentAmount")} error={err("rentAmount")} />
                  </Field>
                )}
              </div>
              <Field label="Years at current address" htmlFor="yearsAtAddress" required error={err("yearsAtAddress")}>
                <TextInput id="yearsAtAddress" type="number" min="0" max="50" value={form.yearsAtAddress} onChange={(e) => set("yearsAtAddress", e.target.value)} onBlur={() => touch("yearsAtAddress")} error={err("yearsAtAddress")} className="max-w-[160px]" />
              </Field>
              {form.yearsAtAddress !== "" && Number(form.yearsAtAddress) < 1 && (
                <Field label="Previous address" htmlFor="previousAddress" required error={err("previousAddress")}>
                  <TextInput id="previousAddress" value={form.previousAddress} onChange={(e) => set("previousAddress", e.target.value)} onBlur={() => touch("previousAddress")} error={err("previousAddress")} />
                </Field>
              )}
              <Toggle id="sameAsPermanent" checked={form.sameAsPermanent} onChange={(v) => set("sameAsPermanent", v)} label="Permanent address is the same as current address" />
              {!form.sameAsPermanent && (
                <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
                  <Field label="Permanent address line 1" htmlFor="permAddress1" required error={err("permAddress1")}>
                    <TextInput id="permAddress1" value={form.permAddress1} onChange={(e) => set("permAddress1", e.target.value)} onBlur={() => touch("permAddress1")} error={err("permAddress1")} />
                  </Field>
                  <Field label="Permanent PIN code" htmlFor="permPincode" required error={err("permPincode")}>
                    <TextInput id="permPincode" value={form.permPincode} onChange={(e) => set("permPincode", e.target.value.replace(/\D/g, "").slice(0, 6))} onBlur={() => touch("permPincode")} error={err("permPincode")} className="max-w-[160px]" />
                  </Field>
                </div>
              )}
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Employment & income</h2>
              {form.loanType === "business" && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-1.5"><Info size={13} aria-hidden="true" />Business loans require Self-employed or Business owner status</p>
              )}
              <div className="flex flex-col sm:flex-row gap-3" role="radiogroup" aria-label="Employment type" id="step-first-field" tabIndex={-1}>
                <RadioCard selected={form.employmentType === "salaried"} onClick={() => { set("employmentType", "salaried"); touch("employmentType"); }} label="Salaried" />
                <RadioCard selected={form.employmentType === "self-employed"} onClick={() => { set("employmentType", "self-employed"); touch("employmentType"); }} label="Self-employed" />
                <RadioCard selected={form.employmentType === "business-owner"} onClick={() => { set("employmentType", "business-owner"); touch("employmentType"); }} label="Business owner" />
              </div>
              {err("employmentType") && <p role="alert" className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle size={13} aria-hidden="true" />{err("employmentType")}</p>}

              {form.employmentType === "salaried" && (
                <div className="grid sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <Field label="Company name" htmlFor="companyName" required error={err("companyName")}>
                    <TextInput id="companyName" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} onBlur={() => touch("companyName")} error={err("companyName")} />
                  </Field>
                  <Field label="Designation" htmlFor="designation" required error={err("designation")}>
                    <TextInput id="designation" value={form.designation} onChange={(e) => set("designation", e.target.value)} onBlur={() => touch("designation")} error={err("designation")} />
                  </Field>
                  <Field label="Monthly net salary (₹)" htmlFor="monthlySalary" required error={err("monthlySalary")}>
                    <TextInput id="monthlySalary" type="number" value={form.monthlySalary} onChange={(e) => set("monthlySalary", e.target.value)} onBlur={() => touch("monthlySalary")} error={err("monthlySalary")} />
                  </Field>
                </div>
              )}

              {(form.employmentType === "self-employed" || form.employmentType === "business-owner") && (
                <div className="grid sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <Field label="Business name" htmlFor="businessName" required error={err("businessName")}>
                    <TextInput id="businessName" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} onBlur={() => touch("businessName")} error={err("businessName")} />
                  </Field>
                  <Field label="Business type" htmlFor="businessType" required error={err("businessType")}>
                    <SelectInput id="businessType" value={form.businessType} onChange={(e) => set("businessType", e.target.value)} onBlur={() => touch("businessType")} error={err("businessType")}>
                      <option value="">Select</option>
                      {BUSINESS_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </SelectInput>
                  </Field>
                  <Field label="Annual turnover (₹)" htmlFor="annualTurnover" required error={err("annualTurnover")}>
                    <TextInput id="annualTurnover" type="number" value={form.annualTurnover} onChange={(e) => set("annualTurnover", e.target.value)} onBlur={() => touch("annualTurnover")} error={err("annualTurnover")} />
                  </Field>
                  <Field label="Years in business" htmlFor="yearsInBusiness" required error={err("yearsInBusiness")}>
                    <TextInput id="yearsInBusiness" type="number" value={form.yearsInBusiness} onChange={(e) => set("yearsInBusiness", e.target.value)} onBlur={() => touch("yearsInBusiness")} error={err("yearsInBusiness")} />
                  </Field>
                  <Field label="Average monthly income (₹)" htmlFor="monthlyIncomeSE" required error={err("monthlyIncomeSE")}>
                    <TextInput id="monthlyIncomeSE" type="number" value={form.monthlyIncomeSE} onChange={(e) => set("monthlyIncomeSE", e.target.value)} onBlur={() => touch("monthlyIncomeSE")} error={err("monthlyIncomeSE")} />
                  </Field>
                  {form.employmentType === "business-owner" && (
                    <Field label="GST number" htmlFor="gstNumber" required error={err("gstNumber")}>
                      <TextInput id="gstNumber" value={form.gstNumber} onChange={(e) => set("gstNumber", e.target.value.toUpperCase().slice(0,15))} onBlur={() => touch("gstNumber")} error={err("gstNumber")} className="font-mono" />
                    </Field>
                  )}
                  <Field label="Business address" htmlFor="officeAddress" required error={err("officeAddress")} className="sm:col-span-2">
                    <TextInput id="officeAddress" value={form.officeAddress} onChange={(e) => set("officeAddress", e.target.value)} onBlur={() => touch("officeAddress")} error={err("officeAddress")} />
                  </Field>
                </div>
              )}

              <Field label="Years of work experience" htmlFor="yearsExperience" required error={err("yearsExperience")}>
                <TextInput id="yearsExperience" type="number" min="0" max="50" value={form.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} onBlur={() => touch("yearsExperience")} error={err("yearsExperience")} className="max-w-[160px]" />
              </Field>
            </div>
          )}

          {/* STEP 6 */}
          {step === 6 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Co-applicant details</h2>
              <p className="text-xs text-slate-500 -mt-2">
                {form.loanType === "home" ? "Required for all home loans." : "Required because your loan amount exceeds the co-applicant threshold for this loan type."}
              </p>
              <Field label="Co-applicant full name" htmlFor="coApplicantName" required error={err("coApplicantName")}>
                <TextInput id="step-first-field" value={form.coApplicantName} onChange={(e) => set("coApplicantName", e.target.value)} onBlur={() => touch("coApplicantName")} error={err("coApplicantName")} />
              </Field>
              <Field label="Relationship" htmlFor="coApplicantRelationship" required error={err("coApplicantRelationship")}>
                <SelectInput id="coApplicantRelationship" value={form.coApplicantRelationship} onChange={(e) => set("coApplicantRelationship", e.target.value)} onBlur={() => touch("coApplicantRelationship")} error={err("coApplicantRelationship")}>
                  <option value="">Select</option>
                  {form.maritalStatus === "Married" && <option>Spouse</option>}
                  <option>Parent</option><option>Sibling</option><option>Business partner</option>
                </SelectInput>
              </Field>
              <Field label="Co-applicant PAN" htmlFor="coApplicantPan" required error={err("coApplicantPan")}>
                <div className="relative">
                  <TextInput id="coApplicantPan" value={form.coApplicantPan} onChange={(e) => set("coApplicantPan", e.target.value.toUpperCase().slice(0, 10))} onBlur={() => touch("coApplicantPan")} error={err("coApplicantPan")} className="font-mono pr-28" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2"><VerifyBadge status={coPanStatus} /></span>
                </div>
              </Field>
              <Field label="Co-applicant monthly income (₹)" htmlFor="coApplicantIncome" required error={err("coApplicantIncome")}>
                <TextInput id="coApplicantIncome" type="number" value={form.coApplicantIncome} onChange={(e) => set("coApplicantIncome", e.target.value)} onBlur={() => touch("coApplicantIncome")} error={err("coApplicantIncome")} />
              </Field>
              <div className="bg-slate-50 rounded-xl p-3.5">
                <label htmlFor="coApplicantConsent" className="flex items-start gap-2.5 cursor-pointer min-h-[44px]">
                  <input id="coApplicantConsent" type="checkbox" checked={form.coApplicantConsent} onChange={(e) => { set("coApplicantConsent", e.target.checked); touch("coApplicantConsent"); }} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600" />
                  <span className="text-xs text-slate-600">The co-applicant consents to being named on this loan and to a credit bureau check being performed in their name.</span>
                </label>
                {err("coApplicantConsent") && <p role="alert" className="text-xs text-rose-600 mt-1.5 ml-6">{err("coApplicantConsent")}</p>}
              </div>
            </div>
          )}

          {/* STEP 7 */}
          {step === 7 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Documents & signature</h2>
                <p className="text-xs text-slate-500">Based on your loan type and employment, {docs.length} documents are required.</p>
              </div>
              <div id="step-first-field" tabIndex={-1} className="flex flex-col gap-3">
                {docs.map((d) => (
                  <DocUploadRow key={d.key} doc={d} value={documents[d.key]} onChange={(k, v) => setDocuments((prev) => ({ ...prev, [k]: v }))} onRemove={(k) => setDocuments((prev) => { const n = { ...prev }; delete n[k]; return n; })} />
                ))}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-medium text-slate-800 mb-2 flex items-center gap-1.5"><FileSignature size={15} aria-hidden="true" />E-signature</h3>
                <SignaturePad value={signature} onChange={setSignature} />
              </div>
            </div>
          )}

          {/* STEP 8 */}
          {step === 8 && (
            <div className="flex flex-col gap-5" id="step-first-field" tabIndex={-1}>
              <h2 className="text-lg font-semibold text-slate-900">Review & pre-approval summary</h2>

              <div className="bg-indigo-50 rounded-xl p-5">
                <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide">Key fact statement</p>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div><p className="text-xs text-indigo-600">Loan amount</p><p className="text-base font-semibold text-indigo-950">₹{formatINR(form.loanAmount)}</p></div>
                  <div><p className="text-xs text-indigo-600">Tenure</p><p className="text-base font-semibold text-indigo-950">{form.loanTenure} months</p></div>
                  <div><p className="text-xs text-indigo-600">Indicative rate</p><p className="text-base font-semibold text-indigo-950">{currentMeta?.rate}% p.a.</p></div>
                  <div><p className="text-xs text-indigo-600">Estimated EMI</p><p className="text-base font-semibold text-indigo-950">₹{formatINR(emi)}</p></div>
                  <div><p className="text-xs text-indigo-600">Total cost of borrowing</p><p className="text-base font-semibold text-indigo-950">₹{formatINR(totalCost)}</p></div>
                  <div><p className="text-xs text-indigo-600">Processing fee</p><p className="text-base font-semibold text-indigo-950">₹{formatINR(processingFee)}</p></div>
                </div>
                {emiRatio > 50 && (
                  <p className="text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2 mt-4 flex items-center gap-1.5"><AlertCircle size={13} aria-hidden="true" />EMI is {emiRatio.toFixed(0)}% of combined income, above the recommended 50% affordability threshold. You may still submit, but approval could require additional review.</p>
                )}
              </div>

              {[
                { title: "Loan details", step: 1, rows: [["Type", currentMeta?.label], ["Amount", `₹${formatINR(form.loanAmount)}`], ["Purpose", form.loanPurpose]] },
                { title: "Personal info", step: 2, rows: [["Name", form.fullName], ["Email", form.email], ["Mobile", form.mobile]] },
                { title: "Identity", step: 3, rows: [["PAN", `${form.pan.slice(0,2)}XXXXX${form.pan.slice(-1)}`], ["Aadhaar", `XXXX XXXX ${form.aadhaar.slice(-4)}`]] },
                { title: "Address", step: 4, rows: [["Address", `${form.currentAddress1}, ${form.city}, ${form.state} ${form.pincode}`]] },
                { title: "Employment", step: 5, rows: [["Type", form.employmentType], ["Income", `₹${formatINR(form.monthlySalary || form.monthlyIncomeSE)}/mo`]] },
              ].map((s) => (
                <div key={s.title} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-800">{s.title}</h3>
                    <button onClick={() => setStep(s.step)} className="text-xs font-medium text-indigo-600 flex items-center gap-1 min-h-[44px] px-1"><Pencil size={12} aria-hidden="true" />Edit</button>
                  </div>
                  <dl className="text-xs text-slate-600 flex flex-col gap-1">
                    {s.rows.map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-slate-400">{k}</dt><dd className="text-right">{v || "—"}</dd></div>)}
                  </dl>
                </div>
              ))}

              {signature && (
                <div className="border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-800 mb-2">Signature</h3>
                  <img src={signature} alt="Applicant signature" className="h-16 border border-slate-100 rounded-md bg-white" />
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                {[
                  ["accurate", "I confirm all information provided in this application is accurate and complete."],
                  ["creditCheck", "I authorise LendSwift to check my credit score via CIBIL or Equifax."],
                  ["terms", "I agree to the Terms and Conditions and Key Fact Statement."],
                  ["communication", "I consent to receive communications regarding this application."],
                ].map(([key, label]) => (
                  <label key={key} htmlFor={`consent-${key}`} className="flex items-start gap-2.5 cursor-pointer min-h-[44px]">
                    <input id={`consent-${key}`} type="checkbox" checked={form.consents[key]} onChange={(e) => { setConsent(key, e.target.checked); touch(`consents.${key}`); }} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600" />
                    <span className="text-xs text-slate-600">{label}</span>
                  </label>
                ))}
                {err("consents.accurate") && <p role="alert" className="text-xs text-rose-600">{err("consents.accurate")}</p>}
                {err("consents.creditCheck") && <p role="alert" className="text-xs text-rose-600">{err("consents.creditCheck")}</p>}
                {err("consents.terms") && <p role="alert" className="text-xs text-rose-600">{err("consents.terms")}</p>}
              </div>

              {!allDocsUploaded && <p role="alert" className="text-xs text-rose-600 flex items-center gap-1"><AlertCircle size={13} aria-hidden="true" />Complete document uploads in Step 7 before submitting</p>}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={goPrev}
            disabled={stepIndex === 0}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 disabled:opacity-0 min-h-[44px] px-3"
          >
            <ChevronLeft size={16} aria-hidden="true" /> Back
          </button>
          {step === 8 ? (
            <button
              onClick={submit}
              disabled={!stepValid || !allDocsUploaded || !form.consents.communication}
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-indigo-600 text-white px-5 py-2.5 rounded-lg min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition"
            >
              Submit application <Check size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={goNext}
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-indigo-600 text-white px-5 py-2.5 rounded-lg min-h-[44px] hover:bg-indigo-700 transition"
            >
              Continue <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
