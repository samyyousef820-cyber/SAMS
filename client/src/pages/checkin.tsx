import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { QrCode, Barcode as BarcodeIcon, Camera, CameraOff, Play, Square, Shuffle, ShieldAlert, UserX, CheckCircle2, AlertTriangle, XCircle, Keyboard, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, StatusBadge, MethodTag, QrImage, Barcode, fmtTime, timeAgo, useNow, EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useAuth, useT } from "@/lib/app";
import type { Course, SessionView, Student, Attendance, LogEntry, StudentStats } from "@shared/schema";

type RosterRow = { student: Student; record: LogEntry | null };
type CheckResp = { ok: true; record: LogEntry } | { ok: false; error: string; code: string; student?: Student; record?: Attendance };
type Mode = "qr" | "barcode";

function beep(ok: boolean) {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    const ctx = new Ctx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = ok ? 1320 : 220; o.type = ok ? "sine" : "square";
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.12 : 0.3));
    o.start(); o.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
  } catch { /* audio not available */ }
}

export default function CheckIn() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const now = useNow(5000);
  const { user } = useAuth();
  const { t } = useT();
  const doc = user?.role === "doctor" ? `&doctorId=${user.id}` : "";

  const { data: sessions, isLoading: loadingSessions } = useQuery<SessionView[]>({ queryKey: [`/api/sessions?status=open${doc}`] });
  const { data: allCourses } = useQuery<Course[]>({ queryKey: ["/api/courses"] });
  const courses = allCourses?.filter((c) => user?.role !== "doctor" || c.doctorId === user.id);
  const { data: allStudents } = useQuery<StudentStats[]>({ queryKey: ["/api/students"] });

  const sessionId = params.id ? Number(params.id) : sessions?.[0]?.id;
  const session = sessions?.find((s) => s.id === sessionId);
  useEffect(() => {
    if (sessions && params.id && !sessions.some((s) => s.id === Number(params.id)) && sessions[0]) navigate(`/checkin/${sessions[0].id}`);
  }, [sessions, params.id]);

  const { data: roster } = useQuery<RosterRow[]>({ queryKey: ["/api/sessions", sessionId, "roster"], enabled: !!sessionId });

  const [mode, setMode] = useState<Mode>("qr");
  const [scanning, setScanning] = useState<{ code: string; mode: Mode; name?: string } | null>(null);
  const [result, setResult] = useState<CheckResp | null>(null);
  const [manual, setManual] = useState("");
  const [walletFilter, setWalletFilter] = useState("");
  const [newCourse, setNewCourse] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const checkin = useMutation({
    mutationFn: async (v: { code: string; method: string }) => (await apiRequest("POST", "/api/checkin", { sessionId, ...v })).json() as Promise<CheckResp>,
    onSuccess: (r) => {
      setResult(r); beep(r.ok);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast({ title: "Check-in failed", description: e.message, variant: "destructive" }),
  });

  const openSession = useMutation({
    mutationFn: async (courseId: number) => (await apiRequest("POST", "/api/sessions", { courseId })).json(),
    onSuccess: (s: { id: number }) => { queryClient.invalidateQueries(); navigate(`/checkin/${s.id}`); setNewCourse(""); toast({ title: "Session started", description: "Students can now check in." }); },
  });
  const closeSession = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/sessions/${sessionId}/close`)).json(),
    onSuccess: (r: { markedAbsent: number }) => { queryClient.invalidateQueries(); setResult(null); navigate("/checkin"); toast({ title: "Session closed", description: `${r.markedAbsent} student${r.markedAbsent === 1 ? "" : "s"} logged as absent.` }); },
  });
  const setStatus = useMutation({
    mutationFn: async (v: { studentId: number; status: string }) => (await apiRequest("POST", "/api/attendance/status", { sessionId, ...v })).json(),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const pending = useMemo(() => roster?.filter((r) => !r.record) ?? [], [roster]);
  const arrived = useMemo(() => (roster?.filter((r) => r.record) ?? []).sort((a, b) => b.record!.recordedAt.localeCompare(a.record!.recordedAt)), [roster]);

  function simulate(code: string, name?: string, m: Mode = mode) {
    if (!sessionId || scanning) return;
    setScanning({ code, mode: m, name });
    setResult(null);
    setTimeout(() => {
      checkin.mutate({ code, method: m });
      setScanning(null);
    }, 900);
  }

  function randomArrival() {
    if (!pending.length) return toast({ title: "Everyone is here", description: "No remaining students in this session." });
    const r = pending[Math.floor(Math.random() * pending.length)];
    simulate(r.student.studentCode, r.student.name);
  }
  function invalidScan() {
    const src = allStudents?.[Math.floor(Math.random() * (allStudents?.length ?? 1))];
    if (!src) return;
    // tamper with the check digit -> must be rejected
    const forged = src.studentCode.replace(/(\d)$/, (d) => String((Number(d) + 3) % 10));
    simulate(forged);
  }
  function outsiderScan() {
    const enrolled = new Set(roster?.map((r) => r.student.id));
    const outsiders = allStudents?.filter((s) => !enrolled.has(s.id)) ?? [];
    if (!outsiders.length) return;
    const s = outsiders[Math.floor(Math.random() * outsiders.length)];
    simulate(s.studentCode, s.name);
  }

  // ---------- camera ----------
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const lastCam = useRef<{ code: string; t: number }>({ code: "", t: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!camOn) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    (async () => {
      try {
        const BD = (window as any).BarcodeDetector;
        if (!BD) throw new Error("unsupported");
        const detector = new BD({ formats: ["qr_code", "code_128"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current!;
        v.srcObject = stream; await v.play();
        timer = setInterval(async () => {
          if (!v.videoWidth) return;
          try {
            const codes = await detector.detect(v);
            const text = codes[0]?.rawValue as string | undefined;
            if (!text) return;
            const t = Date.now();
            if (text === lastCam.current.code && t - lastCam.current.t < 4000) return;
            lastCam.current = { code: text, t };
            checkin.mutate({ code: text, method: "camera" });
          } catch { /* frame not ready */ }
        }, 300);
      } catch (e: any) {
        setCamError(e?.message === "unsupported"
          ? "Live camera scanning needs a browser with the BarcodeDetector API (Chrome, Edge or Android). Use the simulator or type the ID instead."
          : e?.name === "NotAllowedError" ? "Camera permission was blocked. Use the simulator or type the ID instead."
          : "Camera is not available in this browser frame. Use the simulator or type the ID instead.");
        setCamOn(false);
      }
    })();
    return () => { stopped = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [camOn]);

  // ---------- render ----------
  const walletList = pending.filter((r) => !walletFilter || r.student.name.toLowerCase().includes(walletFilter.toLowerCase()) || r.student.studentCode.includes(walletFilter.toUpperCase()));

  if (loadingSessions) return <Skeleton className="h-[600px]" />;

  return (
    <div>
      <PageHeader
        title={t("Attendance Check-in")}
        subtitle={t("Scan student QR codes or barcodes. Arrivals after the grace period are marked late automatically.")}
        actions={
          <div className="flex items-center gap-2">
            <Select value={newCourse} onValueChange={setNewCourse}>
              <SelectTrigger className="w-[220px]" data-testid="select-new-course"><SelectValue placeholder={t("Start a session for…")} /></SelectTrigger>
              <SelectContent>
                {courses?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.code} · {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button disabled={!newCourse || openSession.isPending} onClick={() => openSession.mutate(Number(newCourse))} data-testid="button-start-session">
              <Play className="h-4 w-4 me-1.5" />Start
            </Button>
          </div>
        }
      />

      {!sessions?.length ? (
        <div className="rounded-lg border bg-card"><EmptyState icon={<QrCode className="h-8 w-8" />} title="No sessions are open" body="Pick a course above and start a session to begin scanning student IDs." /></div>
      ) : (
        <>
          {/* session tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {sessions.map((s) => (
              <button key={s.id} onClick={() => navigate(`/checkin/${s.id}`)} data-testid={`button-session-${s.id}`}
                className={cn("rounded-md border px-3 py-2 text-start text-sm transition-colors", s.id === sessionId ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/60")}>
                <div className="font-medium">{s.course.code} <span className="font-normal text-muted-foreground">· {s.course.room}</span></div>
                <div className="text-xs text-muted-foreground tabular">{s.present + s.late}/{s.enrolled} in · opened {timeAgo(s.startsAt, now)}</div>
              </button>
            ))}
            {session && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="ms-auto" data-testid="button-close-session"><Square className="h-4 w-4 me-1.5" />Close session</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close {session.course.code}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {pending.length} student{pending.length === 1 ? "" : "s"} who haven't checked in will be logged as absent. You can still change individual statuses afterwards from the absence log.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep open</AlertDialogCancel>
                    <AlertDialogAction onClick={() => closeSession.mutate()} data-testid="button-confirm-close">Close and log absences</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {session && (
            <div className="grid xl:grid-cols-12 gap-4">
              <div className="xl:col-span-7 space-y-4">
                {/* scanner */}
                <section className="rounded-lg border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-sm font-semibold">{session.course.name}</h2>
                      <p className="text-xs text-muted-foreground">{session.course.instructor} · late after {session.course.lateAfterMin} min · started {fmtTime(session.startsAt)}</p>
                    </div>
                    <div className="inline-flex rounded-md border p-0.5 bg-muted/40" role="tablist">
                      {([["qr", "QR code", QrCode], ["barcode", "Barcode", BarcodeIcon]] as const).map(([m, label, Icon]) => (
                        <button key={m} onClick={() => setMode(m)} data-testid={`button-mode-${m}`}
                          className={cn("flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium", mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}>
                          <Icon className="h-3.5 w-3.5" />{label}
                        </button>
                      ))}
                      <button onClick={() => { setCamError(null); setCamOn((v) => !v); }} data-testid="button-camera"
                        className={cn("flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium", camOn ? "bg-background shadow-sm" : "text-muted-foreground")}>
                        {camOn ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}Camera
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="relative aspect-[4/3] rounded-lg bg-[#0d1530] overflow-hidden" data-testid="viewfinder">
                      <video ref={videoRef} muted playsInline className={cn("absolute inset-0 h-full w-full object-cover", !camOn && "hidden")} />
                      {!camOn && (
                        <div className="absolute inset-0 grid place-items-center">
                          {scanning ? (
                            <div className="bg-white rounded-md p-3 shadow-lg flex flex-col items-center gap-1 scale-95">
                              {scanning.mode === "qr" ? <QrImage value={scanning.code} size={110} /> : <Barcode value={scanning.code} height={60} />}
                              <div className="font-mono text-[10px] text-slate-600">{scanning.code}</div>
                            </div>
                          ) : (
                            <div className="text-center text-slate-300/80 px-6">
                              {mode === "qr" ? <QrCode className="h-10 w-10 mx-auto mb-2 opacity-60" /> : <BarcodeIcon className="h-10 w-10 mx-auto mb-2 opacity-60" />}
                              <div className="text-xs">Present a student {mode === "qr" ? "QR code" : "barcode"}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* brackets */}
                      {["top-3 start-3 border-t-2 border-s-2", "top-3 end-3 border-t-2 border-e-2", "bottom-3 start-3 border-b-2 border-s-2", "bottom-3 end-3 border-b-2 border-e-2"].map((c) => (
                        <span key={c} className={cn("absolute h-6 w-6 border-[hsl(225_75%_66%)] rounded-sm pointer-events-none", c)} />
                      ))}
                      {(scanning || camOn) && <div className="scan-line" />}
                      <div className="absolute bottom-2 start-0 end-0 text-center text-[10px] font-mono tracking-widest text-slate-400">
                        {camOn ? "CAMERA ACTIVE" : scanning ? "READING…" : "READY"}
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <ResultPanel result={result} busy={!!scanning || checkin.isPending} scanningName={scanning?.name} />
                      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { checkin.mutate({ code: manual.trim(), method: "manual" }); setManual(""); } }}>
                        <div className="relative flex-1">
                          <Keyboard className="h-4 w-4 absolute start-2.5 top-2.5 text-muted-foreground" />
                          <Input ref={inputRef} value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t("Student ID")} className="ps-8 font-mono text-sm" data-testid="input-manual-code" />
                        </div>
                        <Button type="submit" variant="secondary" data-testid="button-manual-checkin">Check in</Button>
                      </form>
                      <p className="text-[11px] text-muted-foreground mt-1.5">USB barcode scanners work here too — they type the ID and press Enter.</p>
                    </div>
                  </div>
                  {camError && <p className="mt-3 text-xs text-amber-700 dark:text-amber-400" data-testid="text-camera-error">{camError}</p>}

                  <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                    <Button size="sm" onClick={randomArrival} disabled={!!scanning} data-testid="button-random-arrival"><Shuffle className="h-3.5 w-3.5 me-1.5" />Simulate random arrival</Button>
                    <Button size="sm" variant="outline" onClick={invalidScan} disabled={!!scanning} data-testid="button-invalid-scan"><ShieldAlert className="h-3.5 w-3.5 me-1.5" />Forged ID</Button>
                    <Button size="sm" variant="outline" onClick={outsiderScan} disabled={!!scanning} data-testid="button-outsider-scan"><UserX className="h-3.5 w-3.5 me-1.5" />Wrong course</Button>
                    {arrived[0] && <Button size="sm" variant="outline" onClick={() => simulate(arrived[0].student.studentCode, arrived[0].student.name)} disabled={!!scanning} data-testid="button-duplicate-scan">Duplicate scan</Button>}
                  </div>
                </section>

                {/* wallet */}
                <section className="rounded-lg border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-sm font-semibold">Student ID wallet</h2>
                      <p className="text-xs text-muted-foreground">Click a card to present it to the scanner. Only students still expected are shown.</p>
                    </div>
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 absolute start-2.5 top-2.5 text-muted-foreground" />
                      <Input value={walletFilter} onChange={(e) => setWalletFilter(e.target.value)} placeholder="Filter" className="h-8 ps-8 w-40 text-sm" data-testid="input-wallet-filter" />
                    </div>
                  </div>
                  {walletList.length === 0 ? (
                    <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title={pending.length ? "No match" : "Everyone has checked in"} />
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[340px] overflow-y-auto pe-1">
                      {walletList.map(({ student }) => (
                        <button key={student.id} onClick={() => simulate(student.studentCode, student.name)} disabled={!!scanning} data-testid={`button-wallet-${student.id}`}
                          className="group rounded-md border bg-white text-slate-900 p-2 text-start hover:border-primary hover:shadow-sm transition disabled:opacity-60">
                          {mode === "qr" ? (
                            <div className="flex items-center gap-2">
                              <QrImage value={student.studentCode} size={40} />
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">{student.name}</div>
                                <div className="font-mono text-[10px] text-slate-500 truncate">{student.studentCode}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="min-w-0">
                              <Barcode value={student.studentCode} height={26} className="w-full h-[26px]" />
                              <div className="mt-1 text-xs font-medium truncate">{student.name}</div>
                              <div className="font-mono text-[10px] text-slate-500 truncate">{student.studentCode}</div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* roster */}
              <section className="xl:col-span-5 rounded-lg border bg-card">
                <Tabs defaultValue="arrived">
                  <div className="flex items-center justify-between px-5 pt-4">
                    <h2 className="text-sm font-semibold">Session roster</h2>
                    <TabsList className="h-8">
                      <TabsTrigger value="arrived" className="text-xs" data-testid="tab-arrived">Arrived · {arrived.length}</TabsTrigger>
                      <TabsTrigger value="pending" className="text-xs" data-testid="tab-pending">Not yet · {pending.length}</TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="px-5 pt-3">
                    <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                      <div className="bg-emerald-500 transition-all" style={{ width: `${(session.present / Math.max(1, session.enrolled)) * 100}%` }} />
                      <div className="bg-amber-500 transition-all" style={{ width: `${(session.late / Math.max(1, session.enrolled)) * 100}%` }} />
                      <div className="bg-slate-400 transition-all" style={{ width: `${(session.excused / Math.max(1, session.enrolled)) * 100}%` }} />
                    </div>
                    <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground tabular">
                      <span>{session.present} on time</span><span>{session.late} late</span><span>{session.excused} excused</span><span className="ms-auto">{session.enrolled} enrolled</span>
                    </div>
                  </div>
                  <TabsContent value="arrived" className="mt-2">
                    <RosterList rows={arrived} onStatus={(studentId, status) => setStatus.mutate({ studentId, status })} />
                  </TabsContent>
                  <TabsContent value="pending" className="mt-2">
                    <RosterList rows={pending} onStatus={(studentId, status) => setStatus.mutate({ studentId, status })} />
                  </TabsContent>
                </Tabs>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResultPanel({ result, busy, scanningName }: { result: CheckResp | null; busy: boolean; scanningName?: string }) {
  if (busy) return (
    <div className="flex-1 rounded-lg border border-dashed p-4 grid place-items-center text-sm text-muted-foreground" data-testid="status-scan-busy">
      <div className="text-center"><div className="h-5 w-5 mx-auto mb-2 rounded-full border-2 border-primary border-t-transparent animate-spin" />Verifying {scanningName ?? "ID"}…</div>
    </div>
  );
  if (!result) return (
    <div className="flex-1 rounded-lg border border-dashed p-4 grid place-items-center text-center text-sm text-muted-foreground">
      <div>Waiting for a scan<div className="text-xs mt-1">Each ID carries a check digit, so forged or mistyped codes are rejected.</div></div>
    </div>
  );
  if (result.ok) {
    const r = result.record;
    const late = r.status === "late";
    return (
      <div className={cn("feed-in flex-1 rounded-lg border p-4", late ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800")} data-testid="status-scan-result">
        <div className="flex items-center gap-2">
          {late ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          <span className="font-semibold text-sm">{late ? "Checked in — late" : "Checked in"}</span>
        </div>
        <div className="mt-3 text-base font-semibold">{r.student.name}</div>
        <div className="font-mono text-xs text-muted-foreground">{r.student.studentCode}</div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">{fmtTime(r.recordedAt)} · <MethodTag method={r.method} /> · {r.student.department}</div>
      </div>
    );
  }
  const warn = result.code === "duplicate";
  return (
    <div className={cn("feed-in flex-1 rounded-lg border p-4", warn ? "border-slate-300 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700" : "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800")} data-testid="status-scan-result">
      <div className="flex items-center gap-2">
        <XCircle className={cn("h-5 w-5", warn ? "text-slate-500" : "text-red-600")} />
        <span className="font-semibold text-sm">{{ duplicate: "Already recorded", invalid: "Invalid ID", not_found: "Unknown student", not_enrolled: "Not enrolled", closed: "Session closed" }[result.code] ?? "Rejected"}</span>
      </div>
      <div className="mt-3 text-sm">{result.error}</div>
      {result.record && <div className="mt-2 text-xs text-muted-foreground">First scan at {fmtTime(result.record.recordedAt)} · <StatusBadge status={result.record.status} /></div>}
    </div>
  );
}

function RosterList({ rows, onStatus }: { rows: RosterRow[]; onStatus: (studentId: number, status: string) => void }) {
  if (!rows.length) return <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Nobody here" />;
  return (
    <div className="divide-y max-h-[720px] overflow-y-auto">
      {rows.map(({ student, record }) => (
        <div key={student.id} className="flex items-center gap-3 px-5 py-2" data-testid={`row-roster-${student.id}`}>
          <div className="min-w-0 flex-1">
            <div className="text-sm truncate">{student.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{student.studentCode}{record && record.status !== "absent" ? ` · ${fmtTime(record.recordedAt)}` : ""}</div>
          </div>
          {record && <MethodTag method={record.method} />}
          <Select value={record?.status ?? ""} onValueChange={(v) => onStatus(student.id, v)}>
            <SelectTrigger className="h-8 w-[118px] text-xs" data-testid={`select-status-${student.id}`}>
              {record ? <StatusBadge status={record.status} /> : <span className="text-muted-foreground">Set status</span>}
            </SelectTrigger>
            <SelectContent>
              {["present", "late", "excused", "absent"].map((s) => <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
