import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser } from "@shared/schema";
import { AR } from "./i18n";
import { queryClient } from "./queryClient";

// ---------- auth (in-memory; the preview iframe blocks browser storage) ----------
type AuthCtx = { user: AuthUser | null; login: (u: AuthUser) => void; logout: () => void };
const Auth = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });
export const useAuth = () => useContext(Auth);
/** query string that identifies the current user for role-scoped endpoints */
export const useWho = () => { const { user } = useAuth(); return user ? `role=${user.role}&uid=${user.id}` : ""; };

// ---------- language ----------
export type Lang = "en" | "ar";
type LangCtx = { lang: Lang; setLang: (l: Lang) => void; t: (s: string, vars?: Record<string, string | number>) => string; dir: "ltr" | "rtl" };
const LangC = createContext<LangCtx>({ lang: "en", setLang: () => {}, t: (s) => s, dir: "ltr" });
export const useT = () => useContext(LangC);

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const t = (s: string, vars?: Record<string, string | number>) => {
    let out = lang === "ar" ? AR[s] ?? s : s;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
    return out;
  };
  return (
    <Auth.Provider value={{ user, login: (u) => { queryClient.clear(); setUser(u); window.location.hash = "#/"; }, logout: () => { setUser(null); queryClient.clear(); window.location.hash = "#/"; } }}>
      <LangC.Provider value={{ lang, setLang, t, dir: lang === "ar" ? "rtl" : "ltr" }}>{children}</LangC.Provider>
    </Auth.Provider>
  );
}

// ---------- formatting ----------
export const egp = (n: number, lang: Lang = "en") => `${n.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} ${lang === "ar" ? "ج.م" : "EGP"}`;
export const DAY_ORDER = [6, 0, 1, 2, 3, 4]; // Sat → Thu teaching week
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
export function fmt12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `\u2066${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}\u2069`;
}
export function fmtLongDate(d: string | Date, lang: Lang = "en") {
  const x = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return x.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}
// palette per course code for schedule blocks
const PALETTE = [
  "bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-100",
  "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100",
  "bg-violet-50 border-violet-300 text-violet-900 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-100",
  "bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100",
  "bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-100",
  "bg-teal-50 border-teal-300 text-teal-900 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-100",
  "bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-100",
  "bg-orange-50 border-orange-300 text-orange-900 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-100",
];
export const courseColor = (id: number) => PALETTE[id % PALETTE.length];
