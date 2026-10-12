import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Briefcase, Building2, Library, UserPlus, FileSpreadsheet, CalendarRange, Plus, Activity as ActivityIcon, ClipboardCheck, AlertTriangle, Wallet, Loader2, Search, BookOpen, CheckCircle2, Receipt } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { StatTile, Panel, PillTabs, Avatar, Pill, Progress, Th, Td, EmptyState, timeAgo } from "@/components/shared";
import { useAuth, useT, egp, DAY_NAMES, DAY_SHORT, DAY_ORDER, fmt12, fmtLongDate, greeting } from "@/lib/app";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageTitle } from "./student";
import { cn } from "@/lib/utils";
import type { Activity, Course, SlotView, Staff, Student, Payment } from "@shared/schema";

type AOverview = {
  totals: { students: number; staff: number; departments: number; programs: number; courses: number }; attendanceRate: number; atRisk: number;
  todayCounts: { present: number; late: number; absent: number; excused: number; awaiting: number; expected: number };
  trend: { date: string; rate: number }[]; finance: { collected: number; outstanding: number }; activities: Activity[]; byDepartment: { department: string; students: number }[];
};
const ACT_TONE: Record<string, string> = { student: "bg-sky-500", payment: "bg-emerald-500", registration: "bg-violet-500", course: "bg-amber-500", report: "bg-teal-500", staff: "bg-indigo-500", calendar: "bg-rose-500", session: "bg-primary" };
const COLORS = ["#0f8a74", "#2563eb", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6"];

export function AdminDashboard() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const [, navigate] = useLocation();
  const { data } = useQuery<AOverview>({ queryKey: ["/api/admin/overview"] });
  if (!data) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-72" /></div>;
  const tc = data.todayCounts;
  return (
    <div>
      <PageTitle title={`${t(greeting())}${t(",")} ${user!.name.split(" ")[0]}`} subtitle={t("Academy-wide overview for Fall 2026.")} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile tone="blue" icon={<Users />} label={t("Total Students")} value={data.totals.students} testId="tile-total-students" />
        <StatTile tone="green" icon={<Briefcase />} label={t("Academic Staff")} value={data.totals.staff} />
        <StatTile tone="purple" icon={<Building2 />} label={t("Departments")} value={data.totals.departments} />
        <StatTile tone="orange" icon={<Library />} label={t("Programs")} value={data.totals.programs} />
        <StatTile tone="teal" icon={<ClipboardCheck />} label={t("Attendance rate (30 days)")} value={`${data.attendanceRate}%`} />
        <StatTile tone="red" icon={<AlertTriangle />} label={t("Students below 75%")} value={data.atRisk} />
        <StatTile tone="green" icon={<Wallet />} label={t("Fees collected")} value={egp(data.finance.collected, lang)} />
        <StatTile tone="orange" icon={<Receipt />} label={t("Outstanding fees")} value={egp(data.finance.outstanding, lang)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5 min-w-0">
          <Panel title={t("Attendance trend")} action={<Link href="/analytics" className="text-sm text-primary font-medium hover:underline">{t("Attendance Overview")}</Link>}>
            <div className="h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ left: -18, right: 8, top: 6 }}>
                  <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f8a74" stopOpacity={0.3} /><stop offset="100%" stopColor="#0f8a74" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}%`, t("Attendance")]} />
                  <Area type="monotone" dataKey="rate" stroke="#0f8a74" strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <div className="grid gap-5 md:grid-cols-2">
            <Panel title={t("Today's check-ins")}>
              <div className="grid grid-cols-2 gap-2 text-center">
                {[["Present", tc.present, "text-emerald-600"], ["Late", tc.late, "text-amber-600"], ["Absent", tc.absent, "text-rose-600"], ["Awaiting", tc.awaiting, "text-muted-foreground"]].map(([k, v, c]) => (
                  <div key={k as string} className="rounded-lg bg-muted/50 py-3"><div className={cn("text-2xl font-bold tabular", c as string)}>{v}</div><div className="text-[11px] text-muted-foreground">{t(k as string)}</div></div>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{tc.expected} {t("expected check-ins across today's classes")}</div>
            </Panel>
            <Panel title={t("Students by department")}>
              <div className="flex items-center gap-4">
                <div className="h-36 w-36 shrink-0" dir="ltr"><ResponsiveContainer><PieChart><Pie data={data.byDepartment} dataKey="students" nameKey="department" innerRadius={38} outerRadius={64} paddingAngle={2}>{data.byDepartment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie></PieChart></ResponsiveContainer></div>
                <ul className="space-y-1.5 text-xs min-w-0 flex-1">{data.byDepartment.map((d, i) => <li key={d.department} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} /><span className="truncate flex-1">{t(d.department)}</span><span className="tabular font-medium">{d.students}</span></li>)}</ul>
              </div>
            </Panel>
          </div>
        </div>
        <div className="space-y-5">
          <Panel title={t("Quick Actions")}>
            <div className="grid grid-cols-2 gap-2">
              {[[UserPlus, "Add Student", "/students"], [Briefcase, "Add Staff", "/staff"], [FileSpreadsheet, "Generate Report", "/reports"], [CalendarRange, "View Academic Calendar", "/calendar"]].map(([I, l, h]) => {
                const Icon = I as typeof UserPlus;
                return (
                  <button key={l as string} onClick={() => navigate(h as string)} className="flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-xs font-medium hover:border-primary hover:bg-primary/5 transition-colors" data-testid={`quick-${(l as string).split(" ")[0].toLowerCase()}`}>
                    <span className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center"><Icon className="h-5 w-5" /></span>{t(l as string)}
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel title={t("Recent Activities")}>
            <ul className="space-y-3.5">{data.activities.map((a) => (
              <li key={a.id} className="flex gap-3"><span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", ACT_TONE[a.kind] ?? "bg-muted-foreground")} /><div className="min-w-0"><div className="text-sm leading-snug">{a.text}</div><div className="text-[11px] text-muted-foreground">{timeAgo(a.at)}</div></div></li>
            ))}</ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ============================== staff ==============================
type StaffRow = Staff & { courses: string[] };
const TITLES = ["Professor", "Associate Professor", "Assistant Professor", "Lecturer", "Teaching Assistant"];
export function StaffPage() {
  const { t } = useT();
  const { toast } = useToast();
  const { data } = useQuery<StaffRow[]>({ queryKey: ["/api/staff"] });
  const { data: meta } = useQuery<{ departments: string[] }>({ queryKey: ["/api/meta"] });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", title: TITLES[2], department: "", email: "", phone: "", office: "" });
  const add = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/staff", form)).json(),
    onSuccess: () => { queryClient.invalidateQueries(); setOpen(false); toast({ title: t("Staff member added") }); setForm({ name: "", title: TITLES[2], department: "", email: "", phone: "", office: "" }); },
    onError: (e: Error) => toast({ title: t("Could not add staff member"), description: e.message, variant: "destructive" }),
  });
  const list = (data ?? []).filter((s) => !q || (s.name + s.email + s.department).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageTitle title={t("Academic Staff")} subtitle={t("Faculty members, their departments and teaching load.")} actions={<Button onClick={() => setOpen(true)} data-testid="button-add-staff"><UserPlus className="h-4 w-4 me-2" />{t("Add Staff")}</Button>} />
      <Panel bodyClass="p-0" action={<div className="relative"><Search className="h-4 w-4 absolute start-2.5 top-2.5 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search staff")} className="h-9 ps-8 w-56" /></div>} title={`${list.length} ${t("staff members")}`}>
        {!data ? <div className="p-5"><Skeleton className="h-60" /></div> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><Th>{t("Name")}</Th><Th>{t("Academic title")}</Th><Th>{t("Department")}</Th><Th>{t("Email")}</Th><Th>{t("Office")}</Th><Th>{t("Courses")}</Th></tr></thead>
            <tbody className="divide-y">{list.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30"><Td><div className="flex items-center gap-2.5"><Avatar name={s.name} size={32} src={s.id === 1 ? "img/doctor.jpg" : undefined} /><span className="font-medium">{s.name}</span></div></Td>
                <Td className="text-muted-foreground">{t(s.title)}</Td><Td>{t(s.department)}</Td><Td className="text-xs text-muted-foreground">{s.email}</Td><Td className="text-xs">{s.office || "—"}</Td>
                <Td><div className="flex flex-wrap gap-1">{s.courses.length ? s.courses.map((c) => <span key={c} className="font-mono text-[10.5px] rounded bg-muted px-1.5 py-0.5">{c}</span>) : <span className="text-xs text-muted-foreground">—</span>}</div></Td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Panel>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("Add Staff")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("Full name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. …" className="mt-1" data-testid="input-staff-name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("Academic title")}</Label><Select value={form.title} onValueChange={(v) => setForm({ ...form, title: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{TITLES.map((x) => <SelectItem key={x} value={x}>{t(x)}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>{t("Department")}</Label><Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}><SelectTrigger className="mt-1" data-testid="select-staff-dept"><SelectValue placeholder={t("Choose…")} /></SelectTrigger><SelectContent>{meta?.departments.map((x) => <SelectItem key={x} value={x}>{t(x)}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>{t("University email")}</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@sams.edu.eg" className="mt-1" dir="ltr" data-testid="input-staff-email" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("Phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" dir="ltr" /></div>
              <div><Label>{t("Office")}</Label><Input value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("Cancel")}</Button><Button onClick={() => add.mutate()} disabled={add.isPending || !form.name || !form.department || !form.email} data-testid="button-save-staff">{add.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t("Save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================== programs & courses ==============================
type Prog = { name: string; department: string; students: number; courses: number };
type ACourse = { course: Course; slots: SlotView[]; enrolled: number };
export function ProgramsPage() {
  const { t } = useT();
  const { toast } = useToast();
  const [tab, setTab] = useState<"programs" | "courses">("programs");
  const { data: progs } = useQuery<Prog[]>({ queryKey: ["/api/programs"] });
  const { data: courses } = useQuery<ACourse[]>({ queryKey: ["/api/admin/courses"] });
  const { data: staffList } = useQuery<StaffRow[]>({ queryKey: ["/api/staff"] });
  const { data: meta } = useQuery<{ departments: string[] }>({ queryKey: ["/api/meta"] });
  const [open, setOpen] = useState(false);
  const blank = { code: "", name: "", credits: "3", department: "", doctorId: "", capacity: "60", level: "1", day: "0", start: "10:00", end: "11:30", room: "" };
  const [f, setF] = useState(blank);
  const add = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/courses", f)).json(),
    onSuccess: () => { queryClient.invalidateQueries(); setOpen(false); setF(blank); toast({ title: t("Course published"), description: t("Students can now register for it.") }); },
    onError: (e: Error) => toast({ title: t("Could not create course"), description: e.message, variant: "destructive" }),
  });
  return (
    <div>
      <PageTitle title={t("Academic Programs")} subtitle={t("Degree programs and the courses offered this semester.")} actions={<Button onClick={() => setOpen(true)} data-testid="button-add-course"><Plus className="h-4 w-4 me-2" />{t("New Course")}</Button>} />
      <PillTabs className="mb-5" value={tab} onChange={setTab} items={[{ value: "programs", label: t("Programs") }, { value: "courses", label: t("Offered Courses") }]} />
      {tab === "programs" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(progs ?? []).map((p, i) => (
            <Panel key={p.name}>
              <div className="h-10 w-10 rounded-xl grid place-items-center text-white" style={{ background: COLORS[i % COLORS.length] }}><Library className="h-5 w-5" /></div>
              <h3 className="mt-3 font-semibold leading-snug">{t(p.name)}</h3>
              <div className="text-xs text-muted-foreground">{t(p.department)}</div>
              <div className="mt-4 flex gap-6 text-sm"><div><div className="text-xl font-bold tabular">{p.students}</div><div className="text-[11px] text-muted-foreground">{t("Students")}</div></div><div><div className="text-xl font-bold tabular">{p.courses}</div><div className="text-[11px] text-muted-foreground">{t("Courses")}</div></div><div><div className="text-xl font-bold tabular">132</div><div className="text-[11px] text-muted-foreground">{t("Credit hours")}</div></div></div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel bodyClass="p-0">
          {!courses ? <div className="p-5"><Skeleton className="h-60" /></div> : (
            <div className="overflow-x-auto"><table className="w-full">
              <thead><tr><Th>{t("Course Code")}</Th><Th>{t("Course Name")}</Th><Th>{t("Department")}</Th><Th>{t("Instructor")}</Th><Th>{t("Credits")}</Th><Th>{t("Schedule")}</Th><Th>{t("Enrollment")}</Th></tr></thead>
              <tbody className="divide-y">{courses.map((c) => (
                <tr key={c.course.id} className="hover:bg-muted/30"><Td className="font-mono text-xs font-semibold text-primary">{c.course.code}</Td><Td className="font-medium">{c.course.name}</Td><Td className="text-xs">{t(c.course.department)}</Td>
                  <Td className="text-muted-foreground whitespace-nowrap">{c.course.instructor}</Td><Td className="tabular">{c.course.credits}</Td>
                  <Td className="text-xs text-muted-foreground whitespace-nowrap">{c.slots.map((s) => `${t(DAY_SHORT[s.day])} ${fmt12(s.start)}`).join(" · ")}</Td>
                  <Td><Progress value={(c.enrolled / c.course.capacity) * 100} /><div className="text-[10.5px] text-muted-foreground tabular">{c.enrolled}/{c.course.capacity}</div></Td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Panel>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("New Course")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t("Course Code")}</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="FIN201" className="mt-1 font-mono" data-testid="input-course-code" /></div>
            <div><Label>{t("Credits")}</Label><Input type="number" value={f.credits} onChange={(e) => setF({ ...f, credits: e.target.value })} className="mt-1" /></div>
            <div className="col-span-2"><Label>{t("Course Name")}</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-1" data-testid="input-course-name" /></div>
            <div><Label>{t("Department")}</Label><Select value={f.department} onValueChange={(v) => setF({ ...f, department: v })}><SelectTrigger className="mt-1"><SelectValue placeholder={t("Choose…")} /></SelectTrigger><SelectContent>{meta?.departments.map((x) => <SelectItem key={x} value={x}>{t(x)}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>{t("Instructor")}</Label><Select value={f.doctorId} onValueChange={(v) => setF({ ...f, doctorId: v })}><SelectTrigger className="mt-1"><SelectValue placeholder={t("Choose…")} /></SelectTrigger><SelectContent>{staffList?.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>{t("Day")}</Label><Select value={f.day} onValueChange={(v) => setF({ ...f, day: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{DAY_ORDER.map((d) => <SelectItem key={d} value={String(d)}>{t(DAY_NAMES[d])}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>{t("Room")}</Label><Input value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} placeholder="B204" className="mt-1" /></div>
            <div><Label>{t("Start")}</Label><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className="mt-1" /></div>
            <div><Label>{t("End")}</Label><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className="mt-1" /></div>
            <div><Label>{t("Level")}</Label><Input type="number" min={1} max={4} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} className="mt-1" /></div>
            <div><Label>{t("Capacity")}</Label><Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} className="mt-1" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("Cancel")}</Button><Button onClick={() => add.mutate()} disabled={add.isPending || !f.code || !f.name || !f.department || !f.doctorId || !f.room} data-testid="button-save-course">{add.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t("Publish course")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================== finance ==============================
type Fin = { totalFees: number; collected: number; outstanding: number; recent: (Payment & { student: Student })[]; balances: { student: Student; total: number; paid: number; remaining: number }[]; methods: { method: string; s: number }[] };
export function FinancePage() {
  const { t, lang } = useT();
  const [tab, setTab] = useState<"payments" | "balances">("payments");
  const { data } = useQuery<Fin>({ queryKey: ["/api/finance"] });
  if (!data) return <Skeleton className="h-96" />;
  const rate = Math.round((data.collected / Math.max(1, data.totalFees)) * 100);
  return (
    <div>
      <PageTitle title={t("Finance")} subtitle={t("Tuition billed, collected and outstanding for Fall 2026.")} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile tone="blue" icon={<Receipt />} label={t("Total billed")} value={egp(data.totalFees, lang)} />
        <StatTile tone="green" icon={<CheckCircle2 />} label={t("Collected")} value={egp(data.collected, lang)} />
        <StatTile tone="red" icon={<Wallet />} label={t("Outstanding")} value={egp(data.outstanding, lang)} />
        <StatTile tone="purple" icon={<ActivityIcon />} label={t("Collection rate")} value={`${rate}%`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel bodyClass="p-0" title={<PillTabs value={tab} onChange={setTab} items={[{ value: "payments", label: t("Recent Payments") }, { value: "balances", label: t("Outstanding Balances") }]} />}>
          <div className="overflow-x-auto"><table className="w-full">
            {tab === "payments" ? <>
              <thead><tr><Th>{t("Date")}</Th><Th>{t("Student")}</Th><Th>{t("Method")}</Th><Th>{t("Reference")}</Th><Th className="text-end">{t("Amount")}</Th></tr></thead>
              <tbody className="divide-y">{data.recent.map((p) => <tr key={p.id} className="hover:bg-muted/30"><Td className="whitespace-nowrap">{fmtLongDate(p.date, lang)}</Td><Td><div className="font-medium">{p.student.name}</div><div className="font-mono text-[10.5px] text-muted-foreground">{p.student.studentCode}</div></Td><Td className="text-xs">{t(p.method)}</Td><Td className="font-mono text-[11px] text-muted-foreground">{p.reference}</Td><Td className="text-end tabular font-medium whitespace-nowrap">{egp(p.amount, lang)}</Td></tr>)}</tbody>
            </> : <>
              <thead><tr><Th>{t("Student")}</Th><Th>{t("Department")}</Th><Th className="text-end">{t("Total")}</Th><Th className="text-end">{t("Paid")}</Th><Th className="text-end">{t("Remaining")}</Th></tr></thead>
              <tbody className="divide-y">{data.balances.map((b) => <tr key={b.student.id} className="hover:bg-muted/30"><Td><div className="font-medium">{b.student.name}</div><div className="font-mono text-[10.5px] text-muted-foreground">{b.student.studentCode}</div></Td><Td className="text-xs">{t(b.student.department)}</Td><Td className="text-end tabular whitespace-nowrap">{egp(b.total, lang)}</Td><Td className="text-end tabular whitespace-nowrap text-emerald-600">{egp(b.paid, lang)}</Td><Td className="text-end tabular whitespace-nowrap font-semibold text-rose-600">{egp(b.remaining, lang)}</Td></tr>)}</tbody>
            </>}
          </table></div>
        </Panel>
        <Panel title={t("By payment method")}>
          <ul className="space-y-3">{data.methods.sort((a, b) => b.s - a.s).map((m, i) => (
            <li key={m.method}><div className="flex justify-between text-sm mb-1"><span>{t(m.method)}</span><span className="tabular font-medium">{egp(m.s, lang)}</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(m.s / Math.max(1, data.collected)) * 100}%`, background: COLORS[i % COLORS.length] }} /></div></li>
          ))}</ul>
        </Panel>
      </div>
    </div>
  );
}
