export const BUTTON = {
    primary: "btn-brand inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
    ghost: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[13px] font-semibold text-white transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40",
    small: "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] text-zinc-400 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40",
};

export const CARD = "surface rounded-3xl p-5 sm:p-7";

// Small uppercase mono label above a heading, as on bluewolfchain.com
export const EYEBROW = "font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-brand-300/90";
export const LABEL = "font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500";

export const BADGES = {
    contract: "rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-violet-300",
    stuck: "rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300",
    clean: "rounded-full border border-mint-400/20 bg-mint-400/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mint-400",
    live: "rounded-full border border-brand-400/25 bg-brand-400/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-300",
};

export const badge = (kind, text) => `<span class="${BADGES[kind]}">${text}</span>`;

export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const isAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(String(s ?? "").trim());

export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

// Exact BigInt formatting: amounts here are what users will be credited on the new chain,
// so no Number rounding. Cuts (never rounds up) to `fixed` decimals.
export function money(amount, decimals = 18, fixed = 4) {
    const v = BigInt(amount ?? 0);
    const neg = v < 0n;
    const abs = neg ? -v : v;
    const base = 10n ** BigInt(decimals);
    const whole = (abs / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (fixed <= 0) return (neg ? "-" : "") + whole;
    const frac = (abs % base).toString().padStart(decimals, "0").slice(0, fixed).padEnd(fixed, "0");
    return `${neg ? "-" : ""}${whole}.${frac}`;
}

// Full precision as a plain decimal string (for CSV / copy)
export function units(amount, decimals = 18) {
    const v = BigInt(amount ?? 0);
    const base = 10n ** BigInt(decimals);
    const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "");
    return frac ? `${v / base}.${frac}` : `${v / base}`;
}

export function timeText(unix) {
    if (!unix) return "-";
    return new Date(unix * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
