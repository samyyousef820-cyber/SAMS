import { useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { cn } from "@/lib/utils";
import { API_BASE, queryClient } from "@/lib/queryClient";
import type { AttendanceStatus, Student } from "@shared/schema";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-label="SAMS Connect logo" className={className}>
      <rect x="1.5" y="1.5" width="37" height="37" rx="9" stroke="currentColor" strokeWidth="2" />
      <path d="M20 7.5l11 5v1.8H9v-1.8z" fill="currentColor" />
      <path d="M11.5 17h3v10h-3zM18.5 17h3v10h-3zM25.5 17h3v10h-3z" fill="currentColor" opacity=".9" />
      <path d="M9 29.5h22v3H9z" fill="currentColor" />
    </svg>
  );
}

// ---------- status ----------
export const STATUS_META: Record<AttendanceStatus, { label: string; cls: string; dot: string }> = {
  present: { label: "Present", cls: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900", dot: "bg-emerald-500" },
  late: { label: "Late", cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900", dot: "bg-amber-500" },
  absent: { label: "Absent", cls: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900", dot: "bg-red-500" },
  excused: { label: "Excused", cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700", dot: "bg-slate-400" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const m = STATUS_META[status as AttendanceStatus] ?? STATUS_META.excused;
  return (
    <span data-testid={`status-${status}`} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", m.cls, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function MethodTag({ method }: { method: string }) {
  const label: Record<string, string> = { qr: "QR", barcode: "Barcode", manual: "Manual", camera: "Camera", auto: "Auto" };
  return <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label[method] ?? method}</span>;
}

export function RateBar({ rate, threshold = 75 }: { rate: number; threshold?: number }) {
  const color = rate < threshold ? "bg-red-500" : rate < 85 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(2, rate)}%` }} />
      </div>
      <span className={cn("font-mono text-xs tabular w-11 text-end", rate < threshold && "text-red-600 dark:text-red-400 font-semibold")}>{rate.toFixed(1)}%</span>
    </div>
  );
}

// ---------- codes ----------
export function QrImage({ value, size = 120, className }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M", color: { dark: "#0b2e47", light: "#ffffff" } })
      .then(setSrc).catch(() => setSrc(""));
  }, [value, size]);
  return src ? <img src={src} width={size} height={size} alt={`QR code for ${value}`} className={cn("rounded-sm", className)} /> : <div style={{ width: size, height: size }} className="bg-muted rounded-sm" />;
}

export function Barcode({ value, height = 44, className }: { value: string; height?: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { format: "CODE128", height, width: 1.6, displayValue: false, margin: 0, lineColor: "#0b2e47", background: "transparent" });
      const w = ref.current.getAttribute("width"), h = ref.current.getAttribute("height");
      if (w && h) { ref.current.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`); ref.current.setAttribute("preserveAspectRatio", "none"); }
    } catch { /* ignore */ }
  }, [value, height]);
  return <svg ref={ref} className={className} aria-label={`Barcode for ${value}`} />;
}

export function IdCard({ student, compact = false }: { student: Student; compact?: boolean }) {
  return (
    <div className="rounded-lg border bg-white text-slate-900 overflow-hidden shadow-sm w-full" data-testid={`card-id-${student.studentCode}`}>
      <div className="flex items-center gap-2 bg-[#0b2e47] px-4 py-2 text-white">
        <Logo className="h-4 w-4" />
        <span className="text-xs font-semibold tracking-wide">SAMS · STUDENT ID</span>
        <span className="ms-auto text-[10px] opacity-80">2026 / 2027</span>
      </div>
      <div className={cn("flex gap-4 p-4", compact && "p-3 gap-3")}>
        <QrImage value={student.studentCode} size={compact ? 84 : 112} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight truncate">{student.name}</div>
          <div className="text-xs text-slate-500 truncate">{student.department} · Year {student.year}</div>
          <div className="mt-2 font-mono text-sm font-semibold tracking-wider">{student.studentCode}</div>
          <Barcode value={student.studentCode} height={compact ? 28 : 38} className="mt-2 max-w-full" />
        </div>
      </div>
    </div>
  );
}

// ---------- realtime ----------
type LiveState = { connected: boolean; lastEvent: number | null };
const LiveCtx = createContext<LiveState>({ connected: false, lastEvent: null });
export const useLive = () => useContext(LiveCtx);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState>({ connected: false, lastEvent: null });
  useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const refresh = () => queryClient.invalidateQueries();
    try {
      es = new EventSource(`${API_BASE}/api/stream`);
      es.addEventListener("hello", () => setState((s) => ({ ...s, connected: true })));
      es.addEventListener("change", () => { setState({ connected: true, lastEvent: Date.now() }); refresh(); });
      es.onerror = () => setState((s) => ({ ...s, connected: false }));
    } catch { /* SSE unavailable */ }
    // safety net: poll in case the stream is buffered by a proxy
    poll = setInterval(() => { if (!es || es.readyState !== 1) refresh(); }, 6000);
    return () => { es?.close(); if (poll) clearInterval(poll); };
  }, []);
  return <LiveCtx.Provider value={state}>{children}</LiveCtx.Provider>;
}

export function LiveDot({ label = true }: { label?: boolean }) {
  const { connected } = useLive();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="status-live">
      <span className="relative flex h-2 w-2">
        {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} />
      </span>
      {label && (connected ? "Live" : "Syncing")}
    </span>
  );
}

