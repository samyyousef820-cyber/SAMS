import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Download, Clock, MapPin, User2, CalendarDays, Plus, Loader2, GraduationCap, Wallet, Settings2, BellRing, CheckCheck,
  FileText, PartyPopper, Ban, AlarmClock, Mail, Phone, Home, IdCard as IdIcon, Pencil, Briefcase, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Panel, PillTabs, Avatar, Pill, EmptyState, timeAgo } from "@/components/shared";
import { useAuth, useT, useWho, DAY_ORDER, DAY_NAMES, DAY_SHORT, fmt12, fmtLongDate, courseColor } from "@/lib/app";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
import { PageTitle } from "./student";
import { cn } from "@/lib/utils";
import type { SlotView, AcademicEvent, Notification, Student, Staff } from "@shared/schema";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

// ============================== schedule ==============================
export function Schedule() {
  const { user } = useAuth();
  const { t, lang, dir } = useT();
  const [mode, setMode] = useState<"week" | "day">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [sel, setSel] = useState<SlotView | null>(null);
  const q = user!.role === "student" ? `studentId=${user!.id}` : user!.role === "doctor" ? `doctorId=${user!.id}` : "";
  const { data } = useQuery<SlotView[]>({ queryKey: [`/api/schedule?${q}`] });
  // week starts Saturday
  const weekStart = useMemo(() => { const d = new Date(anchor); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); return d; }, [anchor]);
  const days = mode === "week" ? DAY_ORDER.map((dw) => { const d = new Date(weekStart); d.setDate(d.getDate() + ((dw + 1) % 7)); return d; }) : [anchor];
  const startH = 8, endH = 18, hourPx = 64;
  const todayIso = iso(new Date());
  const shift = (n: number) => { const d = new Date(anchor); d.setDate(d.getDate() + n * (mode === "week" ? 7 : 1)); if (mode === "day" && d.getDay() === 5) d.setDate(d.getDate() + n); setAnchor(d); };
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft, Next = dir === "rtl" ? ChevronLeft : ChevronRight;
  const range = mode === "week" ? `${fmtLongDate(days[0], lang)} – ${fmtLongDate(days[days.length - 1], lang)}` : `${t(DAY_NAMES[anchor.getDay()])}, ${fmtLongDate(anchor, lang)}`;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  return (
    <div>
      <PageTitle title={t("Weekly Schedule")} subtitle={t(user!.role === "admin" ? "All lectures and sections this semester." : "Your lectures and sections for Fall 2026.")}
        actions={<Button variant="outline" asChild><a href={`${API_BASE}/api/schedule/export?${q}`} target="_blank" rel="noreferrer" data-testid="button-export-schedule"><Download className="h-4 w-4 me-2" />{t("Export Excel")}</a></Button>} />
      <Panel bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b">
          <PillTabs value={mode} onChange={setMode} items={[{ value: "week", label: t("Week") }, { value: "day", label: t("Day") }]} />
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => shift(-1)} aria-label="Previous"><Prev className="h-4 w-4" /></Button>
            <span className="text-sm font-medium min-w-[190px] text-center" data-testid="text-schedule-range">{range}</span>
            <Button size="icon" variant="ghost" onClick={() => shift(1)} aria-label="Next"><Next className="h-4 w-4" /></Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>{t("Today")}</Button>
          <span className="ms-auto text-xs text-muted-foreground">{t("Fall 2026")} · {data?.length ?? 0} {t("weekly sessions")}</span>
        </div>
        {!data ? <div className="p-5"><Skeleton className="h-96" /></div> : (
          <div className="overflow-x-auto">
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(${mode === "week" ? 130 : 260}px, 1fr))` }}>
              <div className="border-b" />
              {days.map((d) => (
                <div key={iso(d)} className={cn("border-b border-s px-2 py-2 text-center", iso(d) === todayIso && "bg-primary/5")}>
                  <div className={cn("text-xs", iso(d) === todayIso ? "text-primary font-semibold" : "text-muted-foreground")}>{t(DAY_SHORT[d.getDay()])}</div>
                  <div className={cn("text-lg font-bold tabular", iso(d) === todayIso && "text-primary")}>{d.getDate()}</div>
                </div>
              ))}
              <div className="relative" style={{ height: (endH - startH) * hourPx }}>
                {Array.from({ length: endH - startH }).map((_, i) => <div key={i} className="absolute end-2 text-[10.5px] text-muted-foreground tabular" style={{ top: i * hourPx - 6 }}>{i === 0 ? "" : fmt12(`${startH + i}:00`).replace(":00", "")}</div>)}
              </div>
              {days.map((d) => {
                const items = data.filter((s) => s.day === d.getDay());
                const isToday = iso(d) === todayIso;
                return (
                  <div key={iso(d)} className={cn("relative border-s", isToday && "bg-primary/[0.03]")} style={{ height: (endH - startH) * hourPx }}>
                    {Array.from({ length: endH - startH }).map((_, i) => <div key={i} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: i * hourPx }} />)}
                    {isToday && nowMin > startH * 60 && nowMin < endH * 60 && <div className="absolute inset-x-0 z-10 h-0.5 bg-rose-500" style={{ top: ((nowMin - startH * 60) / 60) * hourPx }}><span className="absolute -start-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" /></div>}
                    {items.map((s) => {
                      const top = ((toMin(s.start) - startH * 60) / 60) * hourPx, h = ((toMin(s.end) - toMin(s.start)) / 60) * hourPx;
                      return (
                        <button key={s.id} onClick={() => setSel(s)} data-testid={`slot-${s.course.code}-${s.day}`}
                          className={cn("absolute inset-x-1 rounded-lg border border-s-4 px-2 py-1.5 text-start overflow-hidden hover:shadow-md transition-shadow", courseColor(s.courseId))} style={{ top: top + 2, height: h - 4 }}>
                          <div className="text-[11px] font-mono font-semibold">{s.course.code}</div>
                          <div className="text-xs font-medium leading-tight line-clamp-2">{s.course.name}</div>
                          {h > 70 && <div className="mt-1 text-[10.5px] opacity-75">{fmt12(s.start)} – {fmt12(s.end)} · {s.room}</div>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="sm:max-w-md">
          {sel && <>
            <DialogHeader><DialogTitle><span className="font-mono text-primary me-2">{sel.course.code}</span>{sel.course.name}</DialogTitle></DialogHeader>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3"><CalendarDays className="h-4 w-4 text-primary mt-0.5" />{t(DAY_NAMES[sel.day])} · {t(sel.kind)}</li>
              <li className="flex gap-3"><Clock className="h-4 w-4 text-primary mt-0.5" />{fmt12(sel.start)} – {fmt12(sel.end)}</li>
              <li className="flex gap-3"><MapPin className="h-4 w-4 text-primary mt-0.5" />{t("Room")} {sel.room}</li>
              <li className="flex gap-3"><User2 className="h-4 w-4 text-primary mt-0.5" />{sel.course.instructor}</li>
              <li className="flex gap-3"><GraduationCap className="h-4 w-4 text-primary mt-0.5" />{sel.course.credits} {t("credit hours")} · {t(sel.course.department)}</li>
            </ul>
            <p className="text-xs text-muted-foreground">{sel.course.description}</p>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================== calendar ==============================
const CAT: Record<string, { label: string; cls: string; icon: typeof FileText }> = {
  exam: { label: "Exam", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900", icon: FileText },
  registration: { label: "Registration", cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900", icon: CalendarDays },
  activity: { label: "Activity", cls: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900", icon: PartyPopper },
  holiday: { label: "Holiday", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900", icon: Ban },
  deadline: { label: "Deadline", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900", icon: AlarmClock },
};
export function CalendarPage() {
  const { user } = useAuth();
  const { t, lang, dir } = useT();
  const { toast } = useToast();
  const [tab, setTab] = useState<"upcoming" | "full">("upcoming");
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: iso(new Date()), time: "", location: "", category: "activity" });
  const { data } = useQuery<AcademicEvent[]>({ queryKey: ["/api/calendar"] });
  const add = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/calendar", form)).json(),
    onSuccess: () => { queryClient.invalidateQueries(); setOpen(false); toast({ title: t("Event added"), description: t("Everyone has been notified.") }); setForm({ ...form, title: "" }); },
    onError: (e: Error) => toast({ title: t("Could not add event"), description: e.message, variant: "destructive" }),
  });
  const today = iso(new Date());
  const upcoming = (data ?? []).filter((e) => e.date >= today);
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft, Next = dir === "rtl" ? ChevronLeft : ChevronRight;
  const first = new Date(month), startPad = (first.getDay() + 1) % 7; // Saturday-first
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startPad + daysIn) / 7) * 7 }, (_, i) => { const n = i - startPad + 1; return n >= 1 && n <= daysIn ? new Date(month.getFullYear(), month.getMonth(), n) : null; });
  return (
    <div>
      <PageTitle title={t("Academic Calendar")} subtitle={t("Exams, deadlines, holidays and student activities for 2026 - 2027.")}
        actions={user!.role === "admin" && <Button onClick={() => setOpen(true)} data-testid="button-add-event"><Plus className="h-4 w-4 me-2" />{t("Add Event")}</Button>} />
      <PillTabs className="mb-5" value={tab} onChange={setTab} items={[{ value: "upcoming", label: t("Upcoming Events") }, { value: "full", label: t("Full Calendar") }]} />
      {!data ? <Skeleton className="h-96" /> : tab === "upcoming" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {upcoming.length === 0 && <EmptyState title={t("No upcoming events")} />}
          {upcoming.map((e) => {
            const c = CAT[e.category] ?? CAT.activity;
            const d = new Date(e.date + "T00:00:00");
            const days = Math.round((d.getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
            return (
              <div key={e.id} className="flex gap-4 rounded-xl border bg-card p-4" data-testid={`event-${e.id}`}>
                <div className="w-14 shrink-0 rounded-lg bg-primary/10 text-primary text-center py-1.5">
                  <div className="text-[11px] font-semibold uppercase">{d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { month: "short" })}</div>
                  <div className="text-xl font-bold tabular leading-none">{d.getDate()}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-snug">{t(e.title)}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {e.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.time}</span>}
                    {e.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t(e.location)}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", c.cls)}>{t(c.label)}</span>
                  <span className="text-[11px] text-muted-foreground">{days === 0 ? t("Today") : days === 1 ? t("Tomorrow") : t("in {n} days", { n: days })}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Panel bodyClass="p-0">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <Button size="icon" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Prev className="h-4 w-4" /></Button>
            <div className="font-semibold">{month.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" })}</div>
            <Button size="icon" variant="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Next className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-muted-foreground border-b">{DAY_ORDER.concat([5]).map((d) => <div key={d} className="py-2">{t(DAY_SHORT[d])}</div>)}</div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const evs = d ? data.filter((e) => e.date === iso(d)) : [];
              return (
                <div key={i} className={cn("min-h-[92px] border-b border-s p-1.5", !d && "bg-muted/30", d && iso(d) === today && "bg-primary/5")}>
                  {d && <div className={cn("text-xs tabular mb-1", iso(d) === today ? "font-bold text-primary" : "text-muted-foreground")}>{d.getDate()}</div>}
                  <div className="space-y-1">{evs.map((e) => <div key={e.id} className={cn("rounded px-1.5 py-0.5 text-[10.5px] leading-tight border truncate", (CAT[e.category] ?? CAT.activity).cls)} title={e.title}>{t(e.title)}</div>)}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("Add Event")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("Title")}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" data-testid="input-event-title" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("Date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1" /></div>
              <div><Label>{t("Time")}</Label><Input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="10:00 AM" className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("Location")}</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" /></div>
              <div><Label>{t("Category")}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CAT).map(([k, v]) => <SelectItem key={k} value={k}>{t(v.label)}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("Cancel")}</Button><Button onClick={() => add.mutate()} disabled={form.title.length < 2 || add.isPending} data-testid="button-save-event">{add.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t("Save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================== notifications ==============================
const NCAT: Record<string, { icon: typeof BellRing; cls: string }> = {
  academic: { icon: GraduationCap, cls: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  financial: { icon: Wallet, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  system: { icon: Settings2, cls: "bg-violet-500/15 text-violet-600 dark:text-violet-300" },
};
export function NotificationsPage() {
  const { t } = useT();
  const who = useWho();
  const [tab, setTab] = useState<"all" | "academic" | "financial" | "system">("all");
  const { data } = useQuery<Notification[]>({ queryKey: [`/api/notifications?${who}`] });
  const readAll = useMutation({ mutationFn: () => apiRequest("POST", `/api/notifications/read-all?${who}`), onSuccess: () => queryClient.invalidateQueries() });
  const readOne = useMutation({ mutationFn: (id: number) => apiRequest("POST", `/api/notifications/${id}/read`), onSuccess: () => queryClient.invalidateQueries() });
  const list = (data ?? []).filter((n) => tab === "all" || n.category === tab);
  const unread = (data ?? []).filter((n) => !n.read).length;
  return (
    <div>
      <PageTitle title={t("Notifications")} subtitle={`${unread} ${t("unread")}`}
        actions={<Button variant="outline" onClick={() => readAll.mutate()} disabled={!unread} data-testid="button-read-all"><CheckCheck className="h-4 w-4 me-2" />{t("Mark all as read")}</Button>} />
      <PillTabs className="mb-5" value={tab} onChange={setTab} items={[{ value: "all", label: t("All") }, { value: "academic", label: t("Academic") }, { value: "financial", label: t("Financial") }, { value: "system", label: t("System") }]} />
      <Panel bodyClass="p-0">
        {!data ? <div className="p-5"><Skeleton className="h-60" /></div> : list.length === 0 ? <EmptyState title={t("You're all caught up")} /> : (
          <ul className="divide-y">{list.map((n) => {
            const c = NCAT[n.category] ?? NCAT.system;
            return (
              <li key={n.id} onClick={() => !n.read && readOne.mutate(n.id)} className={cn("flex gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30", !n.read && "bg-primary/[0.035]")} data-testid={`notification-${n.id}`}>
                <div className={cn("h-10 w-10 rounded-full grid place-items-center shrink-0", c.cls)}><c.icon className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className={cn("text-sm", !n.read ? "font-semibold" : "font-medium")}>{t(n.title)}</span>{!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}</div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(n.createdAt)}</span>
              </li>
            );
          })}</ul>
        )}
      </Panel>
    </div>
  );
}

// ============================== profile ==============================
export function ProfilePage() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const { toast } = useToast();
  const isStudent = user!.role === "student";
  const [tab, setTab] = useState<"personal" | "academic" | "contact">("personal");
  const { data: s } = useQuery<Student>({ queryKey: [`/api/student/${user!.id}/profile`], enabled: isStudent });
  const { data: d } = useQuery<Staff>({ queryKey: [`/api/doctor/${user!.id}/profile`], enabled: !isStudent });
  const { data: ov } = useQuery<{ cumulativeGpa: number; earnedCredits: number; standing: string; registeredCredits: number }>({ queryKey: [`/api/student/${user!.id}/overview`], enabled: isStudent });
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ email: "", phone: "", address: "" });
  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/student/${user!.id}/profile`, form)).json(),
    onSuccess: () => { queryClient.invalidateQueries(); setEdit(false); toast({ title: t("Profile updated") }); },
    onError: (e: Error) => toast({ title: t("Could not save"), description: e.message, variant: "destructive" }),
  });
  const p = isStudent ? s : d;
  if (!p) return <Skeleton className="h-96" />;
  const Row = ({ icon: I, k, v }: { icon: typeof Mail; k: string; v: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-3"><I className="h-4 w-4 text-primary mt-0.5 shrink-0" /><div className="min-w-0"><div className="text-[11px] text-muted-foreground">{t(k)}</div><div className="text-sm font-medium break-words">{v}</div></div></div>
  );
  return (
    <div>
      <PageTitle title={t("Profile")} actions={isStudent && <Button variant="outline" onClick={() => { setForm({ email: s!.email, phone: s!.phone, address: s!.address }); setEdit(true); }} data-testid="button-edit-profile"><Pencil className="h-4 w-4 me-2" />{t("Edit Profile")}</Button>} />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Panel>
          <div className="text-center">
            <Avatar name={p.name} src={user!.avatar} size={112} className="mx-auto ring-4 ring-primary/10" />
            <h2 className="mt-3 text-lg font-bold">{p.name}</h2>
            <div className="text-sm text-muted-foreground">{isStudent ? t(s!.program) : `${t(d!.title)} · ${t(d!.department)}`}</div>
            {isStudent && <div className="mt-2 font-mono text-sm text-primary">{s!.studentCode}</div>}
            {isStudent && ov && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 py-2"><div className="text-lg font-bold tabular">{ov.cumulativeGpa.toFixed(2)}</div><div className="text-[11px] text-muted-foreground">{t("Cumulative GPA")}</div></div>
                <div className="rounded-lg bg-muted/50 py-2"><div className="text-lg font-bold tabular">{ov.earnedCredits}</div><div className="text-[11px] text-muted-foreground">{t("Earned Credit Hours")}</div></div>
              </div>
            )}
          </div>
        </Panel>
        <Panel title={isStudent ? <PillTabs value={tab} onChange={setTab} items={[{ value: "personal", label: t("Personal Info") }, { value: "academic", label: t("Academic Info") }, { value: "contact", label: t("Contact Info") }]} /> : t("Staff Information")}>
          {isStudent ? (
            <div className="grid sm:grid-cols-2 gap-x-8 divide-y sm:divide-y-0">
              {tab === "personal" && <>
                <Row icon={User2} k="Full name" v={s!.name} />
                <Row icon={IdIcon} k="National ID" v={<span className="font-mono">{s!.nationalId.slice(0, 4)}••••••{s!.nationalId.slice(-4)}</span>} />
                <Row icon={CalendarDays} k="Date of birth" v={fmtLongDate(s!.dob, lang)} />
                <Row icon={User2} k="Gender" v={t(s!.gender)} />
                <Row icon={Home} k="Nationality" v={t("Egyptian")} />
              </>}
              {tab === "academic" && <>
                <Row icon={IdIcon} k="Student ID" v={<span className="font-mono">{s!.studentCode}</span>} />
                <Row icon={Building2} k="Faculty" v={t(s!.department)} />
                <Row icon={GraduationCap} k="Program" v={t(s!.program)} />
                <Row icon={CalendarDays} k="Level" v={t(`Level ${s!.year}`)} />
                <Row icon={Briefcase} k="Academic Status" v={<Pill tone="green">{t(ov?.standing ?? "Good Standing")}</Pill>} />
                <Row icon={Clock} k="Registered credit hours" v={ov?.registeredCredits ?? "—"} />
              </>}
              {tab === "contact" && <>
                <Row icon={Mail} k="University email" v={s!.email} />
                <Row icon={Phone} k="Phone" v={<span dir="ltr">{s!.phone}</span>} />
                <Row icon={Home} k="Address" v={t(s!.address)} />
              </>}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-8">
              <Row icon={Mail} k="University email" v={d!.email} />
              <Row icon={Phone} k="Phone" v={<span dir="ltr">{d!.phone}</span>} />
              <Row icon={Building2} k="Department" v={t(d!.department)} />
              <Row icon={MapPin} k="Office" v={d!.office} />
              <Row icon={Briefcase} k="Academic title" v={t(d!.title)} />
            </div>
          )}
        </Panel>
      </div>
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("Edit Profile")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("University email")}</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" dir="ltr" /></div>
            <div><Label>{t("Phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" dir="ltr" data-testid="input-profile-phone" /></div>
            <div><Label>{t("Address")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(false)}>{t("Cancel")}</Button><Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-profile">{save.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t("Save changes")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
