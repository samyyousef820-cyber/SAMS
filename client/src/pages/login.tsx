import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Presentation, ShieldCheck, ArrowRight, ArrowLeft, Eye, EyeOff, MapPin, Loader2, Languages, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared";
import { useAuth, useT } from "@/lib/app";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { AuthUser, Role } from "@shared/schema";

type Personas = { student: { identifier: string; name: string }; doctor: { identifier: string; name: string }; admin: { identifier: string; name: string }; password: string };

const ROLES: { role: Role; title: string; desc: string; icon: typeof GraduationCap; field: string; ph: string }[] = [
  { role: "student", title: "Student", desc: "Access your courses, schedule, grades and attendance", icon: GraduationCap, field: "Student ID or university email", ph: "e.g. 20251047" },
  { role: "doctor", title: "Doctor / Professor", desc: "Manage courses, take attendance and enter grades", icon: Presentation, field: "University email", ph: "name@sams.edu.eg" },
  { role: "admin", title: "Administrator", desc: "Manage students, staff, programs and reports", icon: ShieldCheck, field: "Admin email", ph: "admin@sams.edu.eg" },
];

export default function Login() {
  const { login } = useAuth();
  const { t, lang, setLang, dir } = useT();
  const { data: personas } = useQuery<Personas>({ queryKey: ["/api/auth/personas"] });
  const [role, setRole] = useState<Role | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const r = ROLES.find((x) => x.role === role);
  const Back = dir === "rtl" ? ArrowRight : ArrowLeft;
  const Fwd = dir === "rtl" ? ArrowLeft : ArrowRight;

  const pick = (x: Role) => { setRole(x); setErr(""); setIdentifier(""); setPassword(""); };
  const fillDemo = () => { if (personas && role) { setIdentifier(personas[role].identifier); setPassword(personas.password); setErr(""); } };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    setBusy(true); setErr("");
    try {
      const res = await apiRequest("POST", "/api/auth/login", { role, identifier, password });
      login((await res.json()) as AuthUser);
    } catch { setErr(t("Incorrect ID or password")); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.15fr_1fr] bg-background">
      {/* hero */}
      <div className="relative hidden lg:block overflow-hidden">
        <img src="img/campus.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06223a]/95 via-[#0b2e47]/55 to-[#0b2e47]/20" />
        <div className="relative h-full flex flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-3">
            <Logo className="h-12 w-12 text-white" />
            <div><div className="text-xl font-bold">SAMS Connect</div><div className="text-sm text-white/75">{t("Sadat Academy for Management Sciences")}</div></div>
          </div>
          <div className="max-w-lg">
            <h1 className="text-4xl font-bold leading-tight">{t("Build Your Future with Us")}</h1>
            <p className="mt-3 text-white/80 leading-relaxed">{t("One portal for students, faculty and administration — courses, schedules, grades, QR attendance, registration and fees.")}</p>
            <div className="mt-6 flex items-center gap-2 text-sm text-white/80"><MapPin className="h-4 w-4" />{t("6th of October City, Giza - Egypt")}</div>
          </div>
        </div>
      </div>

      {/* panel */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-2 lg:invisible">
            <Logo className="h-9 w-9 text-[#0b2e47] dark:text-white" />
            <span className="font-bold">SAMS Connect</span>
          </div>
          <button onClick={() => setLang(lang === "en" ? "ar" : "en")} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted" data-testid="button-login-lang">
            <Languages className="h-4 w-4" />{lang === "en" ? "عربي" : "English"}
          </button>
        </div>

        <div className="flex-1 grid place-items-center px-5 pb-10">
          <div className="w-full max-w-md">
            {/* mobile hero */}
            <div className="lg:hidden relative mb-6 h-40 rounded-2xl overflow-hidden">
              <img src="img/campus.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b2e47]/90 to-transparent" />
              <div className="absolute bottom-3 start-4 text-white"><div className="font-bold text-lg">{t("Build Your Future with Us")}</div><div className="text-xs text-white/80">{t("6th of October City, Giza - Egypt")}</div></div>
            </div>

            {!r ? (
              <>
                <h2 className="text-2xl font-bold">{t("Welcome to SAMS Connect")}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t("Choose how you want to sign in")}</p>
                <div className="mt-6 space-y-3">
                  {ROLES.map((x) => (
                    <button key={x.role} onClick={() => pick(x.role)} data-testid={`button-role-${x.role}`}
                      className="group w-full flex items-center gap-4 rounded-xl border bg-card p-4 text-start hover:border-primary hover:shadow-md transition-all">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"><x.icon className="h-6 w-6" /></div>
                      <div className="flex-1 min-w-0"><div className="font-semibold">{t(x.title)}</div><div className="text-xs text-muted-foreground">{t(x.desc)}</div></div>
                      <Fwd className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <form onSubmit={submit}>
                <button type="button" onClick={() => setRole(null)} className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="button-back-roles"><Back className="h-4 w-4" />{t("All roles")}</button>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground grid place-items-center"><r.icon className="h-6 w-6" /></div>
                  <div><h2 className="text-xl font-bold">{t("Sign in as {role}", { role: t(r.title) })}</h2><p className="text-xs text-muted-foreground">{t(r.desc)}</p></div>
                </div>
                <div className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="identifier">{t(r.field)}</Label>
                    <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={r.ph} autoFocus className="h-11" data-testid="input-identifier" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">{t("Password")}</Label>
                    <div className="relative">
                      <Input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pe-10" data-testid="input-password" dir="ltr" />
                      <button type="button" onClick={() => setShow((s) => !s)} className="absolute end-3 top-3 text-muted-foreground" aria-label="Show password">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    </div>
                  </div>
                  {err && <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-sm px-3 py-2" data-testid="text-login-error">{err}</div>}
                  <Button type="submit" className="w-full h-11 text-base" disabled={busy || !identifier || !password} data-testid="button-sign-in">
                    {busy && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t("Sign in")}
                  </Button>
                </div>
                {personas && (
                  <div className="mt-6 rounded-xl border border-dashed bg-muted/40 p-4 text-sm">
                    <div className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4 text-primary" />{t("Demo account")}</div>
                    <div className="mt-1.5 text-muted-foreground text-xs leading-relaxed">
                      {personas[r.role].name} · <span className="font-mono" dir="ltr">{personas[r.role].identifier}</span> · {t("password")} <span className="font-mono">{personas.password}</span>
                    </div>
                    <button type="button" onClick={fillDemo} className="mt-2 text-primary font-medium text-xs hover:underline" data-testid="button-fill-demo">{t("Use demo account")}</button>
                  </div>
                )}
              </form>
            )}
            <p className={cn("mt-8 text-center text-[11px] text-muted-foreground")}>© 2026 SAMS Connect · {t("Sadat Academy for Management Sciences")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
