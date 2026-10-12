import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BookOpen, Users, PenLine, ClipboardCheck, ScanLine, Clock, MapPin, Radio, Search, Download, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { StatTile, Panel, Avatar, GradePill, Pill, Progress, Th, Td, EmptyState, LiveDot } from "@/components/shared";
import { useAuth, useT, DAY_SHORT, DAY_NAMES, fmt12, greeting } from "@/lib/app";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
import { PageTitle } from "./student";
import { cn } from "@/lib/utils";
import type { Course, SlotView, SessionView, Staff, Student } from "@shared/schema";

type DCourse = { course: Course; students: number; pendingGrades: number; slots: SlotView[]; attendanceRate: number };
type DOverview = { doctor: Staff; courses: DCourse[]; totalStudents: number; pendingGrades: number; todays: SlotView[]; open: SessionView[]; avgAttendance: number };
type GB = { course: Course; rows: { enrollmentId: number; student: Student; score: number | null; grade: string | null; attendanceRate: number; absences: number }[] };

export function DoctorDashboard() {
  const { user } = useAuth();
  const { t } = useT();
  const { data } = useQuery<DOverview>({ queryKey: [`/api/doctor/${user!.id}/overview`] });
  if (!data) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-72" /></div>;
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return (
    <div>
      <PageTitle title={`${t(greeting())}${t(",")} ${data.doctor.name}`} subtitle={t("Here is an overview of your teaching this semester.")}
        actions={<Button asChild data-testid="button-start-checkin"><Link href="/checkin"><ScanLine className="h-4 w-4 me-2" />{t("Take Attendance")}</Link></Button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile tone="blue" icon={<BookOpen />} label={t("My Courses")} value={data.courses.length} testId="tile-doc-courses" />
        <StatTile tone="green" icon={<Users />} label={t("Total Students")} value={data.totalStudents} />
        <StatTile tone="orange" icon={<PenLine />} label={t("Pending Grades")} value={data.pendingGrades} />
        <StatTile tone="purple" icon={<ClipboardCheck />} label={t("Average Attendance")} value={`${data.avgAttendance}%`} />
      </div>

      {data.open.length > 0 && (
        <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center gap-4" data-testid="banner-live-session">
          <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center"><Radio className="h-5 w-5" /></div>
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold">{t("Check-in is live")} — {data.open.map((s) => s.course.code).join(", ")}</div>
            <div className="text-sm text-muted-foreground">{data.open.map((s) => `${s.present + s.late}/${s.enrolled} ${t("checked in")}`).join(" · ")}</div>
          </div>
          <Button asChild variant="default"><Link href={`/checkin/${data.open[0].id}`}>{t("Open station")}</Link></Button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={t("My Courses")} bodyClass="p-0" action={<Link href="/courses" className="text-sm text-primary font-medium hover:underline">{t("View all")}</Link>}>
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><Th>{t("Course Code")}</Th><Th>{t("Course Name")}</Th><Th>{t("Students")}</Th><Th>{t("Schedule")}</Th><Th>{t("Attendance")}</Th><Th>{t("Pending")}</Th></tr></thead>
            <tbody className="divide-y">{data.courses.map((c) => (
              <tr key={c.course.id} className="hover:bg-muted/30">
                <Td className="font-mono text-xs font-semibold text-primary">{c.course.code}</Td>
                <Td className="font-medium min-w-[170px]">{c.course.name}</Td>
                <Td className="tabular">{c.students}</Td>
                <Td className="text-xs text-muted-foreground whitespace-nowrap">{c.slots.map((s) => `${t(DAY_SHORT[s.day])} ${fmt12(s.start)}`).join(" · ")}</Td>
                <Td><Progress value={c.attendanceRate} tone={c.attendanceRate >= 85 ? "bg-emerald-500" : "bg-amber-500"} /></Td>
                <Td><Link href="/gradebook">{c.pendingGrades ? <Pill tone="amber">{c.pendingGrades}</Pill> : <Pill tone="green">0</Pill>}</Link></Td>
              </tr>
            ))}</tbody>
          </table></div>
        </Panel>
        <Panel title={t("Today's Lectures")}>
          {data.todays.length === 0 ? <EmptyState title={t("No lectures today")} /> : (
            <ul className="space-y-3">{data.todays.map((s) => {
              const live = s.start <= hm && hm < s.end;
              const done = s.end <= hm;
              return (
                <li key={s.id} className={cn("rounded-lg border p-3", live && "border-primary bg-primary/5")}>
                  <div className="flex justify-between items-start gap-2">
                    <div><div className="font-mono text-xs text-primary">{s.course.code}</div><div className="font-medium text-sm">{s.course.name}</div></div>
                    {live ? <Pill tone="green"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{t("Now")}</Pill> : done ? <Pill tone="slate">{t("Done")}</Pill> : <Pill tone="blue">{t("Upcoming")}</Pill>}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmt12(s.start)} – {fmt12(s.end)}</span><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.room}</span></div>
                </li>
              );
            })}</ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function DoctorCourses() {
  const { user } = useAuth();
  const { t } = useT();
  const { data } = useQuery<DCourse[]>({ queryKey: [`/api/doctor/${user!.id}/courses`] });
  const [roster, setRoster] = useState<Course | null>(null);
  const { data: gb } = useQuery<GB>({ queryKey: [`/api/gradebook/${roster?.id}`], enabled: !!roster });
  return (
    <div>
      <PageTitle title={t("My Courses")} subtitle={t("Courses you teach in Fall 2026, with rosters and attendance.")} />
      {!data ? <Skeleton className="h-72" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((c) => (
            <Panel key={c.course.id}>
              <div className="flex items-start justify-between gap-3">
                <div><div className="font-mono text-xs font-semibold text-primary">{c.course.code}</div><h3 className="font-semibold text-lg leading-snug">{c.course.name}</h3><div className="text-xs text-muted-foreground mt-0.5">{t(c.course.department)} · {c.course.credits} {t("credit hours")} · {t(`Level ${c.course.level}`)}</div></div>
                <div className="text-end"><div className="text-2xl font-bold tabular">{c.students}</div><div className="text-[11px] text-muted-foreground">{t("Students")}</div></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">{c.slots.map((s) => <span key={s.id} className="text-xs rounded-md bg-muted px-2 py-1">{t(DAY_NAMES[s.day])} · {fmt12(s.start)}–{fmt12(s.end)} · {s.room}</span>)}</div>
              <div className="mt-4"><div className="text-xs text-muted-foreground mb-1">{t("Attendance rate")}</div><Progress value={c.attendanceRate} tone={c.attendanceRate >= 85 ? "bg-emerald-500" : "bg-amber-500"} /></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setRoster(c.course)} data-testid={`button-roster-${c.course.code}`}><Users className="h-4 w-4 me-1.5" />{t("Roster")}</Button>
                <Button size="sm" variant="outline" asChild><Link href="/gradebook"><PenLine className="h-4 w-4 me-1.5" />{t("Grades")}</Link></Button>
                <Button size="sm" asChild><Link href="/checkin"><ScanLine className="h-4 w-4 me-1.5" />{t("Check-in")}</Link></Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
      <Dialog open={!!roster} onOpenChange={(o) => !o && setRoster(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{roster?.code} — {roster?.name}</DialogTitle><DialogDescription>{gb?.rows.length ?? "…"} {t("students enrolled")}</DialogDescription></DialogHeader>
          {!gb ? <Skeleton className="h-40" /> : (
            <table className="w-full"><thead><tr><Th>{t("Student")}</Th><Th>{t("Student ID")}</Th><Th>{t("Attendance")}</Th><Th>{t("Absences")}</Th></tr></thead>
              <tbody className="divide-y">{gb.rows.map((r) => (
                <tr key={r.enrollmentId}><Td><div className="flex items-center gap-2"><Avatar name={r.student.name} size={28} />{r.student.name}</div></Td><Td className="font-mono text-xs">{r.student.studentCode}</Td>
                  <Td><span className={cn("tabular", r.attendanceRate < 75 && "text-rose-600 font-semibold")}>{r.attendanceRate}%</span></Td><Td className="tabular">{r.absences}</Td></tr>
              ))}</tbody></table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Gradebook() {
  const { user } = useAuth();
  const { t } = useT();
  const { toast } = useToast();
  const { data: courses } = useQuery<DCourse[]>({ queryKey: [`/api/doctor/${user!.id}/courses`] });
  const [cid, setCid] = useState<number | null>(null);
  useEffect(() => { if (!cid && courses?.length) setCid(courses[0].course.id); }, [courses, cid]);
  const { data } = useQuery<GB>({ queryKey: [`/api/gradebook/${cid}`], enabled: !!cid });
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [q, setQ] = useState("");
  useEffect(() => setDraft({}), [cid]);
  const save = useMutation({
    mutationFn: async () => {
      for (const [id, v] of Object.entries(draft)) await apiRequest("POST", "/api/grades", { enrollmentId: Number(id), score: v === "" ? null : Number(v) });
      return Object.keys(draft).length;
    },
    onSuccess: (n) => { setDraft({}); queryClient.invalidateQueries(); toast({ title: t("Grades saved"), description: `${n} ${t("students updated")}` }); },
  });
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => !q || (r.student.name + r.student.studentCode).toLowerCase().includes(q.toLowerCase())), [data, q]);
  const dirty = Object.keys(draft).length;
  const letter = (s: number) => s >= 90 ? "A" : s >= 85 ? "A-" : s >= 80 ? "B+" : s >= 75 ? "B" : s >= 70 ? "B-" : s >= 65 ? "C+" : s >= 60 ? "C" : s >= 55 ? "D+" : s >= 50 ? "D" : "F";
  const graded = data?.rows.filter((r) => r.score != null).length ?? 0;
  return (
    <div>
      <PageTitle title={t("Gradebook")} subtitle={t("Enter final scores out of 100. Letter grades and student notifications update automatically.")}
        actions={<>
          <Select value={cid ? String(cid) : undefined} onValueChange={(v) => setCid(Number(v))}>
            <SelectTrigger className="w-64" data-testid="select-gradebook-course"><SelectValue placeholder={t("Choose course")} /></SelectTrigger>
            <SelectContent>{courses?.map((c) => <SelectItem key={c.course.id} value={String(c.course.id)}>{c.course.code} — {c.course.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} data-testid="button-save-grades">{save.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}{t("Save")} {dirty ? `(${dirty})` : ""}</Button>
        </>} />
      {data && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatTile tone="blue" icon={<Users />} label={t("Students")} value={data.rows.length} />
          <StatTile tone="green" icon={<CheckCircle2 />} label={t("Graded")} value={graded} />
          <StatTile tone="orange" icon={<PenLine />} label={t("Pending Grades")} value={data.rows.length - graded} />
        </div>
      )}
      <Panel bodyClass="p-0" title={data ? `${data.course?.code} — ${data.course?.name}` : ""}
        action={<div className="relative"><Search className="h-4 w-4 absolute start-2.5 top-2.5 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Name or ID")} className="h-9 ps-8 w-44" /></div>}>
        {!data ? <div className="p-5"><Skeleton className="h-60" /></div> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><Th>{t("Student")}</Th><Th>{t("Student ID")}</Th><Th>{t("Attendance")}</Th><Th>{t("Score / 100")}</Th><Th>{t("Grade")}</Th></tr></thead>
            <tbody className="divide-y">{rows.map((r) => {
              const v = draft[r.enrollmentId] ?? (r.score == null ? "" : String(r.score));
              const n = v === "" ? null : Number(v);
              return (
                <tr key={r.enrollmentId} className={cn("hover:bg-muted/30", draft[r.enrollmentId] !== undefined && "bg-amber-50/60 dark:bg-amber-950/20")}>
                  <Td><div className="flex items-center gap-2"><Avatar name={r.student.name} size={28} /><span className="font-medium">{r.student.name}</span></div></Td>
                  <Td className="font-mono text-xs">{r.student.studentCode}</Td>
                  <Td><span className={cn("tabular", r.attendanceRate < 75 && "text-rose-600 font-semibold")}>{r.attendanceRate}%</span></Td>
                  <Td><Input type="number" min={0} max={100} value={v} onChange={(e) => setDraft((d) => ({ ...d, [r.enrollmentId]: e.target.value }))} className="h-8 w-20 tabular" data-testid={`input-score-${r.student.studentCode}`} /></Td>
                  <Td><GradePill grade={n == null || isNaN(n) ? null : letter(Math.max(0, Math.min(100, n)))} /></Td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}
