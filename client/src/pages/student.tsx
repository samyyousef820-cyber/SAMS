import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  TrendingUp, Award, BookOpen, CheckCircle2, Hourglass, ClipboardCheck, Wallet, Clock, MapPin, User2, CalendarDays, ArrowRight, CreditCard,
  Receipt, Loader2, Search, AlertTriangle, Plus, Minus, QrCode, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { StatTile, Panel, PillTabs, Avatar, GradePill, Pill, Progress, Donut, Th, Td, StatusBadge, IdCard, EmptyState, fmtDate, fmtTime } from "@/components/shared";
import { useAuth, useT, egp, DAY_ORDER, DAY_SHORT, DAY_NAMES, fmt12, fmtLongDate, greeting, courseColor } from "@/lib/app";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Course, Student, SlotView, LogEntry, Fee, Payment } from "@shared/schema";

type Overview = {
  student: Student; semester: string; academicYear: string; standing: string; currentGpa: number; cumulativeGpa: number; registeredCourses: number; registeredCredits: number;
  earnedCredits: number; remainingCredits: number; attendanceRate: number; outstanding: number; nextLecture: (SlotView & { date: string }) | null; weekSlots: SlotView[]; unread: number;
};
type CourseRow = { enrollmentId: number; course: Course; semester: string; status: string; score: number | null; grade: string | null; progress: number; attendanceRate: number | null; slots: SlotView[] };
type GradeData = { semesters: { semester: string; gpa: number; credits: number; rows: { enrollmentId: number; course: Course; credits: number; score: number | null; grade: string | null; points: number | null; result: string; status: string }[] }[]; currentGpa: number; cumulativeGpa: number; earnedCredits: number; remainingCredits: number };
type AttData = { present: number; late: number; absent: number; excused: number; total: number; rate: number; records: LogEntry[]; byCourse: { course: Course; present: number; late: number; absent: number; excused: number; total: number; rate: number }[] };
type RegData = { credits: number; maxCredits: number; courses: { course: Course; slots: SlotView[]; enrolled: number; registered: boolean; completed: boolean; conflictWith: string | null }[] };
type FeeData = { items: Fee[]; payments: Payment[]; total: number; paid: number; remaining: number; nextDue: string | null };

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
const slotLabel = (s: SlotView, t: (x: string) => string) => `${t(DAY_SHORT[s.day])} ${fmt12(s.start)}`;

