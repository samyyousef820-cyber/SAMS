import { useEffect, useState } from "react";
import { useAuth, useT } from "@/lib/app";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Download, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE } from "@/lib/queryClient";
import { PageHeader, Kpi, RateBar, EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { Course, StudentStats, SessionView } from "@shared/schema";

type Preview = {
  from: string; to: string; course: Course | null; logCount: number;
  totals: { sessions: number; records: number; present: number; late: number; absent: number; excused: number; rate: number };
  students: (StudentStats & { courses: string })[];
  sessions: SessionView[];
  courseSummary: { course: Course; sessions: number; present: number; late: number; absent: number; excused: number; rate: number }[];
};

function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); }

const PRESETS = [
  { label: "Last 7 days", from: () => daysAgo(6) },
  { label: "Last 30 days", from: () => daysAgo(29) },
  { label: "This month", from: () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); } },
];

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const [courseId, setCourseId] = useState("all");
  const [threshold, setThreshold] = useState("75");
  const [onlyRisk, setOnlyRisk] = useState(false);

  const { user } = useAuth();
  const { t } = useT();
  const isDoc = user?.role === "doctor";
  const { data: allCourses } = useQuery<Course[]>({ queryKey: ["/api/courses"] });
  const courses = allCourses?.filter((c) => !isDoc || c.doctorId === user!.id);
  useEffect(() => { if (isDoc && courseId === "all" && courses?.length) setCourseId(String(courses[0].id)); }, [isDoc, courses, courseId]);
  const qs = new URLSearchParams({ from, to, courseId, threshold }).toString();
  const { data, isLoading, isFetching } = useQuery<Preview>({ queryKey: [`/api/reports/preview?${qs}`], enabled: !isDoc || courseId !== "all" });
  const exportUrl = `${API_BASE}/api/reports/export?${qs}`;
  const th = Number(threshold) || 75;
  const studs = (data?.students ?? []).filter((s) => !onlyRisk || (s.total > 0 && s.rate < th)).sort((a, b) => a.rate - b.rate);
  const atRisk = (data?.students ?? []).filter((s) => s.total > 0 && s.rate < th).length;

  return (
    <div>
      <PageHeader title={t("Reports")} subtitle={t("Build an attendance report for any period and export it as a formatted Excel workbook.")} />

      <section className="rounded-lg border bg-card p-5 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" data-testid="input-report-from" /></div>
          <div className="space-y-1.5"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" data-testid="input-report-to" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-[230px]" data-testid="select-report-course"><SelectValue /></SelectTrigger>
              <SelectContent>
                {!isDoc && <SelectItem value="all">{t("All courses")}</SelectItem>}
                {courses?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.code} · {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">At-risk below</Label>
            <Select value={threshold} onValueChange={setThreshold}>
              <SelectTrigger className="w-[110px]" data-testid="select-threshold"><SelectValue /></SelectTrigger>
              <SelectContent>{["60", "70", "75", "80", "85", "90"].map((t) => <SelectItem key={t} value={t}>{t}%</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => { setFrom(p.from()); setTo(daysAgo(0)); }} data-testid={`button-preset-${p.label.toLowerCase().replace(/\s/g, "-")}`}>{p.label}</Button>
            ))}
          </div>
          <a href={exportUrl} target="_blank" rel="noopener noreferrer" className="ms-auto" data-testid="link-export-excel">
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white" disabled={!data}><Download className="h-4 w-4 me-2" />Export to Excel</Button>
          </a>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Sheet className="h-3.5 w-3.5" />Workbook sheets:
          {["Summary", "Students", "Sessions", "Attendance Log", "Absences"].map((s) => <span key={s} className="rounded border px-2 py-0.5 font-mono text-[11px]">{s}</span>)}
          {data && <span className="ms-1">· {data.logCount.toLocaleString()} rows in the detailed log</span>}
        </div>
      </section>

      <div className={cn("transition-opacity", isFetching && "opacity-60")}>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
          {isLoading || !data ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[98px]" />) : <>
            <Kpi label="Sessions" value={data.totals.sessions} />
            <Kpi label="Attendance rate" value={`${data.totals.rate.toFixed(1)}%`} />
            <Kpi label="Present" accent="bg-emerald-500" value={data.totals.present} />
            <Kpi label="Late" accent="bg-amber-500" value={data.totals.late} />
            <Kpi label="Absent" accent="bg-red-500" value={data.totals.absent} />
            <Kpi label={`Below ${th}%`} accent="bg-red-500" value={atRisk} hint="students" />
          </>}
        </div>

        <div className="grid xl:grid-cols-5 gap-4">
          <section className="xl:col-span-2 rounded-lg border bg-card">
            <div className="px-5 py-3 border-b"><h2 className="text-sm font-semibold">By course</h2></div>
            {!data ? <Skeleton className="h-60 m-4" /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-start text-xs text-muted-foreground border-b"><th className="font-medium px-5 py-2">Course</th><th className="font-medium px-2 py-2 text-end">Sess.</th><th className="font-medium px-2 py-2 text-end">Abs.</th><th className="font-medium px-5 py-2">Rate</th></tr></thead>
                <tbody className="divide-y">
                  {data.courseSummary.map((c) => (
                    <tr key={c.course.id}>
                      <td className="px-5 py-2.5"><div className="font-mono text-xs">{c.course.code}</div><div className="text-[11px] text-muted-foreground truncate max-w-[170px]">{c.course.name}</div></td>
                      <td className="px-2 py-2.5 text-end font-mono tabular text-xs">{c.sessions}</td>
                      <td className="px-2 py-2.5 text-end font-mono tabular text-xs">{c.absent}</td>
                      <td className="px-5 py-2.5 w-[160px]"><RateBar rate={c.rate} threshold={th} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="xl:col-span-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="text-sm font-semibold">Students</h2>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} className="accent-[hsl(var(--primary))]" data-testid="checkbox-only-risk" />
                Only below threshold
              </label>
            </div>
            {!data ? <Skeleton className="h-60 m-4" /> : studs.length === 0 ? <EmptyState icon={<FileSpreadsheet className="h-6 w-6" />} title="No students to show" /> : (
              <div className="max-h-[460px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card"><tr className="text-start text-xs text-muted-foreground border-b"><th className="font-medium px-5 py-2">Student</th><th className="font-medium px-2 py-2 text-end">P</th><th className="font-medium px-2 py-2 text-end">L</th><th className="font-medium px-2 py-2 text-end">A</th><th className="font-medium px-2 py-2 text-end">E</th><th className="font-medium px-5 py-2">Rate</th></tr></thead>
                  <tbody className="divide-y">
                    {studs.map((s) => (
                      <tr key={s.id} data-testid={`row-report-${s.id}`}>
                        <td className="px-5 py-2"><div className="truncate max-w-[220px]">{s.name}</div><div className="font-mono text-[11px] text-muted-foreground">{s.studentCode}</div></td>
                        <td className="px-2 py-2 text-end font-mono tabular text-xs">{s.present}</td>
                        <td className="px-2 py-2 text-end font-mono tabular text-xs">{s.late}</td>
                        <td className="px-2 py-2 text-end font-mono tabular text-xs">{s.absent}</td>
                        <td className="px-2 py-2 text-end font-mono tabular text-xs">{s.excused}</td>
                        <td className="px-5 py-2 w-[170px]"><RateBar rate={s.rate} threshold={th} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
