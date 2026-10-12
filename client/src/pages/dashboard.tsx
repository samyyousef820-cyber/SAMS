import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { ScanLine, AlertTriangle, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Kpi, StatusBadge, MethodTag, RateBar, fmtDate, timeAgo, useNow, EmptyState } from "@/components/shared";
import type { LogEntry, SessionView, StudentStats } from "@shared/schema";

type Dash = {
  today: string;
  totals: { students: number; courses: number; sessionsToday: number; openSessions: number };
  todayCounts: { present: number; late: number; absent: number; excused: number; awaiting: number; expected: number };
  overallRate: number; atRiskCount: number;
  trend: { date: string; present: number; late: number; absent: number; excused: number; rate: number }[];
  atRisk: StudentStats[]; recent: LogEntry[];
};

export default function Dashboard() {
  const { data, isLoading } = useQuery<Dash>({ queryKey: ["/api/dashboard"] });
  const { data: sessions } = useQuery<SessionView[]>({ queryKey: ["/api/sessions?status=open"] });
  const now = useNow(10000);

  const tc = data?.todayCounts;
  const arrived = tc ? tc.present + tc.late : 0;

  return (
    <div>
      <PageHeader
        title="Attendance Overview"
        subtitle="Live picture of today's classes and the last three weeks of attendance."
        actions={<Link href="/checkin"><Button data-testid="button-goto-checkin"><ScanLine className="h-4 w-4 me-2" />Open check-in</Button></Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {isLoading || !data ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[98px]" />) : <>
          <Kpi testId="kpi-checked-in" label="Checked in today" accent="bg-emerald-500" value={`${arrived}`} hint={`of ${tc!.expected} expected`} />
          <Kpi testId="kpi-late" label="Late arrivals" accent="bg-amber-500" value={tc!.late} hint={arrived ? `${Math.round((tc!.late / arrived) * 100)}% of arrivals` : "—"} />
          <Kpi testId="kpi-awaiting" label="Awaiting check-in" accent="bg-primary" value={tc!.awaiting} hint={`${data.totals.openSessions} open session${data.totals.openSessions === 1 ? "" : "s"}`} />
          <Kpi testId="kpi-rate" label="Term attendance rate" value={`${data.overallRate.toFixed(1)}%`} hint={`${data.totals.students} students · ${data.totals.courses} courses`} />
          <Kpi testId="kpi-at-risk" label="Below 75%" accent="bg-red-500" value={data.atRiskCount} hint="students at risk" />
        </>}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <section className="lg:col-span-2 rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">Daily attendance</h2>
              <p className="text-xs text-muted-foreground">Records per teaching day, last 14 days</p>
            </div>
          </div>
          <div className="h-[260px]">
            {data ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend.map((t) => ({ ...t, label: fmtDate(t.date) }))} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="present" name="Present" stackId="a" fill="hsl(152 55% 40%)" />
                  <Bar dataKey="late" name="Late" stackId="a" fill="hsl(38 90% 52%)" />
                  <Bar dataKey="excused" name="Excused" stackId="a" fill="hsl(225 12% 65%)" />
                  <Bar dataKey="absent" name="Absent" stackId="a" fill="hsl(0 68% 54%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Skeleton className="h-full" />}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Sessions in progress</h2>
          </div>
          {!sessions ? <Skeleton className="h-40" /> : sessions.length === 0 ? (
            <EmptyState icon={<ScanLine className="h-6 w-6" />} title="No open sessions" body="Start a session from the check-in screen to begin taking attendance." />
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const arrivedS = s.present + s.late;
                const pct = s.enrolled ? (arrivedS / s.enrolled) * 100 : 0;
                return (
                  <Link key={s.id} href={`/checkin/${s.id}`} className="block rounded-md border p-3 hover:bg-muted/50 transition-colors" data-testid={`card-session-${s.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{s.course.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{s.course.code} · {s.course.room} · started {timeAgo(s.startsAt, now)}</div>
                      </div>
                      <div className="text-end font-mono text-sm tabular">{arrivedS}<span className="text-muted-foreground">/{s.enrolled}</span></div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden flex">
                      <div className="bg-emerald-500" style={{ width: `${(s.present / Math.max(1, s.enrolled)) * 100}%` }} />
                      <div className="bg-amber-500" style={{ width: `${(s.late / Math.max(1, s.enrolled)) * 100}%` }} />
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{pct.toFixed(0)}% arrived · {s.late} late</div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-lg border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-sm font-semibold">Live check-in feed</h2>
            <Link href="/log" className="text-xs text-primary hover:underline" data-testid="link-full-log">Full log</Link>
          </div>
          <div className="divide-y">
            {!data ? <div className="p-5"><Skeleton className="h-48" /></div> : data.recent.map((r) => (
              <div key={r.id} className="feed-in flex items-center gap-3 px-5 py-2.5 text-sm" data-testid={`row-feed-${r.id}`}>
                <div className="font-mono text-xs text-muted-foreground w-28 shrink-0">{r.student.studentCode}</div>
                <div className="flex-1 min-w-0 truncate">{r.student.name}<span className="text-muted-foreground"> · {r.course.code}</span></div>
                <MethodTag method={r.method} />
                <StatusBadge status={r.status} />
                <div className="text-xs text-muted-foreground w-16 text-end tabular">{timeAgo(r.recordedAt, now)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold">Students at risk</h2>
          </div>
          <div className="divide-y">
            {!data ? <div className="p-5"><Skeleton className="h-48" /></div> : data.atRisk.length === 0 ? (
              <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Nobody below threshold" />
            ) : data.atRisk.map((s) => (
              <div key={s.id} className="px-5 py-2.5" data-testid={`row-risk-${s.id}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.absent} absences</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="font-mono text-[11px] text-muted-foreground w-24">{s.studentCode}</span>
                  <div className="flex-1"><RateBar rate={s.rate} /></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