// ---------- layout helpers ----------
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, hint, accent, testId }: { label: string; value: ReactNode; hint?: ReactNode; accent?: string; testId?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4" data-testid={testId}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {accent && <span className={cn("h-2 w-2 rounded-sm", accent)} />}
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tabular font-mono">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
export function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function useNow(ms = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function EmptyState({ icon, title, body, hint }: { icon?: ReactNode; title: string; body?: string; hint?: string }) {
  body = body ?? hint;
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      {icon && <div className="text-muted-foreground mb-3">{icon}</div>}
      <div className="font-medium text-sm">{title}</div>
      {body && <div className="text-xs text-muted-foreground mt-1 max-w-xs">{body}</div>}
    </div>
  );
}

// ---------- SAMS UI kit ----------
const TONES: Record<string, { tile: string; icon: string; value: string }> = {
  blue: { tile: "bg-sky-50 border-sky-100 dark:bg-sky-950/30 dark:border-sky-900/50", icon: "bg-sky-500/15 text-sky-600 dark:text-sky-300", value: "text-sky-700 dark:text-sky-300" },
  green: { tile: "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/50", icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", value: "text-emerald-700 dark:text-emerald-300" },
  purple: { tile: "bg-violet-50 border-violet-100 dark:bg-violet-950/30 dark:border-violet-900/50", icon: "bg-violet-500/15 text-violet-600 dark:text-violet-300", value: "text-violet-700 dark:text-violet-300" },
  orange: { tile: "bg-orange-50 border-orange-100 dark:bg-orange-950/30 dark:border-orange-900/50", icon: "bg-orange-500/15 text-orange-600 dark:text-orange-300", value: "text-orange-700 dark:text-orange-300" },
  red: { tile: "bg-rose-50 border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/50", icon: "bg-rose-500/15 text-rose-600 dark:text-rose-300", value: "text-rose-700 dark:text-rose-300" },
  teal: { tile: "bg-teal-50 border-teal-100 dark:bg-teal-950/30 dark:border-teal-900/50", icon: "bg-teal-500/15 text-teal-600 dark:text-teal-300", value: "text-teal-700 dark:text-teal-300" },
  slate: { tile: "bg-card border-border", icon: "bg-muted text-muted-foreground", value: "text-foreground" },
};
export function StatTile({ icon, label, value, hint, tone = "blue", testId }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; tone?: keyof typeof TONES | string; testId?: string }) {
  const t = TONES[tone] ?? TONES.blue;
  return (
    <div className={cn("rounded-xl border p-3.5 flex items-center gap-3 min-w-0", t.tile)} data-testid={testId}>
      <div className={cn("h-10 w-10 shrink-0 rounded-xl grid place-items-center [&_svg]:h-5 [&_svg]:w-5", t.icon)}>{icon}</div>
      <div className="min-w-0">
        <div className={cn("text-lg font-bold tabular leading-tight whitespace-nowrap", t.value)}>{value}</div>
        <div className="text-xs text-muted-foreground leading-snug line-clamp-2">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground/80 truncate">{hint}</div>}
      </div>
    </div>
  );
}

export function Panel({ title, action, children, className, bodyClass }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,40,64,.04)]", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cn(title || action ? "px-5 pb-5" : "p-5", bodyClass)}>{children}</div>
    </section>
  );
}

export function PillTabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn("inline-flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1", className)} role="tablist">
      {items.map((i) => (
        <button key={i.value} role="tab" aria-selected={value === i.value} onClick={() => onChange(i.value)} data-testid={`tab-${i.value}`}
          className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-colors", value === i.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string; size?: number; className?: string }) {
  const initials = name.replace(/^(Dr\.|Prof\.)\s*/, "").split(" ").map((p) => p[0]).slice(0, 2).join("");
  if (src) return <img src={src} alt={name} width={size} height={size} className={cn("rounded-full object-cover shrink-0 bg-muted", className)} style={{ width: size, height: size }} />;
  return <div className={cn("rounded-full bg-primary/15 text-primary font-semibold grid place-items-center shrink-0", className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</div>;
}

export function GradePill({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = grade.startsWith("A") ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300" : grade.startsWith("B") ? "text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300" : grade.startsWith("C") ? "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300" : "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300";
  return <span dir="ltr" className={cn("inline-flex min-w-[34px] justify-center rounded-md px-2 py-0.5 text-xs font-bold", tone)}>{grade}</span>;
}

export function Pill({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "amber" | "red" | "slate" | "blue" }) {
  const c = { green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900", amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900", red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900", slate: "bg-muted text-muted-foreground border-border", blue: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900" }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", c)}>{children}</span>;
}

export function Progress({ value, tone }: { value: number; tone?: string }) {
  const c = tone ?? (value >= 75 ? "bg-emerald-500" : value >= 50 ? "bg-sky-500" : "bg-amber-500");
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full", c)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} /></div>
      <span className="text-xs tabular text-muted-foreground w-9 text-end">{Math.round(value)}%</span>
    </div>
  );
}

export function Donut({ value, size = 140, stroke = 14, label, sub }: { value: number; size?: number; stroke?: number; label?: string; sub?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const color = value >= 85 ? "#10b981" : value >= 75 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold tabular">{Math.round(value)}%</div>
        {label && <div className="text-[11px] text-muted-foreground">{label}</div>}
        {sub && <div className="text-[11px] font-semibold" style={{ color }}>{sub}</div>}
      </div>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("font-medium text-xs text-muted-foreground px-4 py-2.5 text-start bg-muted/40 whitespace-nowrap", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-sm", className)}>{children}</td>;
}