// ============================== dashboard ==============================
export function StudentDashboard() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const { data, isLoading } = useQuery<Overview>({ queryKey: [`/api/student/${user!.id}/overview`] });
  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-48" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div></div>;
  const s = data.student;
  const today = new Date().getDay();
  const n = data.nextLecture;
  return (
    <div>
      <PageTitle title={`${t(greeting())}${t(",")} ${s.name.split(" ")[0]}`} subtitle={t("Welcome back! Here's what's happening with your studies today.")} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5 min-w-0">
          {/* profile card */}
          <Panel>
            <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
              <Avatar name={s.name} src={user!.avatar} size={88} className="ring-4 ring-primary/10" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{s.name}</h2><Pill tone={data.standing === "Good Standing" ? "green" : "amber"}><CheckCircle2 className="h-3 w-3" />{t(data.standing)}</Pill></div>
                <dl className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2.5 text-sm">
                  {[["Student ID", <span className="font-mono" key="c">{s.studentCode}</span>], ["Faculty", t(s.department)], ["Level", t(`Level ${s.year}`)], ["Semester", t(data.semester)], ["Academic Year", data.academicYear], ["Program", t(s.program)]].map(([k, v]) => (
                    <div key={k as string} className="min-w-0"><dt className="text-[11px] text-muted-foreground">{t(k as string)}</dt><dd className="font-medium truncate">{v}</dd></div>
                  ))}
                </dl>
              </div>
            </div>
          </Panel>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile tone="blue" icon={<TrendingUp />} label={t("Current GPA")} value={data.currentGpa.toFixed(2)} testId="tile-current-gpa" />
            <StatTile tone="green" icon={<Award />} label={t("Cumulative GPA")} value={data.cumulativeGpa.toFixed(2)} testId="tile-cgpa" />
            <StatTile tone="purple" icon={<BookOpen />} label={t("Registered Courses")} value={data.registeredCourses} hint={`${data.registeredCredits} ${t("credit hours")}`} />
            <StatTile tone="teal" icon={<CheckCircle2 />} label={t("Earned Credit Hours")} value={data.earnedCredits} />
            <StatTile tone="orange" icon={<Hourglass />} label={t("Remaining Credit Hours")} value={data.remainingCredits} />
            <StatTile tone={data.attendanceRate >= 85 ? "green" : "orange"} icon={<ClipboardCheck />} label={t("Attendance")} value={`${data.attendanceRate}%`} testId="tile-attendance" />
            <StatTile tone={data.outstanding > 0 ? "red" : "green"} icon={<Wallet />} label={t("Outstanding Fees")} value={egp(data.outstanding, lang)} testId="tile-fees" />
            <StatTile tone="slate" icon={<CalendarDays />} label={t("Unread notifications")} value={data.unread} />
          </div>

          {/* weekly strip */}
          <Panel title={t("Weekly Schedule")} action={<Link href="/schedule" className="text-sm text-primary font-medium hover:underline">{t("View full schedule")}</Link>}>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DAY_ORDER.map((d) => {
                const items = data.weekSlots.filter((x) => x.day === d);
                return (
                  <div key={d} className={cn("rounded-lg border p-2 min-h-[120px]", d === today && "border-primary ring-1 ring-primary/30 bg-primary/5")}>
                    <div className={cn("text-xs font-semibold mb-2", d === today ? "text-primary" : "text-muted-foreground")}>{t(DAY_NAMES[d])}</div>
                    <div className="space-y-1.5">
                      {items.length === 0 && <div className="text-[11px] text-muted-foreground/70">{t("No classes")}</div>}
                      {items.map((x) => (
                        <div key={x.id} className={cn("rounded-md border-s-[3px] px-2 py-1 text-[11px] leading-tight", courseColor(x.courseId))}>
                          <div className="font-semibold">{x.course.code}</div><div className="opacity-75">{fmt12(x.start)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title={t("Today's Next Lecture")}>
            {!n ? <EmptyState title={t("No upcoming lectures")} hint={t("Enjoy your free time.")} /> : (
              <div data-testid="card-next-lecture">
                <div className="rounded-xl bg-gradient-to-br from-[#0b2e47] to-[#11665a] text-white p-4">
                  <div className="text-xs text-white/70">{n.date === new Date().toISOString().slice(0, 10) ? t("Today") : `${t(DAY_NAMES[n.day])} · ${fmtLongDate(n.date, lang)}`}</div>
                  <div className="mt-1 font-mono text-xs text-teal-200">{n.course.code}</div>
                  <div className="text-lg font-bold leading-snug">{n.course.name}</div>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm">
                  <li className="flex items-center gap-2.5"><Clock className="h-4 w-4 text-primary" />{fmt12(n.start)} – {fmt12(n.end)}</li>
                  <li className="flex items-center gap-2.5"><MapPin className="h-4 w-4 text-primary" />{t("Room")} {n.room} · {t(n.kind)}</li>
                  <li className="flex items-center gap-2.5"><User2 className="h-4 w-4 text-primary" />{n.course.instructor}</li>
                </ul>
                <Button asChild variant="outline" className="w-full mt-4"><Link href="/schedule">{t("View Details")}</Link></Button>
              </div>
            )}
          </Panel>
          <Panel title={t("My Check-in ID")} action={<Link href="/attendance" className="text-sm text-primary font-medium hover:underline">{t("Attendance")}</Link>}>
            <div className="flex justify-center"><IdCard student={s} /></div>
            <p className="mt-3 text-xs text-muted-foreground text-center">{t("Show this QR code or barcode to your professor's check-in station.")}</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ============================== my courses ==============================
export function StudentCourses() {
  const { user } = useAuth();
  const { t } = useT();
  const [tab, setTab] = useState<"current" | "completed">("current");
  const { data, isLoading } = useQuery<CourseRow[]>({ queryKey: [`/api/student/${user!.id}/courses`] });
  const rows = (data ?? []).filter((r) => r.status === tab);
  return (
    <div>
      <PageTitle title={t("My Courses")} subtitle={t("Courses you are taking this semester and courses you have completed.")} />
      <Panel bodyClass="p-0" title={<PillTabs value={tab} onChange={setTab} items={[{ value: "current", label: t("Current Courses") }, { value: "completed", label: t("Previous Courses") }]} />}>
        {isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : rows.length === 0 ? <EmptyState title={t("No courses")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>{t("Course Code")}</Th><Th>{t("Course Name")}</Th><Th>{t("Professor")}</Th><Th>{t("Credits")}</Th>{tab === "current" ? <><Th>{t("Schedule")}</Th><Th>{t("Progress")}</Th><Th>{t("Attendance")}</Th></> : <Th>{t("Semester")}</Th>}<Th>{t("Grade")}</Th></tr></thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.enrollmentId} className="hover:bg-muted/30" data-testid={`row-course-${r.course.code}`}>
                    <Td className="font-mono text-xs font-semibold text-primary">{r.course.code}</Td>
                    <Td className="font-medium min-w-[180px]">{r.course.name}</Td>
                    <Td className="text-muted-foreground whitespace-nowrap">{r.course.instructor}</Td>
                    <Td className="tabular">{r.course.credits}</Td>
                    {tab === "current" ? <>
                      <Td className="text-xs text-muted-foreground whitespace-nowrap">{r.slots.map((s) => slotLabel(s, t)).join(" · ")}</Td>
                      <Td><Progress value={r.progress} /></Td>
                      <Td>{r.attendanceRate == null ? "—" : <span className={cn("tabular font-medium", r.attendanceRate < 75 ? "text-rose-600" : "")}>{r.attendanceRate}%</span>}</Td>
                    </> : <Td className="text-muted-foreground">{t(r.semester)}</Td>}
                    <Td><GradePill grade={r.grade} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ============================== grades ==============================
export function Grades() {
  const { user } = useAuth();
  const { t } = useT();
  const [tab, setTab] = useState<"semester" | "overall">("semester");
  const { data } = useQuery<GradeData>({ queryKey: [`/api/student/${user!.id}/grades`] });
  const [sem, setSem] = useState<string>("");
  if (!data) return <Skeleton className="h-96" />;
  const current = data.semesters.find((s) => s.semester === (sem || data.semesters.find((x) => x.rows.some((r) => r.score != null))?.semester)) ?? data.semesters[0];
  return (
    <div>
      <PageTitle title={t("Grades & Results")} subtitle={t("Your marks, letter grades and GPA across semesters.")} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile tone="blue" icon={<TrendingUp />} label={t("Current GPA")} value={data.currentGpa.toFixed(2)} />
        <StatTile tone="green" icon={<Award />} label={t("Cumulative GPA")} value={data.cumulativeGpa.toFixed(2)} />
        <StatTile tone="teal" icon={<CheckCircle2 />} label={t("Earned Credit Hours")} value={data.earnedCredits} />
        <StatTile tone="orange" icon={<Hourglass />} label={t("Remaining Credit Hours")} value={data.remainingCredits} />
      </div>
      <Panel bodyClass="p-0" title={<PillTabs value={tab} onChange={setTab} items={[{ value: "semester", label: t("Semester Grades") }, { value: "overall", label: t("Overall GPA") }]} />}
        action={tab === "semester" && (
          <Select value={current.semester} onValueChange={setSem}>
            <SelectTrigger className="w-40 h-9" data-testid="select-semester"><SelectValue /></SelectTrigger>
            <SelectContent>{data.semesters.map((s) => <SelectItem key={s.semester} value={s.semester}>{t(s.semester)}</SelectItem>)}</SelectContent>
          </Select>
        )}>
        {tab === "semester" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><Th>{t("Course Code")}</Th><Th>{t("Course Name")}</Th><Th>{t("Credits")}</Th><Th>{t("Score")}</Th><Th>{t("Grade")}</Th><Th>{t("Points")}</Th><Th>{t("Status")}</Th></tr></thead>
                <tbody className="divide-y">
                  {current.rows.map((r) => (
                    <tr key={r.enrollmentId} className="hover:bg-muted/30">
                      <Td className="font-mono text-xs font-semibold text-primary">{r.course.code}</Td>
                      <Td className="font-medium">{r.course.name}</Td>
                      <Td className="tabular">{r.credits}</Td>
                      <Td className="tabular">{r.score ?? "—"}</Td>
                      <Td><GradePill grade={r.grade} /></Td>
                      <Td className="tabular">{r.points?.toFixed(1) ?? "—"}</Td>
                      <Td><Pill tone={r.result === "Passed" ? "green" : r.result === "Failed" ? "red" : "slate"}>{t(r.result)}</Pill></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-end gap-6 px-5 py-4 border-t text-sm">
              <span className="text-muted-foreground">{t("Credit hours")}: <b className="text-foreground tabular">{current.credits}</b></span>
              <span className="text-muted-foreground">{t("Semester GPA")}: <b className="text-primary tabular">{current.gpa ? current.gpa.toFixed(2) : "—"}</b></span>
            </div>
          </>
        ) : (
          <div className="p-5 grid md:grid-cols-[200px_1fr] gap-6 items-center">
            <div className="text-center">
              <Donut value={(data.cumulativeGpa / 4) * 100} size={170} label={t("of 4.00")} />
              <div className="mt-2 text-3xl font-bold text-primary tabular">{data.cumulativeGpa.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">{t("Cumulative GPA")}</div>
            </div>
            <div className="space-y-3">
              {data.semesters.map((s) => (
                <div key={s.semester} className="rounded-lg border p-3">
                  <div className="flex justify-between text-sm mb-2"><span className="font-medium">{t(s.semester)}</span><span className="tabular font-semibold">{s.gpa ? s.gpa.toFixed(2) : t("In progress")}</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${(s.gpa / 4) * 100}%` }} /></div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{s.rows.length} {t("courses")} · {s.credits} {t("credit hours")}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ============================== attendance ==============================
export function MyAttendance() {
  const { user } = useAuth();
  const { t } = useT();
  const [tab, setTab] = useState<"summary" | "records" | "card">("summary");
  const { data } = useQuery<AttData>({ queryKey: [`/api/student/${user!.id}/attendance`] });
  const { data: ov } = useQuery<Overview>({ queryKey: [`/api/student/${user!.id}/overview`] });
  if (!data) return <Skeleton className="h-96" />;
  return (
    <div>
      <PageTitle title={t("Attendance")} subtitle={t("Live record of your check-ins. Absences are logged automatically when a class ends.")} />
      <PillTabs className="mb-5" value={tab} onChange={setTab} items={[{ value: "summary", label: t("Summary") }, { value: "records", label: t("Detailed Records") }, { value: "card", label: t("My QR ID") }]} />
      {tab === "summary" && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Panel title={t("Overall Attendance")}>
            <div className="flex justify-center"><Donut value={data.rate} size={170} label={t("Attendance")} sub={t(data.rate >= 85 ? "Excellent" : data.rate >= 75 ? "Good" : "At risk")} /></div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-center">
              {[["Present", data.present, "text-emerald-600"], ["Late", data.late, "text-amber-600"], ["Absent", data.absent, "text-rose-600"], ["Total Sessions", data.total, "text-foreground"]].map(([k, v, c]) => (
                <div key={k as string} className="rounded-lg bg-muted/50 py-2.5"><div className={cn("text-xl font-bold tabular", c as string)}>{v}</div><div className="text-[11px] text-muted-foreground">{t(k as string)}</div></div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">{t("Students below 75% attendance may be barred from final exams.")}</p>
          </Panel>
          <div className="space-y-5 min-w-0">
            <Panel title={t("By Course")} bodyClass="p-0">
              <div className="overflow-x-auto"><table className="w-full">
                <thead><tr><Th>{t("Course")}</Th><Th>{t("Present")}</Th><Th>{t("Late")}</Th><Th>{t("Absent")}</Th><Th>{t("Excused")}</Th><Th>{t("Rate")}</Th></tr></thead>
                <tbody className="divide-y">{data.byCourse.map((c) => (
                  <tr key={c.course.id}><Td><div className="font-medium">{c.course.name}</div><div className="font-mono text-[11px] text-muted-foreground">{c.course.code}</div></Td>
                    <Td className="tabular text-emerald-600">{c.present}</Td><Td className="tabular text-amber-600">{c.late}</Td><Td className="tabular text-rose-600">{c.absent}</Td><Td className="tabular">{c.excused}</Td>
                    <Td><Progress value={c.rate} tone={c.rate >= 85 ? "bg-emerald-500" : c.rate >= 75 ? "bg-amber-500" : "bg-rose-500"} /></Td></tr>
                ))}</tbody>
              </table></div>
            </Panel>
            <Panel title={t("Recent Records")} action={<button onClick={() => setTab("records")} className="text-sm text-primary font-medium hover:underline">{t("View all")}</button>} bodyClass="p-0">
              <RecordsTable rows={data.records.slice(0, 6)} />
            </Panel>
          </div>
        </div>
      )}
      {tab === "records" && <Panel bodyClass="p-0"><RecordsTable rows={data.records} /></Panel>}
      {tab === "card" && ov && (
        <Panel>
          <div className="grid md:grid-cols-[auto_1fr] gap-8 items-center">
            <IdCard student={ov.student} />
            <div className="max-w-md space-y-3 text-sm">
              <h3 className="text-lg font-semibold">{t("How check-in works")}</h3>
              <ol className="space-y-2 text-muted-foreground list-decimal ps-5">
                <li>{t("Your professor opens a check-in session at the start of class.")}</li>
                <li>{t("Show the QR code or barcode on this card to the station camera or scanner.")}</li>
                <li>{t("You are marked Present, or Late after the grace period. Students who never check in are marked Absent when class ends.")}</li>
              </ol>
              <div className="rounded-lg bg-muted/50 p-3"><div className="text-[11px] text-muted-foreground">{t("Student ID")}</div><div className="font-mono text-lg font-semibold tracking-wider">{ov.student.studentCode}</div><div className="text-[11px] text-muted-foreground">{t("8 digits — the last digit is a checksum that catches typos.")}</div></div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
function RecordsTable({ rows }: { rows: LogEntry[] }) {
  const { t } = useT();
  if (!rows.length) return <EmptyState title={t("No records yet")} />;
  return (
    <div className="overflow-x-auto"><table className="w-full">
      <thead><tr><Th>{t("Date")}</Th><Th>{t("Course")}</Th><Th>{t("Check-in time")}</Th><Th>{t("Method")}</Th><Th>{t("Status")}</Th></tr></thead>
      <tbody className="divide-y">{rows.map((r) => (
        <tr key={r.id} className="hover:bg-muted/30"><Td className="whitespace-nowrap">{fmtDate(r.session.date)}</Td><Td><span className="font-mono text-xs text-primary me-2">{r.course.code}</span>{r.course.name}</Td>
          <Td className="tabular text-muted-foreground">{r.status === "absent" ? "—" : fmtTime(r.recordedAt)}</Td><Td className="text-xs text-muted-foreground">{r.method ? t(r.method.toUpperCase() === "QR" ? "QR code" : r.method) : "—"}</Td><Td><StatusBadge status={r.status} /></Td></tr>
      ))}</tbody>
    </table></div>
  );
}

// ============================== registration ==============================
export function Registration() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const { toast } = useToast();
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [dept, setDept] = useState("all");
  const [q, setQ] = useState("");
  const { data } = useQuery<RegData>({ queryKey: [`/api/student/${user!.id}/registration`] });
  const mut = useMutation({
    mutationFn: async ({ courseId, drop }: { courseId: number; drop?: boolean }) => (await apiRequest("POST", `/api/student/${user!.id}/${drop ? "drop" : "register"}`, { courseId })).json(),
    onSuccess: (_d, v) => { queryClient.invalidateQueries(); toast({ title: t(v.drop ? "Course dropped" : "Registered successfully") }); },
    onError: (e: Error) => toast({ title: t("Registration failed"), description: e.message, variant: "destructive" }),
  });
  if (!data) return <Skeleton className="h-96" />;
  const depts = Array.from(new Set(data.courses.map((c) => c.course.department)));
  const list = data.courses.filter((c) => (tab === "mine" ? c.registered : !c.registered)).filter((c) => dept === "all" || c.course.department === dept)
    .filter((c) => !q || (c.course.code + c.course.name).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageTitle title={t("Course Registration")} subtitle={t("Fall 2026 registration is open. Conflicts and credit limits are checked automatically.")} />
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <StatTile tone="purple" icon={<BookOpen />} label={t("Registered credit hours")} value={`${data.credits} / ${data.maxCredits}`} testId="tile-reg-credits" />
        <StatTile tone="blue" icon={<ClipboardCheck />} label={t("Registered Courses")} value={data.courses.filter((c) => c.registered).length} />
        <StatTile tone="green" icon={<CalendarDays />} label={t("Registration closes")} value={fmtLongDate("2026-10-18", lang)} />
      </div>
      <Panel bodyClass="p-0" title={<PillTabs value={tab} onChange={setTab} items={[{ value: "available", label: t("Available Courses") }, { value: "mine", label: t("My Registered Courses") }]} />}
        action={<div className="hidden md:flex gap-2">
          <div className="relative"><Search className="h-4 w-4 absolute start-2.5 top-2.5 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search courses")} className="h-9 ps-8 w-48" /></div>
          <Select value={dept} onValueChange={setDept}><SelectTrigger className="h-9 w-48" data-testid="select-reg-dept"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t("All departments")}</SelectItem>{depts.map((d) => <SelectItem key={d} value={d}>{t(d)}</SelectItem>)}</SelectContent></Select>
        </div>}>
        {list.length === 0 ? <EmptyState title={t(tab === "mine" ? "You have not registered any courses" : "No courses match")} /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><Th>{t("Course Code")}</Th><Th>{t("Course Name")}</Th><Th>{t("Credits")}</Th><Th>{t("Instructor")}</Th><Th>{t("Schedule")}</Th><Th>{t("Seats")}</Th><Th className="text-end">{t("Action")}</Th></tr></thead>
            <tbody className="divide-y">{list.map((c) => {
              const full = c.enrolled >= c.course.capacity;
              const busy = mut.isPending && mut.variables?.courseId === c.course.id;
              return (
                <tr key={c.course.id} className="hover:bg-muted/30" data-testid={`row-reg-${c.course.code}`}>
                  <Td className="font-mono text-xs font-semibold text-primary">{c.course.code}</Td>
                  <Td><div className="font-medium">{c.course.name}</div><div className="text-[11px] text-muted-foreground">{t(c.course.department)} · {t(`Level ${c.course.level}`)}</div></Td>
                  <Td className="tabular">{c.course.credits}</Td>
                  <Td className="text-muted-foreground whitespace-nowrap">{c.course.instructor}</Td>
                  <Td className="text-xs text-muted-foreground whitespace-nowrap">{c.slots.map((s) => slotLabel(s, t)).join(" · ")}</Td>
                  <Td className="tabular text-xs whitespace-nowrap"><span className={full ? "text-rose-600 font-semibold" : ""}>{c.enrolled}/{c.course.capacity}</span></Td>
                  <Td className="text-end whitespace-nowrap">
                    {c.registered ? <Button size="sm" variant="outline" onClick={() => mut.mutate({ courseId: c.course.id, drop: true })} disabled={busy} data-testid={`button-drop-${c.course.code}`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minus className="h-3.5 w-3.5 me-1" />}{t("Drop")}</Button>
                      : c.completed ? <Pill tone="slate">{t("Completed")}</Pill>
                      : c.conflictWith ? <Pill tone="amber"><AlertTriangle className="h-3 w-3" />{t("Conflicts with")} {c.conflictWith}</Pill>
                      : full ? <Pill tone="red">{t("Full")}</Pill>
                      : <Button size="sm" onClick={() => mut.mutate({ courseId: c.course.id })} disabled={busy} data-testid={`button-register-${c.course.code}`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 me-1" />}{t("Register")}</Button>}
                  </Td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}

// ============================== fees ==============================
const METHODS = ["Credit Card", "Fawry", "Bank Transfer", "Mobile Wallet"];
export function Fees() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const { data } = useQuery<FeeData>({ queryKey: [`/api/student/${user!.id}/fees`] });
  const pay = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/student/${user!.id}/pay`, { amount: Number(amount), method })).json() as Promise<Payment>,
    onSuccess: (p) => { queryClient.invalidateQueries(); setOpen(false); setReceipt(p); toast({ title: t("Payment successful"), description: `${egp(p.amount, lang)} · ${p.reference}` }); },
    onError: (e: Error) => toast({ title: t("Payment failed"), description: e.message, variant: "destructive" }),
  });
  if (!data) return <Skeleton className="h-96" />;
  return (
    <div>
      <PageTitle title={t("Fees & Payments")} subtitle={t("Your Fall 2026 statement, payment history and online payments.")}
        actions={data.remaining > 0 && <Button onClick={() => { setAmount(String(data.remaining)); setOpen(true); }} data-testid="button-make-payment"><CreditCard className="h-4 w-4 me-2" />{t("Make a Payment")}</Button>} />
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <StatTile tone="blue" icon={<Receipt />} label={t("Total Due")} value={egp(data.total, lang)} />
        <StatTile tone="green" icon={<CheckCircle2 />} label={t("Paid Amount")} value={egp(data.paid, lang)} testId="tile-paid" />
        <StatTile tone={data.remaining ? "red" : "green"} icon={<Wallet />} label={t("Remaining Balance")} value={egp(data.remaining, lang)} hint={data.nextDue ? `${t("Due by")} ${fmtLongDate(data.nextDue, lang)}` : t("Fully paid")} testId="tile-remaining" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t("Fee Breakdown")} bodyClass="p-0">
          <table className="w-full"><thead><tr><Th>{t("Description")}</Th><Th>{t("Due date")}</Th><Th className="text-end">{t("Amount")}</Th></tr></thead>
            <tbody className="divide-y">{data.items.map((f) => <tr key={f.id}><Td>{t(f.description)}</Td><Td className="text-muted-foreground whitespace-nowrap">{fmtLongDate(f.dueDate, lang)}</Td><Td className="text-end tabular font-medium whitespace-nowrap">{egp(f.amount, lang)}</Td></tr>)}
              <tr className="bg-muted/30"><Td className="font-semibold">{t("Total")}</Td><Td /><Td className="text-end tabular font-bold whitespace-nowrap">{egp(data.total, lang)}</Td></tr></tbody></table>
        </Panel>
        <Panel title={t("Payment History")} bodyClass="p-0">
          {data.payments.length === 0 ? <EmptyState title={t("No payments yet")} /> : (
            <div className="overflow-x-auto"><table className="w-full"><thead><tr><Th>{t("Date")}</Th><Th>{t("Description")}</Th><Th>{t("Method")}</Th><Th className="text-end">{t("Amount")}</Th><Th>{t("Status")}</Th></tr></thead>
              <tbody className="divide-y">{data.payments.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setReceipt(p)}><Td className="whitespace-nowrap">{fmtLongDate(p.date, lang)}</Td><Td><div>{t(p.description)}</div><div className="font-mono text-[10.5px] text-muted-foreground">{p.reference}</div></Td><Td className="text-xs text-muted-foreground whitespace-nowrap">{t(p.method)}</Td>
                  <Td className="text-end tabular whitespace-nowrap">{egp(p.amount, lang)}</Td><Td><Pill tone="green">{t(p.status)}</Pill></Td></tr>
              ))}</tbody></table></div>
          )}
        </Panel>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("Make a Payment")}</DialogTitle><DialogDescription>{t("Remaining balance")}: {egp(data.remaining, lang)}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">{t("Amount (EGP)")}</label><Input type="number" min={1} max={data.remaining} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" data-testid="input-pay-amount" /></div>
            <div><label className="text-sm font-medium">{t("Payment method")}</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">{METHODS.map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)} className={cn("rounded-lg border px-3 py-2.5 text-sm text-start", method === m ? "border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary" : "hover:bg-muted")}>{t(m)}</button>
              ))}</div>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("This is a simulated payment — no real money is charged.")}</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending || !(Number(amount) > 0)} data-testid="button-confirm-payment">{pay.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}{t("Pay")} {Number(amount) > 0 ? egp(Math.min(Number(amount), data.remaining), lang) : ""}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="sm:max-w-sm">
          {receipt && <div className="text-center" data-testid="dialog-receipt">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center dark:bg-emerald-950"><CheckCircle2 className="h-7 w-7" /></div>
            <h3 className="mt-3 text-lg font-bold">{t("Payment Receipt")}</h3>
            <div className="text-3xl font-bold text-primary tabular mt-1">{egp(receipt.amount, lang)}</div>
            <dl className="mt-4 text-sm text-start divide-y rounded-lg border">
              {[["Reference", receipt.reference], ["Date", fmtLongDate(receipt.date, lang)], ["Method", t(receipt.method)], ["Description", t(receipt.description)], ["Status", t(receipt.status)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{t(k)}</dt><dd className="font-medium text-end">{v}</dd></div>
              ))}
            </dl>
            <Button variant="outline" className="mt-4 w-full no-print" onClick={() => window.print()}><Download className="h-4 w-4 me-2" />{t("Print receipt")}</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
