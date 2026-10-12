import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ListX, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, StatusBadge, MethodTag, fmtDate, fmtTime, timeAgo, useNow, EmptyState, LiveDot, Kpi } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useAuth, useT } from "@/lib/app";
import type { Course, LogEntry, SessionView, Student } from "@shared/schema";

const FILTERS = [
  { key: "absent", label: "Absences" },
  { key: "late", label: "Late" },
  { key: "excused", label: "Excused" },
  { key: "present,late,absent,excused", label: "All records" },
];

function isoDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LogPage() {
  const [status, setStatus] = useState("absent");
  const [courseId, setCourseId] = useState("all");
  const [from, setFrom] = useState(isoDaysAgo(14));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [q, setQ] = useState("");
  const now = useNow(10000);
  const { user } = useAuth();
  const { t } = useT();
  const isDoc = user?.role === "doctor";

  const qs = new URLSearchParams({ status, from, to, limit: "400", ...(isDoc ? { doctorId: String(user!.id) } : {}), ...(courseId !== "all" ? { courseId } : {}) }).toString();
  const { data: log, isLoading } = useQuery<LogEntry[]>({ queryKey: [`/api/log?${qs}`] });
  const { data: allCourses } = useQuery<Course[]>({ queryKey: ["/api/courses"] });
  const courses = allCourses?.filter((c) => !isDoc || c.doctorId === user!.id);
  const { data: open } = useQuery<SessionView[]>({ queryKey: [`/api/sessions?status=open${isDoc ? `&doctorId=${user!.id}` : ""}`] });

  // track new rows to highlight
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!log) return;
    if (seen.current) {
      const n = new Set(log.filter((r) => !seen.current!.has(r.id)).map((r) => r.id));
      if (n.size) { setFresh(n); setTimeout(() => setFresh(new Set()), 4000); }
    }
    seen.current = new Set(log.map((r) => r.id));
  }, [log]);
  useEffect(() => { seen.current = null; }, [qs]);

  const update = useMutation({
    mutationFn: async (v: { sessionId: number; studentId: number; status: string }) => (await apiRequest("POST", "/api/attendance/status", v)).json(),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const rows = useMemo(() => (log ?? []).filter((r) => !q || r.student.name.toLowerCase().includes(q.toLowerCase()) || r.student.studentCode.includes(q.toUpperCase())), [log, q]);

  // repeat offenders in current view
  const offenders = useMemo(() => {
    const m = new Map<number, { s: Student; n: number }>();
    for (const r of log ?? []) if (r.status === "absent") { const e = m.get(r.studentId) ?? { s: r.student, n: 0 }; e.n++; m.set(r.studentId, e); }
    return Array.from(m.values()).sort((a, b) => b.n - a.n).slice(0, 6);
  }, [log]);

  return (
    <div>
      <PageHeader title={t("Absence Log")} subtitle={t("Every absence, late arrival and excuse — updates the moment a session closes or a status changes.")} actions={<LiveDot />} />

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 p-4 border-b">
            <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => setStatus(f.key)} data-testid={`button-filter-${f.label.toLowerCase().replace(/\s/g, "-")}`}
                  className={cn("rounded px-3 py-1.5 text-xs font-medium", status === f.key ? "bg-background shadow-sm" : "text-muted-foreground")}>{f.label}</button>
              ))}
            </div>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="h-8 w-[170px] text-xs" data-testid="select-log-course"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courses?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.code}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[140px] text-xs" data-testid="input-log-from" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[140px] text-xs" data-testid="input-log-to" />
            <div className="relative ms-auto">
              <Search className="h-3.5 w-3.5 absolute start-2.5 top-2.5 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or ID" className="h-8 ps-8 w-44 text-xs" data-testid="input-log-search" />
            </div>
          </div>

          {isLoading ? <div className="p-4"><Skeleton className="h-96" /></div> : rows.length === 0 ? (
            <EmptyState icon={<ListX className="h-7 w-7" />} title="No records for these filters" body="Try widening the date range or choosing another status." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-xs text-muted-foreground border-b">
                    <th className="font-medium px-4 py-2.5">Date</th>
                    <th className="font-medium px-4 py-2.5">Student</th>
                    <th className="font-medium px-4 py-2.5">Course</th>
                    <th className="font-medium px-4 py-2.5">Recorded</th>
                    <th className="font-medium px-4 py-2.5">Method</th>
                    <th className="font-medium px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className={cn("transition-colors", fresh.has(r.id) && "bg-primary/10 feed-in")} data-testid={`row-log-${r.id}`}>
                      <td className="px-4 py-2 whitespace-nowrap text-xs">{fmtDate(r.session.date)}</td>
                      <td className="px-4 py-2">
                        <div className="truncate max-w-[220px]">{r.student.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{r.student.studentCode}</div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap"><span className="font-mono text-xs">{r.course.code}</span></td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground tabular">{r.status === "absent" ? "—" : fmtTime(r.recordedAt)}{r.note && <div className="text-[11px] truncate max-w-[160px]" title={r.note}>{r.note}</div>}</td>
                      <td className="px-4 py-2"><MethodTag method={r.method} /></td>
                      <td className="px-4 py-2">
                        <Select value={r.status} onValueChange={(v) => update.mutate({ sessionId: r.sessionId, studentId: r.studentId, status: v })}>
                          <SelectTrigger className="h-7 w-[112px] text-xs border-transparent hover:border-input" data-testid={`select-log-status-${r.id}`}><StatusBadge status={r.status} /></SelectTrigger>
                          <SelectContent>{["present", "late", "excused", "absent"].map((s) => <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {log && <div className="px-4 py-2.5 border-t text-xs text-muted-foreground">{rows.length} record{rows.length === 1 ? "" : "s"} shown</div>}
        </div>

        <div className="space-y-4">
          <Kpi label="Records in view" value={log?.length ?? "—"} hint={`${from} → ${to}`} />
          <section className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 px-4 py-3 border-b"><Clock className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Still missing now</h2></div>
            {!open ? <Skeleton className="h-24 m-4" /> : open.length === 0 ? <p className="text-xs text-muted-foreground p-4">No sessions are currently open.</p> : (
              <div className="divide-y">
                {open.map((s) => {
                  const missing = s.enrolled - s.present - s.late - s.absent - s.excused;
                  return (
                    <div key={s.id} className="px-4 py-2.5 text-sm flex items-center justify-between" data-testid={`row-missing-${s.id}`}>
                      <div><div className="font-mono text-xs">{s.course.code}</div><div className="text-[11px] text-muted-foreground">opened {timeAgo(s.startsAt, now)}</div></div>
                      <div className="text-end"><div className="font-mono font-semibold tabular text-red-600 dark:text-red-400">{missing}</div><div className="text-[11px] text-muted-foreground">not checked in</div></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b"><h2 className="text-sm font-semibold">Most absences in view</h2></div>
            {offenders.length === 0 ? <p className="text-xs text-muted-foreground p-4">No absences in the current filter.</p> : (
              <div className="divide-y">
                {offenders.map((o) => (
                  <div key={o.s.id} className="px-4 py-2 flex items-center justify-between text-sm">
                    <div className="min-w-0"><div className="truncate">{o.s.name}</div><div className="font-mono text-[11px] text-muted-foreground">{o.s.studentCode}</div></div>
                    <span className="font-mono tabular text-sm">{o.n}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
