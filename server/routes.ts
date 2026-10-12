import type { Express, Response, Request } from "express";
import type { Server } from "node:http";
import ExcelJS from "exceljs";
import { storage, localDate, DEPARTMENTS, SEMESTER, ACADEMIC_YEAR, PROGRAMS } from "./storage";
import {
  insertStudentSchema, insertStaffSchema, insertCourseSchema, insertEventSchema, checkInSchema, statusUpdateSchema,
  paymentSchema, profileUpdateSchema, type Role,
} from "@shared/schema";

// ---------- realtime (Server-Sent Events) ----------
const clients = new Set<Response>();
function broadcast(type: string, payload: unknown = {}) {
  const msg = `event: change\ndata: ${JSON.stringify({ type, payload, at: Date.now() })}\n\n`;
  clients.forEach((c) => c.write(msg));
}
const num = (v: unknown) => Number(v);
const who = (req: Request) => ({ role: (req.query.role as Role) || "student", id: Number(req.query.uid) || 1 });
function wrap(fn: (req: Request, res: Response) => any) {
  return (req: Request, res: Response) => {
    try {
      const out = fn(req, res);
      if (out !== undefined && !res.headersSent) res.json(out);
    } catch (e: any) { res.status(400).json({ message: e?.message ?? "Request failed" }); }
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  storage.seedIfEmpty();
  setInterval(() => { try { if (storage.tick()) broadcast("session"); } catch (e) { console.error(e); } }, 30000);

  app.get("/api/stream", (req, res) => {
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    res.write(`event: hello\ndata: {}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(`: ping\n\n`), 20000);
    req.on("close", () => { clearInterval(ping); clients.delete(res); });
  });

  // ---------- auth ----------
  app.get("/api/auth/personas", wrap(() => storage.personas()));
  app.post("/api/auth/login", (req, res) => {
    const { role, identifier, password } = req.body ?? {};
    const u = storage.login(role, String(identifier ?? ""), String(password ?? ""));
    if (!u) return res.status(401).json({ message: "Incorrect ID or password" });
    res.json(u);
  });

  app.get("/api/meta", wrap(() => ({ departments: DEPARTMENTS, today: localDate(), semester: SEMESTER, academicYear: ACADEMIC_YEAR, programs: PROGRAMS.map((p) => p.name) })));
  app.get("/api/search", wrap((req) => { const u = who(req); return storage.search(String(req.query.q ?? ""), u.role, u.id); }));

  // ---------- student portal ----------
  app.get("/api/student/:id/overview", wrap((req) => storage.studentOverview(num(req.params.id))));
  app.get("/api/student/:id/courses", wrap((req) => storage.studentCourses(num(req.params.id))));
  app.get("/api/student/:id/grades", wrap((req) => storage.studentGrades(num(req.params.id))));
  app.get("/api/student/:id/attendance", wrap((req) => storage.studentAttendance(num(req.params.id))));
  app.get("/api/student/:id/registration", wrap((req) => storage.registration(num(req.params.id))));
  app.post("/api/student/:id/register", wrap((req) => { const r = storage.register(num(req.params.id), num(req.body?.courseId)); broadcast("registration"); return r; }));
  app.post("/api/student/:id/drop", wrap((req) => { const r = storage.drop(num(req.params.id), num(req.body?.courseId)); broadcast("registration"); return r; }));
  app.get("/api/student/:id/fees", wrap((req) => storage.studentFees(num(req.params.id))));
  app.post("/api/student/:id/pay", wrap((req) => {
    const p = paymentSchema.parse(req.body);
    const r = storage.pay(num(req.params.id), p.amount, p.method); broadcast("payment"); return r;
  }));
  app.get("/api/student/:id/profile", wrap((req) => storage.getStudent(num(req.params.id))));
  app.patch("/api/student/:id/profile", wrap((req) => { const p = profileUpdateSchema.parse(req.body); const r = storage.updateProfile(num(req.params.id), p); broadcast("profile"); return r; }));

  // ---------- doctor portal ----------
  app.get("/api/doctor/:id/overview", wrap((req) => storage.doctorOverview(num(req.params.id))));
  app.get("/api/doctor/:id/courses", wrap((req) => storage.doctorCourses(num(req.params.id))));
  app.get("/api/doctor/:id/profile", wrap((req) => storage.listStaff().find((s) => s.id === num(req.params.id))));
  app.get("/api/gradebook/:courseId", wrap((req) => storage.gradebook(num(req.params.courseId))));
  app.post("/api/grades", wrap((req) => {
    const score = req.body?.score === null || req.body?.score === "" ? null : Math.max(0, Math.min(100, Math.round(Number(req.body?.score))));
    const r = storage.setScore(num(req.body?.enrollmentId), score as number | null); broadcast("grade"); return r;
  }));

  // ---------- schedule ----------
  app.get("/api/schedule", wrap((req) => {
    const q = req.query as Record<string, string>;
    if (q.studentId) return storage.slots(storage.currentCourseIds(num(q.studentId)));
    if (q.doctorId) return storage.slots(storage.offeredCourses().filter((c) => c.doctorId === num(q.doctorId)).map((c) => c.id));
    return storage.slots();
  }));
  app.get("/api/schedule/export", async (req, res) => {
    const q = req.query as Record<string, string>;
    const slots = q.studentId ? storage.slots(storage.currentCourseIds(num(q.studentId)))
      : q.doctorId ? storage.slots(storage.offeredCourses().filter((c) => c.doctorId === num(q.doctorId)).map((c) => c.id)) : storage.slots();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const order = [6, 0, 1, 2, 3, 4];
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Weekly Schedule");
    ws.columns = [{ header: "Day", key: "day", width: 13 }, { header: "Time", key: "time", width: 15 }, { header: "Course", key: "code", width: 11 }, { header: "Course name", key: "name", width: 32 }, { header: "Type", key: "kind", width: 10 }, { header: "Room", key: "room", width: 16 }, { header: "Instructor", key: "inst", width: 22 }];
    styleHeader(ws.getRow(1));
    for (const d of order) for (const s of slots.filter((x) => x.day === d)) ws.addRow({ day: days[d], time: `${s.start} – ${s.end}`, code: s.course.code, name: s.course.name, kind: s.kind, room: s.room, inst: s.course.instructor });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="sams-schedule-${SEMESTER.replace(" ", "-")}.xlsx"`);
    await wb.xlsx.write(res); res.end();
  });

  // ---------- calendar & notifications ----------
  app.get("/api/calendar", wrap(() => storage.listEvents()));
  app.post("/api/calendar", wrap((req) => { const e = storage.createEvent(insertEventSchema.parse(req.body)); broadcast("calendar"); return e; }));
  app.get("/api/notifications", wrap((req) => storage.notificationsFor(who(req))));
  app.post("/api/notifications/:id/read", wrap((req) => { storage.markRead(num(req.params.id)); broadcast("notification"); return { ok: true }; }));
  app.post("/api/notifications/read-all", wrap((req) => { storage.markAllRead(who(req)); broadcast("notification"); return { ok: true }; }));

  // ---------- admin ----------
  app.get("/api/admin/overview", wrap(() => storage.adminOverview()));
  app.get("/api/staff", wrap(() => storage.staffList()));
  app.post("/api/staff", wrap((req) => { const s = storage.createStaff(insertStaffSchema.parse(req.body)); broadcast("staff"); return s; }));
  app.get("/api/programs", wrap(() => storage.programsList()));
  app.get("/api/admin/courses", wrap(() => storage.coursesAdmin()));
  app.post("/api/admin/courses", wrap((req) => { const c = storage.createCourse(insertCourseSchema.parse(req.body)); broadcast("course"); return c; }));
  app.get("/api/finance", wrap(() => storage.financeSummary()));

  // ---------- attendance core ----------
  app.get("/api/dashboard", wrap((req) => {
    const d = req.query.doctorId ? storage.offeredCourses().filter((c) => c.doctorId === num(req.query.doctorId)).map((c) => c.id) : undefined;
    return storage.dashboard(d);
  }));
  app.get("/api/courses", wrap(() => storage.offeredCourses()));
  app.get("/api/students", wrap(() => storage.listStudents()));
  app.post("/api/students", (req, res) => {
    const parsed = insertStudentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    const s = storage.createStudent(parsed.data);
    broadcast("student", s);
    res.status(201).json(s);
  });
  app.delete("/api/students/:id", wrap((req) => { storage.deleteStudent(num(req.params.id)); broadcast("student"); return { ok: true }; }));
  app.get("/api/students/:id/history", wrap((req) => storage.log({ studentId: num(req.params.id) })));

  app.get("/api/sessions", wrap((req) => {
    const q = req.query as Record<string, string>;
    const courseIds = q.doctorId ? storage.offeredCourses().filter((c) => c.doctorId === num(q.doctorId)).map((c) => c.id) : undefined;
    return storage.listSessions({ date: q.date, status: q.status, courseId: q.courseId ? num(q.courseId) : undefined, courseIds });
  }));
  app.post("/api/sessions", wrap((req, res) => {
    const courseId = num(req.body?.courseId);
    if (!courseId) throw new Error("courseId required");
    const s = storage.openSession(courseId);
    broadcast("session", s);
    res.status(201); return s;
  }));
  app.post("/api/sessions/:id/close", wrap((req) => { const r = storage.closeSession(num(req.params.id)); broadcast("session", r.session); return r; }));
  app.get("/api/sessions/:id/roster", wrap((req) => {
    const id = num(req.params.id);
    const records = storage.log({ sessionId: id });
    return storage.enrolledStudents(id).map((s) => ({ student: s, record: records.find((r) => r.studentId === s.id) ?? null }));
  }));
  app.post("/api/checkin", (req, res) => {
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid scan payload" });
    const r = storage.checkIn(parsed.data.sessionId, parsed.data.code, parsed.data.method);
    if (r.ok) broadcast("checkin", { id: r.record.id, name: r.record.student.name, status: r.record.status });
    res.status(r.ok ? 201 : 200).json(r);
  });
  app.post("/api/attendance/status", wrap((req) => {
    const p = statusUpdateSchema.parse(req.body);
    const r = storage.setStatus(p.sessionId, p.studentId, p.status, p.note); broadcast("status", r); return r;
  }));
  app.get("/api/log", wrap((req) => {
    const q = req.query as Record<string, string>;
    const courseIds = q.doctorId ? storage.offeredCourses().filter((c) => c.doctorId === num(q.doctorId)).map((c) => c.id) : undefined;
    return storage.log({ from: q.from, to: q.to, status: q.status, courseId: q.courseId ? num(q.courseId) : undefined, courseIds, limit: q.limit ? num(q.limit) : 500 });
  }));

  app.get("/api/reports/preview", wrap((req) => {
    const { from, to, courseId } = parseReportQuery(req.query as Record<string, string>);
    const r = storage.report(from, to, courseId);
    return { ...r, log: [], logCount: r.log.length };
  }));
  app.get("/api/reports/export", async (req, res) => {
    const q = req.query as Record<string, string>;
    const { from, to, courseId } = parseReportQuery(q);
    const r = storage.report(from, to, courseId);
    const wb = await buildWorkbook(r, q.threshold ? Number(q.threshold) : 75);
    storage.logActivity(`Attendance report exported (${from} → ${to})`, "report");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="sams-attendance_${r.course ? r.course.code + "_" : ""}${from}_to_${to}.xlsx"`);
    await wb.xlsx.write(res); res.end();
  });

  return httpServer;
}

function parseReportQuery(q: Record<string, string>) {
  const to = q.to || localDate();
  const from = q.from || localDate(new Date(Date.now() - 30 * 86400000));
  const courseId = q.courseId && q.courseId !== "all" ? Number(q.courseId) : undefined;
  return { from, to, courseId };
}

// ---------- Excel builder ----------
const NAVY = "FF0B2E4A";
const STATUS_FILL: Record<string, string> = { present: "FFE3F4EA", late: "FFFFF3D6", absent: "FFFCE4E4", excused: "FFE8ECF8" };

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    c.border = { bottom: { style: "thin", color: { argb: "FF0F1C4D" } } };
  });
  row.height = 22;
}

function addTable(ws: ExcelJS.Worksheet, headerRowIdx: number, cols: number) {
  ws.views = [{ state: "frozen", ySplit: headerRowIdx }];
  ws.autoFilter = { from: { row: headerRowIdx, column: 1 }, to: { row: headerRowIdx, column: cols } };
}

async function buildWorkbook(r: ReturnType<typeof storage.report>, threshold: number) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SAMS Connect";
  wb.created = new Date();

  // --- Summary ---
  const sum = wb.addWorksheet("Summary", { properties: { tabColor: { argb: NAVY } } });
  sum.columns = [{ width: 30 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }];
  sum.mergeCells("A1:G1");
  sum.getCell("A1").value = "SAMS Connect — Attendance Report";
  sum.getCell("A1").font = { bold: true, size: 18, color: { argb: NAVY } };
  sum.getRow(1).height = 30;
  const meta: [string, string | number][] = [
    ["Period", `${r.from}  to  ${r.to}`],
    ["Course", r.course ? `${r.course.code} — ${r.course.name}` : "All courses"],
    ["Generated", new Date(r.generatedAt).toLocaleString("en-GB")],
    ["At-risk threshold", `${threshold}% attendance`],
  ];
  meta.forEach(([k, v], i) => {
    const row = sum.getRow(3 + i);
    row.getCell(1).value = k; row.getCell(1).font = { bold: true, color: { argb: "FF5A6177" } };
    row.getCell(2).value = v;
  });
  const kStart = 8;
  sum.getRow(kStart).values = ["Key figures", "Value"];
  styleHeader(sum.getRow(kStart));
  const atRisk = r.students.filter((s) => s.total > 0 && s.rate < threshold).length;
  const kpis: [string, number | string][] = [
    ["Class sessions held", r.totals.sessions],
    ["Attendance records", r.totals.records],
    ["Present (on time)", r.totals.present],
    ["Late arrivals", r.totals.late],
    ["Absences", r.totals.absent],
    ["Excused", r.totals.excused],
    ["Overall attendance rate", r.totals.rate / 100],
    ["Students below threshold", atRisk],
  ];
  kpis.forEach(([k, v], i) => {
    const row = sum.getRow(kStart + 1 + i);
    row.getCell(1).value = k; row.getCell(2).value = v;
    if (k === "Overall attendance rate") row.getCell(2).numFmt = "0.0%";
    row.getCell(2).font = { bold: true };
  });
  const cStart = kStart + kpis.length + 3;
  sum.getRow(cStart).values = ["Course", "Sessions", "Present", "Late", "Absent", "Excused", "Attendance %"];
  styleHeader(sum.getRow(cStart));
  r.courseSummary.forEach((c, i) => {
    const row = sum.getRow(cStart + 1 + i);
    row.values = [`${c.course.code} — ${c.course.name}`, c.sessions, c.present, c.late, c.absent, c.excused, c.rate / 100];
    row.getCell(7).numFmt = "0.0%";
  });

  // --- Students ---
  const st = wb.addWorksheet("Students");
  st.columns = [
    { header: "Student ID", key: "code", width: 16 }, { header: "Name", key: "name", width: 26 },
    { header: "Department", key: "dept", width: 24 }, { header: "Year", key: "year", width: 7 },
    { header: "Email", key: "email", width: 34 }, { header: "Courses", key: "courses", width: 30 },
    { header: "Sessions", key: "total", width: 10 }, { header: "Present", key: "present", width: 10 },
    { header: "Late", key: "late", width: 8 }, { header: "Absent", key: "absent", width: 9 },
    { header: "Excused", key: "excused", width: 9 }, { header: "Attendance %", key: "rate", width: 14 },
    { header: "Status", key: "flag", width: 14 },
  ];
  styleHeader(st.getRow(1));
  for (const s of r.students) {
    const row = st.addRow({
      code: s.studentCode, name: s.name, dept: s.department, year: s.year, email: s.email, courses: s.courses,
      total: s.total, present: s.present, late: s.late, absent: s.absent, excused: s.excused, rate: s.rate / 100,
      flag: s.total === 0 ? "No records" : s.rate < threshold ? "At risk" : "Good standing",
    });
    row.getCell("rate").numFmt = "0.0%";
    row.getCell("code").font = { name: "Consolas" };
    if (s.total > 0 && s.rate < threshold) {
      row.getCell("flag").font = { bold: true, color: { argb: "FFB42318" } };
      row.getCell("rate").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4E4" } };
    }
  }
  addTable(st, 1, st.columns.length);

  // --- Sessions ---
  const ss = wb.addWorksheet("Sessions");
  ss.columns = [
    { header: "Date", key: "date", width: 12 }, { header: "Start", key: "start", width: 8 },
    { header: "Course", key: "course", width: 12 }, { header: "Course name", key: "cname", width: 28 },
    { header: "Instructor", key: "inst", width: 20 }, { header: "Room", key: "room", width: 9 },
    { header: "Enrolled", key: "enrolled", width: 10 }, { header: "Present", key: "present", width: 10 },
    { header: "Late", key: "late", width: 8 }, { header: "Absent", key: "absent", width: 9 },
    { header: "Excused", key: "excused", width: 9 }, { header: "Attendance %", key: "rate", width: 14 },
    { header: "Status", key: "status", width: 10 },
  ];
  styleHeader(ss.getRow(1));
  for (const s of r.sessions) {
    const denom = s.present + s.late + s.absent;
    const row = ss.addRow({
      date: s.date, start: new Date(s.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      course: s.course.code, cname: s.course.name, inst: s.course.instructor, room: s.course.room,
      enrolled: s.enrolled, present: s.present, late: s.late, absent: s.absent, excused: s.excused,
      rate: denom ? (s.present + s.late) / denom : null, status: s.status,
    });
    row.getCell("rate").numFmt = "0.0%";
  }
  addTable(ss, 1, ss.columns.length);

  // --- Detailed log ---
  const lg = wb.addWorksheet("Attendance Log");
  lg.columns = [
    { header: "Date", key: "date", width: 12 }, { header: "Course", key: "course", width: 11 },
    { header: "Student ID", key: "code", width: 16 }, { header: "Name", key: "name", width: 26 },
    { header: "Status", key: "status", width: 10 }, { header: "Check-in time", key: "time", width: 14 },
    { header: "Method", key: "method", width: 10 }, { header: "Note", key: "note", width: 28 },
  ];
  styleHeader(lg.getRow(1));
  for (const e of r.log) {
    const row = lg.addRow({
      date: e.session.date, course: e.course.code, code: e.student.studentCode, name: e.student.name,
      status: e.status, time: e.status === "absent" ? "—" : new Date(e.recordedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      method: e.method, note: e.note ?? "",
    });
    row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[e.status] ?? "FFFFFFFF" } };
  }
  addTable(lg, 1, lg.columns.length);

  // --- Absences ---
  const ab = wb.addWorksheet("Absences", { properties: { tabColor: { argb: "FFB42318" } } });
  ab.columns = [
    { header: "Date", key: "date", width: 12 }, { header: "Course", key: "course", width: 11 },
    { header: "Course name", key: "cname", width: 28 }, { header: "Student ID", key: "code", width: 16 },
    { header: "Name", key: "name", width: 26 }, { header: "Email", key: "email", width: 34 },
    { header: "Status", key: "status", width: 10 }, { header: "Note", key: "note", width: 28 },
  ];
  styleHeader(ab.getRow(1));
  for (const e of r.log.filter((x) => x.status === "absent" || x.status === "excused")) {
    ab.addRow({ date: e.session.date, course: e.course.code, cname: e.course.name, code: e.student.studentCode, name: e.student.name, email: e.student.email, status: e.status, note: e.note ?? "" });
  }
  addTable(ab, 1, ab.columns.length);

  return wb;
}
