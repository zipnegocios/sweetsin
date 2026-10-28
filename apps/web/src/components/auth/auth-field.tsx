"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/admin/admin-icons";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  toggleLabels?: { show: string; hide: string };
};

// Etiqueta flotante: el placeholder " " permite detectar el campo vacío con CSS puro (peer-placeholder-shown).
export function AuthField({ label, value, onChange, type = "text", toggleLabels, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="group relative">
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={isPassword && visible ? "text" : type}
        placeholder=" "
        className={`peer w-full rounded-2xl border border-navy/15 bg-white px-5 pb-2.5 pt-6 text-[15px] text-navy shadow-sm outline-none transition duration-200 hover:border-navy/30 focus:border-sin-red focus:ring-4 focus:ring-sin-red/15 ${isPassword ? "pr-14" : ""}`}
      />
      <label className="pointer-events-none absolute left-5 top-4 origin-left text-[15px] text-navy/45 transition-all duration-200 peer-focus:top-2 peer-focus:scale-75 peer-focus:text-sin-red peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:scale-75">
        {label}
      </label>
      {isPassword && toggleLabels && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? toggleLabels.hide : toggleLabels.show}
          aria-pressed={visible}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-navy/40 transition hover:bg-navy/5 hover:text-navy active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sin-red"
        >
          {visible ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
        </button>
      )}
    </div>
  );
}

export function AuthSubmit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-sin-red to-sin-red-dark py-4 text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(230,57,70,0.8)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-10px_rgba(230,57,70,0.9)] active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sin-red/30"
    >
      <span className="inline-flex items-center justify-center gap-2">
        {pending && <span className="auth-spinner size-4 rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
        {pending ? pendingLabel : label}
      </span>
    </button>
  );
}
