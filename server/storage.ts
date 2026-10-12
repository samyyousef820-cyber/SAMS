process.env.TZ = process.env.TZ || "Africa/Cairo";

import {
  students, staff, courses, courseSlots, enrollments, classSessions, attendance, fees, payments, events, notifications, activities,
  type Student, type Staff, type Course, type CourseSlot, type ClassSession, type Attendance, type AttendanceStatus,
  type InsertStudent, type SessionView, type LogEntry, type StudentStats, type SlotView, type Enrollment,
  type AuthUser, type Role, type Notification,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, inArray, desc } from "drizzle-orm";

const sqlite = new Database("sams.db");
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, student_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', department TEXT NOT NULL, program TEXT NOT NULL DEFAULT 'Bachelor of Business Administration', year INTEGER NOT NULL, gender TEXT NOT NULL DEFAULT 'Male', dob TEXT NOT NULL DEFAULT '2005-01-01', address TEXT NOT NULL DEFAULT '', national_id TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, title TEXT NOT NULL, department TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', office TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, credits INTEGER NOT NULL DEFAULT 3, department TEXT NOT NULL, doctor_id INTEGER, instructor TEXT NOT NULL, room TEXT NOT NULL, offered INTEGER NOT NULL DEFAULT 1, capacity INTEGER NOT NULL DEFAULT 60, level INTEGER NOT NULL DEFAULT 1, description TEXT NOT NULL DEFAULT '', late_after_min INTEGER NOT NULL DEFAULT 10);
CREATE TABLE IF NOT EXISTS course_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL, day INTEGER NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, room TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'Lecture');
CREATE TABLE IF NOT EXISTS enrollments (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, course_id INTEGER NOT NULL, semester TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'current', score INTEGER, grade TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS enr_uniq ON enrollments(student_id, course_id, semester);
CREATE TABLE IF NOT EXISTS class_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL, slot_id INTEGER, date TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open');
CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, student_id INTEGER NOT NULL, status TEXT NOT NULL, method TEXT NOT NULL, recorded_at TEXT NOT NULL, note TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS att_uniq ON attendance(session_id, student_id);
CREATE TABLE IF NOT EXISTS fees (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL, due_date TEXT NOT NULL, semester TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, date TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL, method TEXT NOT NULL, reference TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Paid');
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', category TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS activities (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL);
`);
export const db = drizzle(sqlite);

// ---------- constants ----------
export const SEMESTER = "Fall 2026";
export const ACADEMIC_YEAR = "2026 - 2027";
export const SEMESTER_START = "2026-09-19";
export const PROGRAM_CREDITS = 132;
export const MAX_CREDITS = 21;
export const DEMO_PASSWORD = "123456";
export const DEPARTMENTS = ["Business Administration", "Accounting", "Marketing", "Management Information Systems", "Economics", "Finance"];
export const PROGRAMS = [
  { name: "Bachelor of Business Administration", department: "Business Administration", students: 0 },
  { name: "Bachelor of Accounting", department: "Accounting", students: 0 },
  { name: "Bachelor of Marketing", department: "Marketing", students: 0 },
  { name: "Bachelor of Management Information Systems", department: "Management Information Systems", students: 0 },
  { name: "Bachelor of Economics", department: "Economics", students: 0 },
  { name: "Bachelor of Finance & Investment", department: "Finance", students: 0 },
  { name: "Professional MBA", department: "Business Administration", students: 0 },
  { name: "Diploma in Cost Accounting", department: "Accounting", students: 0 },
];
const ADMIN = { id: 1, name: "Mona Fathy", subtitle: "Registrar · Administrator" };

export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function atTime(date: string, hhmm: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export function letterFor(score: number): { grade: string; points: number } {
  if (score >= 90) return { grade: "A", points: 4.0 };
  if (score >= 85) return { grade: "A-", points: 3.7 };
  if (score >= 80) return { grade: "B+", points: 3.3 };
  if (score >= 75) return { grade: "B", points: 3.0 };
  if (score >= 70) return { grade: "B-", points: 2.7 };
  if (score >= 65) return { grade: "C+", points: 2.3 };
  if (score >= 60) return { grade: "C", points: 2.0 };
  if (score >= 50) return { grade: "D", points: 1.0 };
  return { grade: "F", points: 0 };
}

function luhn(num: string): number {
  let sum = 0, dbl = true;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (dbl) { n *= 2; if (n > 9) n -= 9; }
    sum += n; dbl = !dbl;
  }
  return (10 - (sum % 10)) % 10;
}
export function isValidCode(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  return luhn(code.slice(0, 7)) === Number(code[7]);
}
function generateStudentCode(level: number): string {
  const intake = new Date().getFullYear() - (level - 1) - (new Date().getMonth() < 8 ? 1 : 0);
  const row = sqlite.prepare("SELECT MAX(id) as m FROM students").get() as { m: number | null };
  let seq = 100 + (row.m ?? 0) * 7 % 900;
  for (let tries = 0; tries < 1000; tries++) {
    const base = `${intake}${String(seq % 1000).padStart(3, "0")}`;
    const code = base + luhn(base);
    if (!db.select().from(students).where(eq(students.studentCode, code)).get()) return code;
    seq++;
  }
  throw new Error("No free codes");
}

function rateOf(p: number, l: number, a: number) {
  const denom = p + l + a;
  return denom === 0 ? 100 : Math.round(((p + l) / denom) * 1000) / 10;
}

export type CheckInResult =
  | { ok: true; record: LogEntry }
  | { ok: false; error: string; code: "not_found" | "invalid" | "not_enrolled" | "duplicate" | "closed"; student?: Student; record?: Attendance };

export class DatabaseStorage {
  // ======================= auth =======================
  personas() {
    const s = db.select().from(students).where(eq(students.id, 1)).get();
    const d = db.select().from(staff).where(eq(staff.id, 1)).get();
    return {
      student: s ? { identifier: s.studentCode, name: s.name } : null,
      doctor: d ? { identifier: d.email, name: d.name } : null,
      admin: { identifier: "admin@sams.edu.eg", name: ADMIN.name },
      password: DEMO_PASSWORD,
    };
  }
  login(role: Role, identifier: string, password: string): AuthUser | null {
    if (password !== DEMO_PASSWORD) return null;
    const id = identifier.trim().toLowerCase();
    if (role === "student") {
      const s = db.select().from(students).all().find((x) => x.studentCode === id || x.email.toLowerCase() === id);
      return s ? { role, id: s.id, name: s.name, subtitle: `Student · ${s.studentCode}`, avatar: s.id === 1 ? "img/student.jpg" : undefined } : null;
    }
    if (role === "doctor") {
      const d = db.select().from(staff).all().find((x) => x.email.toLowerCase() === id);
      return d ? { role, id: d.id, name: d.name, subtitle: `${d.title} · ${d.department}`, avatar: d.id === 1 ? "img/doctor.jpg" : undefined } : null;
    }
    if (id === "admin@sams.edu.eg" || id === "admin") return { role, ...ADMIN };
    return null;
  }

  // ======================= basics =======================
  listCourses(): Course[] { return db.select().from(courses).all(); }
  offeredCourses(): Course[] { return db.select().from(courses).where(eq(courses.offered, 1)).all(); }
  listStaff(): Staff[] { return db.select().from(staff).all(); }
  getStudent(id: number) { return db.select().from(students).where(eq(students.id, id)).get(); }
  getStudentByCode(code: string) { return db.select().from(students).where(eq(students.studentCode, code.trim())).get(); }
  slots(courseIds?: number[]): SlotView[] {
    const cMap = new Map(this.listCourses().map((c) => [c.id, c]));
    let rows = db.select().from(courseSlots).all();
    if (courseIds) rows = rows.filter((r) => courseIds.includes(r.courseId));
    return rows.filter((r) => cMap.get(r.courseId)?.offered).map((r) => ({ ...r, course: cMap.get(r.courseId)! }))
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  }
  currentCourseIds(studentId: number): number[] {
    return db.select().from(enrollments).where(and(eq(enrollments.studentId, studentId), eq(enrollments.status, "current"))).all().map((e) => e.courseId);
  }
  courseStudentIds(courseId: number): number[] {
    return db.select().from(enrollments).where(and(eq(enrollments.courseId, courseId), eq(enrollments.status, "current"))).all().map((e) => e.studentId);
  }
  logActivity(text: string, kind: string) {
    db.insert(activities).values({ text, kind, at: new Date().toISOString() }).run();
  }
  notify(target: string, category: string, title: string, body: string) {
    db.insert(notifications).values({ target, category, title, body, createdAt: new Date().toISOString(), read: 0 }).run();
  }

  // ======================= students =======================
  listStudents(): StudentStats[] {
    const all = db.select().from(students).all();
    const enr = db.select().from(enrollments).where(eq(enrollments.status, "current")).all();
    const counts = sqlite.prepare("SELECT student_id, status, COUNT(*) c FROM attendance GROUP BY student_id, status").all() as { student_id: number; status: string; c: number }[];
    const map = new Map<number, Record<string, number>>();
    for (const r of counts) { const m = map.get(r.student_id) ?? {}; m[r.status] = r.c; map.set(r.student_id, m); }
    return all.map((s) => {
      const m = map.get(s.id) ?? {};
      const p = m.present ?? 0, l = m.late ?? 0, a = m.absent ?? 0, e = m.excused ?? 0;
      return { ...s, courseIds: enr.filter((x) => x.studentId === s.id).map((x) => x.courseId), total: p + l + a + e, present: p, late: l, absent: a, excused: e, rate: rateOf(p, l, a) };
    }).sort((x, y) => x.studentCode.localeCompare(y.studentCode));
  }

  createStudent(input: InsertStudent & { address?: string; dob?: string }, opts: { code?: string; silent?: boolean } = {}): Student {
    const { courseIds, ...rest } = input;
    const studentCode = opts.code ?? generateStudentCode(rest.year);
    const program = PROGRAMS.find((p) => p.department === rest.department)?.name ?? "Bachelor of Business Administration";
    const s = db.insert(students).values({
      name: rest.name, email: rest.email, phone: rest.phone ?? "", department: rest.department, year: rest.year,
      gender: rest.gender ?? "Male", program, studentCode, address: input.address ?? "Giza, Egypt", dob: input.dob ?? "2005-06-01",
      nationalId: "30" + String(Math.floor(1e11 + Math.random() * 9e11)),
    }).returning().get();
    for (const cid of courseIds ?? []) {
      db.insert(enrollments).values({ studentId: s.id, courseId: cid, semester: SEMESTER, status: "current" }).onConflictDoNothing().run();
    }
    for (const f of [["Tuition Fee (Fall 2026)", 10500, "2026-09-15"], ["Registration Fee", 2500, "2026-08-10"], ["Lab & Library Fee", 1000, "2026-07-20"], ["Student Activity Fee", 500, "2026-07-20"]] as const) {
      db.insert(fees).values({ studentId: s.id, description: f[0], amount: f[1], dueDate: f[2], semester: SEMESTER }).run();
    }
    if (!opts.silent) {
      this.notify(`student:${s.id}`, "system", "Welcome to SAMS Connect", "Your student account is ready. Your ID card works at every check-in station.");
      this.logActivity(`New student registered: ${s.name} (${s.studentCode})`, "student");
    }
    return s;
  }

  deleteStudent(id: number) {
    const s = this.getStudent(id);
    db.delete(enrollments).where(eq(enrollments.studentId, id)).run();
    db.delete(attendance).where(eq(attendance.studentId, id)).run();
    db.delete(fees).where(eq(fees.studentId, id)).run();
    db.delete(payments).where(eq(payments.studentId, id)).run();
    db.delete(students).where(eq(students.id, id)).run();
    if (s) this.logActivity(`Student record removed: ${s.name}`, "student");
  }

  updateProfile(id: number, patch: { email?: string; phone?: string; address?: string }) {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length) db.update(students).set(clean).where(eq(students.id, id)).run();
    return this.getStudent(id);
  }

  // ---------- grades ----------
  private gpaOf(rows: { credits: number; score: number | null }[]) {
    let pts = 0, cr = 0;
    for (const r of rows) if (r.score != null) { pts += letterFor(r.score).points * r.credits; cr += r.credits; }
    return cr ? Math.round((pts / cr) * 100) / 100 : 0;
  }
  studentGrades(id: number) {
    const cMap = new Map(this.listCourses().map((c) => [c.id, c]));
    const enr = db.select().from(enrollments).where(eq(enrollments.studentId, id)).all();
    const rows = enr.map((e) => {
      const c = cMap.get(e.courseId)!;
      const lg = e.score != null ? letterFor(e.score) : null;
      return { enrollmentId: e.id, semester: e.semester, status: e.status, course: c, credits: c.credits, score: e.score, grade: lg?.grade ?? null, points: lg?.points ?? null,
        result: e.score == null ? "In progress" : e.score >= 50 ? "Passed" : "Failed" };
    });
    const order = ["Fall 2026", "Spring 2026", "Fall 2025"];
    const semesters = order.filter((s) => rows.some((r) => r.semester === s)).map((s) => {
      const rs = rows.filter((r) => r.semester === s);
      return { semester: s, rows: rs, gpa: this.gpaOf(rs), credits: rs.reduce((t, r) => t + r.credits, 0) };
    });
    const completed = rows.filter((r) => r.status === "completed");
    const earned = completed.filter((r) => (r.score ?? 0) >= 50).reduce((t, r) => t + r.credits, 0);
    return {
      semesters, currentGpa: semesters.find((s) => s.semester === SEMESTER)?.gpa ?? 0,
      cumulativeGpa: this.gpaOf(rows.filter((r) => r.score != null)), earnedCredits: earned, remainingCredits: PROGRAM_CREDITS - earned,
    };
  }

  // ---------- fees ----------
  studentFees(id: number) {
    const f = db.select().from(fees).where(eq(fees.studentId, id)).all();
    const p = db.select().from(payments).where(eq(payments.studentId, id)).orderBy(desc(payments.date)).all();
    const total = f.reduce((t, x) => t + x.amount, 0);
    const paid = p.filter((x) => x.status === "Paid").reduce((t, x) => t + x.amount, 0);
    return { items: f, payments: p, total, paid, remaining: Math.max(0, total - paid), nextDue: total - paid > 0 ? "2026-10-20" : null };
  }
  pay(id: number, amount: number, method: string) {
    const f = this.studentFees(id);
    if (f.remaining <= 0) throw new Error("Nothing is due on this account");
    const amt = Math.min(amount, f.remaining);
    const ref = "SAMS-" + Date.now().toString(36).toUpperCase().slice(-6) + "-" + Math.floor(Math.random() * 90 + 10);
    const p = db.insert(payments).values({ studentId: id, date: localDate(), description: amt >= f.remaining ? "Tuition Fee — final installment" : "Tuition Fee — partial payment", amount: amt, method, reference: ref, status: "Paid" }).returning().get();
    const s = this.getStudent(id)!;
    this.notify(`student:${id}`, "financial", "Payment received", `We received ${amt.toLocaleString()} EGP via ${method}. Reference ${ref}.`);
    this.logActivity(`Payment of ${amt.toLocaleString()} EGP received from ${s.name}`, "payment");
    return p;
  }

  // ---------- attendance for a student ----------
  studentAttendance(id: number) {
    const log = this.log({ studentId: id });
    const cnt = (s: string) => log.filter((r) => r.status === s).length;
    const present = cnt("present"), late = cnt("late"), absent = cnt("absent"), excused = cnt("excused");
    const byCourse = this.currentCourseIds(id).map((cid) => {
      const rs = log.filter((r) => r.course.id === cid);
      const p = rs.filter((r) => r.status === "present").length, l = rs.filter((r) => r.status === "late").length, a = rs.filter((r) => r.status === "absent").length;
      return { course: rs[0]?.course ?? this.listCourses().find((c) => c.id === cid)!, present: p, late: l, absent: a, excused: rs.length - p - l - a, total: rs.length, rate: rateOf(p, l, a) };
    });
    return { present, late, absent, excused, total: log.length, rate: rateOf(present, late, absent), records: log.slice(0, 200), byCourse };
  }

  // ---------- courses for a student ----------
  studentCourses(id: number) {
    const cMap = new Map(this.listCourses().map((c) => [c.id, c]));
    const enr = db.select().from(enrollments).where(eq(enrollments.studentId, id)).all();
    const att = this.studentAttendance(id).byCourse;
    const held = sqlite.prepare("SELECT course_id, COUNT(*) c FROM class_sessions WHERE status='closed' GROUP BY course_id").all() as { course_id: number; c: number }[];
    const slotCount = sqlite.prepare("SELECT course_id, COUNT(*) c FROM course_slots GROUP BY course_id").all() as { course_id: number; c: number }[];
    const slotsAll = this.slots();
    return enr.map((e) => {
      const c = cMap.get(e.courseId)!;
      const total = (slotCount.find((x) => x.course_id === c.id)?.c ?? 1) * 14;
      const progress = e.status === "completed" ? 100 : Math.min(100, Math.round(((held.find((h) => h.course_id === c.id)?.c ?? 0) / total) * 100));
      return { enrollmentId: e.id, course: c, semester: e.semester, status: e.status, score: e.score, grade: e.score != null ? letterFor(e.score).grade : null, progress,
        attendanceRate: att.find((a) => a.course.id === c.id)?.rate ?? null, slots: slotsAll.filter((s) => s.courseId === c.id) };
    });
  }

  studentOverview(id: number) {
    const s = this.getStudent(id);
    if (!s) return null;
    const g = this.studentGrades(id);
    const cur = this.currentCourseIds(id);
    const credits = this.listCourses().filter((c) => cur.includes(c.id)).reduce((t, c) => t + c.credits, 0);
    const att = this.studentAttendance(id);
    const f = this.studentFees(id);
    const slots = this.slots(cur);
    const now = new Date();
    // next lecture: search next 7 days
    let next: (SlotView & { date: string }) | null = null;
    for (let i = 0; i < 8 && !next; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i);
      const date = localDate(d);
      const todays = slots.filter((x) => x.day === d.getDay()).filter((x) => i > 0 || atTime(date, x.end) > now);
      if (todays.length) next = { ...todays[0], date };
    }
    const unread = this.notificationsFor({ role: "student", id }).filter((n) => !n.read).length;
    return {
      student: s, semester: SEMESTER, academicYear: ACADEMIC_YEAR, standing: g.cumulativeGpa >= 2 ? "Good Standing" : "Academic Probation",
      currentGpa: g.currentGpa, cumulativeGpa: g.cumulativeGpa, registeredCourses: cur.length, registeredCredits: credits,
      earnedCredits: g.earnedCredits, remainingCredits: g.remainingCredits, attendanceRate: att.rate, outstanding: f.remaining,
      nextLecture: next, weekSlots: slots, unread,
    };
  }

  // ---------- registration ----------
  registration(id: number) {
    const cur = this.currentCourseIds(id);
    const mine = this.slots(cur);
    const counts = sqlite.prepare("SELECT course_id, COUNT(*) c FROM enrollments WHERE status='current' GROUP BY course_id").all() as { course_id: number; c: number }[];
    const completed = db.select().from(enrollments).where(and(eq(enrollments.studentId, id), eq(enrollments.status, "completed"))).all().map((e) => e.courseId);
    const credits = this.listCourses().filter((c) => cur.includes(c.id)).reduce((t, c) => t + c.credits, 0);
    const all = this.slots();
    return {
      credits, maxCredits: MAX_CREDITS,
      courses: this.offeredCourses().map((c) => {
        const cs = all.filter((s) => s.courseId === c.id);
        const conflict = cur.includes(c.id) ? null : cs.map((s) => mine.find((m) => m.day === s.day && toMin(m.start) < toMin(s.end) && toMin(s.start) < toMin(m.end))).find(Boolean);
        return { course: c, slots: cs, enrolled: counts.find((x) => x.course_id === c.id)?.c ?? 0, registered: cur.includes(c.id), completed: completed.includes(c.id),
          conflictWith: conflict ? conflict.course.code : null };
      }),
    };
  }
  register(id: number, courseId: number) {
    const r = this.registration(id);
    const item = r.courses.find((c) => c.course.id === courseId);
    if (!item) throw new Error("Course is not offered this semester");
    if (item.registered) throw new Error("You are already registered in this course");
    if (item.completed) throw new Error("You have already completed this course");
    if (item.enrolled >= item.course.capacity) throw new Error("This course is full");
    if (item.conflictWith) throw new Error(`Schedule conflict with ${item.conflictWith}`);
    if (r.credits + item.course.credits > MAX_CREDITS) throw new Error(`Credit limit reached (${MAX_CREDITS} credit hours per semester)`);
    db.insert(enrollments).values({ studentId: id, courseId, semester: SEMESTER, status: "current" }).run();
    const s = this.getStudent(id)!;
    this.notify(`student:${id}`, "academic", "Course registered", `You are now registered in ${item.course.code} — ${item.course.name}.`);
    this.logActivity(`${s.name} registered in ${item.course.code}`, "registration");
    return { ok: true };
  }
  drop(id: number, courseId: number) {
    db.delete(enrollments).where(and(eq(enrollments.studentId, id), eq(enrollments.courseId, courseId), eq(enrollments.status, "current"))).run();
    const c = this.listCourses().find((x) => x.id === courseId);
    const s = this.getStudent(id)!;
    this.logActivity(`${s.name} dropped ${c?.code}`, "registration");
    return { ok: true };
  }

  // ======================= doctor =======================
  doctorCourses(staffId: number) {
    const cs = this.offeredCourses().filter((c) => c.doctorId === staffId);
    const all = this.slots();
    return cs.map((c) => {
      const ids = this.courseStudentIds(c.id);
      const enr = db.select().from(enrollments).where(and(eq(enrollments.courseId, c.id), eq(enrollments.status, "current"))).all();
      const rows = sqlite.prepare("SELECT a.status, COUNT(*) c FROM attendance a JOIN class_sessions s ON s.id=a.session_id WHERE s.course_id=? GROUP BY a.status").all(c.id) as { status: string; c: number }[];
      const g = (k: string) => rows.find((r) => r.status === k)?.c ?? 0;
      return { course: c, students: ids.length, pendingGrades: enr.filter((e) => e.score == null).length, slots: all.filter((s) => s.courseId === c.id), attendanceRate: rateOf(g("present"), g("late"), g("absent")) };
    });
  }
  doctorOverview(staffId: number) {
    const d = db.select().from(staff).where(eq(staff.id, staffId)).get();
    if (!d) return null;
    const cs = this.doctorCourses(staffId);
    const today = new Date().getDay();
    const todays = cs.flatMap((c) => c.slots.filter((s) => s.day === today)).sort((a, b) => a.start.localeCompare(b.start));
    const open = this.listSessions({ status: "open" }).filter((s) => s.course.doctorId === staffId);
    return {
      doctor: d, courses: cs, totalStudents: new Set(cs.flatMap((c) => this.courseStudentIds(c.course.id))).size,
      pendingGrades: cs.reduce((t, c) => t + c.pendingGrades, 0), todays, open,
      avgAttendance: cs.length ? Math.round((cs.reduce((t, c) => t + c.attendanceRate, 0) / cs.length) * 10) / 10 : 0,
    };
  }
  gradebook(courseId: number) {
    const c = this.listCourses().find((x) => x.id === courseId);
    const enr = db.select().from(enrollments).where(and(eq(enrollments.courseId, courseId), eq(enrollments.status, "current"))).all();
    const sMap = new Map(db.select().from(students).all().map((s) => [s.id, s]));
    const att = sqlite.prepare("SELECT a.student_id sid, a.status st, COUNT(*) c FROM attendance a JOIN class_sessions s ON s.id=a.session_id WHERE s.course_id=? GROUP BY a.student_id, a.status").all(courseId) as { sid: number; st: string; c: number }[];
    return {
      course: c,
      rows: enr.filter((e) => sMap.has(e.studentId)).map((e) => {
        const a = (k: string) => att.find((x) => x.sid === e.studentId && x.st === k)?.c ?? 0;
        return { enrollmentId: e.id, student: sMap.get(e.studentId)!, score: e.score, grade: e.score != null ? letterFor(e.score).grade : null, attendanceRate: rateOf(a("present"), a("late"), a("absent")), absences: a("absent") };
      }).sort((x, y) => x.student.name.localeCompare(y.student.name)),
    };
  }
  setScore(enrollmentId: number, score: number | null) {
    const e = db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).get();
    if (!e) throw new Error("Enrollment not found");
    const grade = score == null ? null : letterFor(score).grade;
    db.update(enrollments).set({ score, grade }).where(eq(enrollments.id, enrollmentId)).run();
    if (score != null && e.score == null) {
      const c = this.listCourses().find((x) => x.id === e.courseId)!;
      this.notify(`student:${e.studentId}`, "academic", "New grade posted", `Your grade for ${c.code} — ${c.name} is now available.`);
    }
    return { ok: true, grade };
  }

  // ======================= admin =======================
  adminOverview() {
    const all = this.listStudents();
    const fin = this.financeSummary();
    const acts = db.select().from(activities).orderBy(desc(activities.at)).limit(10).all();
    const dash = this.dashboard();
    return {
      totals: { students: all.length, staff: this.listStaff().length, departments: DEPARTMENTS.length, programs: PROGRAMS.length, courses: this.offeredCourses().length },
      attendanceRate: dash.overallRate, atRisk: dash.atRiskCount, todayCounts: dash.todayCounts, trend: dash.trend,
      finance: { collected: fin.collected, outstanding: fin.outstanding },
      activities: acts,
      byDepartment: DEPARTMENTS.map((d) => ({ department: d, students: all.filter((s) => s.department === d).length })),
    };
  }
  createStaff(input: { name: string; title: string; department: string; email: string; phone?: string; office?: string }) {
    const s = db.insert(staff).values({ ...input, phone: input.phone ?? "", office: input.office ?? "" }).returning().get();
    this.logActivity(`New staff member added: ${s.name}`, "staff");
    return s;
  }
  staffList() {
    const cs = this.offeredCourses();
    return this.listStaff().map((s) => ({ ...s, courses: cs.filter((c) => c.doctorId === s.id).map((c) => c.code) }));
  }
  programsList() {
    const all = db.select().from(students).all();
    return PROGRAMS.map((p) => ({ ...p, students: all.filter((s) => s.program === p.name).length, courses: this.offeredCourses().filter((c) => c.department === p.department).length }));
  }
  coursesAdmin() {
    const all = this.slots();
    const counts = sqlite.prepare("SELECT course_id, COUNT(*) c FROM enrollments WHERE status='current' GROUP BY course_id").all() as { course_id: number; c: number }[];
    return this.offeredCourses().map((c) => ({ course: c, slots: all.filter((s) => s.courseId === c.id), enrolled: counts.find((x) => x.course_id === c.id)?.c ?? 0 }));
  }
  createCourse(input: { code: string; name: string; credits: number; department: string; doctorId: number; capacity: number; level: number; day: number; start: string; end: string; room: string }) {
    const d = db.select().from(staff).where(eq(staff.id, input.doctorId)).get();
    if (!d) throw new Error("Choose a valid instructor");
    if (db.select().from(courses).where(eq(courses.code, input.code.toUpperCase())).get()) throw new Error("Course code already exists");
    const c = db.insert(courses).values({ code: input.code.toUpperCase(), name: input.name, credits: input.credits, department: input.department, doctorId: d.id, instructor: d.name, room: input.room, capacity: input.capacity, level: input.level, offered: 1 }).returning().get();
    db.insert(courseSlots).values({ courseId: c.id, day: input.day, start: input.start, end: input.end, room: input.room, kind: "Lecture" }).run();
    this.logActivity(`New course published: ${c.code} — ${c.name}`, "course");
    this.notify("students", "academic", "New course available", `${c.code} — ${c.name} is now open for registration.`);
    return c;
  }
  financeSummary() {
    const totalFees = (sqlite.prepare("SELECT COALESCE(SUM(amount),0) s FROM fees").get() as { s: number }).s;
    const collected = (sqlite.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE status='Paid'").get() as { s: number }).s;
    const sMap = new Map(db.select().from(students).all().map((s) => [s.id, s]));
    const recent = db.select().from(payments).orderBy(desc(payments.date), desc(payments.id)).limit(40).all().filter((p) => sMap.has(p.studentId)).map((p) => ({ ...p, student: sMap.get(p.studentId)! }));
    const balances = Array.from(sMap.values()).map((s) => ({ student: s, ...this.studentFees(s.id) })).filter((b) => b.remaining > 0).sort((a, b) => b.remaining - a.remaining)
      .map(({ student, total, paid, remaining }) => ({ student, total, paid, remaining }));
    const methods = sqlite.prepare("SELECT method, SUM(amount) s FROM payments GROUP BY method").all() as { method: string; s: number }[];
    return { totalFees, collected, outstanding: totalFees - collected, recent, balances, methods };
  }

  // ======================= calendar / notifications / search =======================
  listEvents() { return db.select().from(events).all().sort((a, b) => a.date.localeCompare(b.date)); }
  createEvent(e: { title: string; date: string; time?: string; location?: string; category: string }) {
    const ev = db.insert(events).values({ title: e.title, date: e.date, time: e.time ?? "", location: e.location ?? "", category: e.category }).returning().get();
    this.notify("all", "academic", "Academic calendar updated", `${ev.title} on ${ev.date}.`);
    this.logActivity(`Calendar event added: ${ev.title}`, "calendar");
    return ev;
  }
  private targetsFor(u: { role: Role; id: number }) {
    return u.role === "student" ? ["all", "students", `student:${u.id}`] : u.role === "doctor" ? ["all", "doctors", `doctor:${u.id}`] : ["all", "admin"];
  }
  notificationsFor(u: { role: Role; id: number }): Notification[] {
    const t = this.targetsFor(u);
    return db.select().from(notifications).where(inArray(notifications.target, t)).orderBy(desc(notifications.createdAt)).all();
  }
  markRead(id: number) { db.update(notifications).set({ read: 1 }).where(eq(notifications.id, id)).run(); }
  markAllRead(u: { role: Role; id: number }) { db.update(notifications).set({ read: 1 }).where(inArray(notifications.target, this.targetsFor(u))).run(); }

  search(q: string, role: Role, id: number) {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return { courses: [], students: [], staff: [] };
    const cs = this.offeredCourses().filter((c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s)).slice(0, 6);
    let st: Student[] = [];
    if (role !== "student") {
      let pool = db.select().from(students).all();
      if (role === "doctor") { const ids = new Set(this.doctorCourses(id).flatMap((c) => this.courseStudentIds(c.course.id))); pool = pool.filter((p) => ids.has(p.id)); }
      st = pool.filter((p) => p.name.toLowerCase().includes(s) || p.studentCode.includes(s)).slice(0, 6);
    }
    const sf = this.listStaff().filter((p) => p.name.toLowerCase().includes(s)).slice(0, 4);
    return { courses: cs, students: st, staff: sf };
  }

  // ======================= sessions & attendance =======================
  private sessionView(s: ClassSession, courseMap: Map<number, Course>): SessionView {
    const enrolled = this.courseStudentIds(s.courseId).length;
    const rows = sqlite.prepare("SELECT status, COUNT(*) c FROM attendance WHERE session_id=? GROUP BY status").all(s.id) as { status: string; c: number }[];
    const g = (k: string) => rows.find((r) => r.status === k)?.c ?? 0;
    return { ...s, course: courseMap.get(s.courseId)!, enrolled, present: g("present"), late: g("late"), absent: g("absent"), excused: g("excused") };
  }
  listSessions(opts: { date?: string; status?: string; from?: string; to?: string; courseId?: number; courseIds?: number[] } = {}): SessionView[] {
    const courseMap = new Map(this.listCourses().map((c) => [c.id, c]));
    let rows = db.select().from(classSessions).orderBy(desc(classSessions.startsAt)).all();
    if (opts.date) rows = rows.filter((r) => r.date === opts.date);
    if (opts.status) rows = rows.filter((r) => r.status === opts.status);
    if (opts.from) rows = rows.filter((r) => r.date >= opts.from!);
    if (opts.to) rows = rows.filter((r) => r.date <= opts.to!);
    if (opts.courseId) rows = rows.filter((r) => r.courseId === opts.courseId);
    if (opts.courseIds) rows = rows.filter((r) => opts.courseIds!.includes(r.courseId));
    return rows.map((r) => this.sessionView(r, courseMap));
  }
  getSession(id: number) { return db.select().from(classSessions).where(eq(classSessions.id, id)).get(); }

  openSession(courseId: number, slotId: number | null = null, startsAt?: Date, endsAt?: Date): ClassSession {
    const existing = db.select().from(classSessions).where(and(eq(classSessions.courseId, courseId), eq(classSessions.status, "open"))).get();
    if (existing) return existing;
    const now = startsAt ?? new Date();
    const end = endsAt ?? new Date(now.getTime() + 90 * 60000);
    return db.insert(classSessions).values({ courseId, slotId, date: localDate(now), startsAt: now.toISOString(), endsAt: end.toISOString(), status: "open" }).returning().get();
  }
  closeSession(id: number): { session: ClassSession; markedAbsent: number } {
    const s = this.getSession(id);
    if (!s) throw new Error("Session not found");
    const ids = this.courseStudentIds(s.courseId);
    const recorded = new Set(db.select().from(attendance).where(eq(attendance.sessionId, id)).all().map((a) => a.studentId));
    const now = new Date().toISOString();
    let n = 0;
    for (const sid of ids) if (!recorded.has(sid)) {
      db.insert(attendance).values({ sessionId: id, studentId: sid, status: "absent", method: "auto", recordedAt: now }).run(); n++;
      this.notify(`student:${sid}`, "academic", "Absence recorded", `You were marked absent from ${this.listCourses().find((c) => c.id === s.courseId)?.code} on ${s.date}.`);
    }
    const session = db.update(classSessions).set({ status: "closed" }).where(eq(classSessions.id, id)).returning().get();
    return { session, markedAbsent: n };
  }
  /** Runs every 30s: opens sessions at slot start and closes them at slot end. Returns true if anything changed. */
  tick(): boolean {
    const now = new Date();
    const date = localDate(now);
    let changed = false;
    for (const o of db.select().from(classSessions).where(eq(classSessions.status, "open")).all()) {
      if (new Date(o.endsAt) <= now) { this.closeSession(o.id); changed = true; }
    }
    for (const sl of this.slots().filter((x) => x.day === now.getDay())) {
      const st = atTime(date, sl.start), en = atTime(date, sl.end);
      if (now >= st && now < en) {
        const has = db.select().from(classSessions).where(and(eq(classSessions.slotId, sl.id), eq(classSessions.date, date))).get();
        if (!has) { this.openSession(sl.courseId, sl.id, st, en); changed = true; }
      }
    }
    return changed;
  }
  pending(sessionId: number): Student[] {
    const s = this.getSession(sessionId);
    if (!s) return [];
    const recorded = new Set(db.select().from(attendance).where(eq(attendance.sessionId, sessionId)).all().map((a) => a.studentId));
    const left = this.courseStudentIds(s.courseId).filter((i) => !recorded.has(i));
    return left.length ? db.select().from(students).where(inArray(students.id, left)).all() : [];
  }
  enrolledStudents(sessionId: number): Student[] {
    const s = this.getSession(sessionId);
    if (!s) return [];
    const ids = this.courseStudentIds(s.courseId);
    return ids.length ? db.select().from(students).where(inArray(students.id, ids)).all().sort((a, b) => a.name.localeCompare(b.name)) : [];
  }

  checkIn(sessionId: number, rawCode: string, method: string): CheckInResult {
    const code = rawCode.trim();
    const session = this.getSession(sessionId);
    if (!session) return { ok: false, code: "closed", error: "Session not found" };
    if (session.status !== "open") return { ok: false, code: "closed", error: "This session is closed" };
    if (!isValidCode(code)) return { ok: false, code: "invalid", error: `"${code}" is not a valid student ID (check digit failed)` };
    const student = this.getStudentByCode(code);
    if (!student) return { ok: false, code: "not_found", error: `No student registered with ID ${code}` };
    if (!this.courseStudentIds(session.courseId).includes(student.id)) return { ok: false, code: "not_enrolled", error: `${student.name} is not enrolled in this course`, student };
    const dup = db.select().from(attendance).where(and(eq(attendance.sessionId, sessionId), eq(attendance.studentId, student.id))).get();
    if (dup) return { ok: false, code: "duplicate", error: `${student.name} already checked in`, student, record: dup };
    const course = this.listCourses().find((c) => c.id === session.courseId)!;
    const now = new Date();
    const status: AttendanceStatus = now.getTime() > new Date(session.startsAt).getTime() + course.lateAfterMin * 60000 ? "late" : "present";
    const rec = db.insert(attendance).values({ sessionId, studentId: student.id, status, method, recordedAt: now.toISOString() }).returning().get();
    return { ok: true, record: { ...rec, student, course, session } };
  }
  setStatus(sessionId: number, studentId: number, status: AttendanceStatus, note?: string): Attendance {
    const ex = db.select().from(attendance).where(and(eq(attendance.sessionId, sessionId), eq(attendance.studentId, studentId))).get();
    if (ex) return db.update(attendance).set({ status, note: note ?? ex.note, method: ex.method === "auto" ? "manual" : ex.method }).where(eq(attendance.id, ex.id)).returning().get();
    return db.insert(attendance).values({ sessionId, studentId, status, method: "manual", recordedAt: new Date().toISOString(), note }).returning().get();
  }

  log(opts: { from?: string; to?: string; courseId?: number; courseIds?: number[]; status?: string; sessionId?: number; studentId?: number; limit?: number } = {}): LogEntry[] {
    const where: string[] = []; const params: any[] = [];
    if (opts.from) { where.push("cs.date >= ?"); params.push(opts.from); }
    if (opts.to) { where.push("cs.date <= ?"); params.push(opts.to); }
    if (opts.courseId) { where.push("cs.course_id = ?"); params.push(opts.courseId); }
    if (opts.courseIds) { where.push(`cs.course_id IN (${opts.courseIds.map(() => "?").join(",") || "NULL"})`); params.push(...opts.courseIds); }
    if (opts.sessionId) { where.push("a.session_id = ?"); params.push(opts.sessionId); }
    if (opts.studentId) { where.push("a.student_id = ?"); params.push(opts.studentId); }
    if (opts.status) { const sts = opts.status.split(","); where.push(`a.status IN (${sts.map(() => "?").join(",")})`); params.push(...sts); }
    const sql = `SELECT a.id FROM attendance a JOIN class_sessions cs ON cs.id=a.session_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY a.recorded_at DESC ${opts.limit ? "LIMIT " + Number(opts.limit) : ""}`;
    const ids = (sqlite.prepare(sql).all(...params) as { id: number }[]).map((r) => r.id);
    if (!ids.length) return [];
    const recs: Attendance[] = [];
    for (let i = 0; i < ids.length; i += 500) recs.push(...db.select().from(attendance).where(inArray(attendance.id, ids.slice(i, i + 500))).all());
    const sMap = new Map(db.select().from(students).all().map((s) => [s.id, s]));
    const cMap = new Map(this.listCourses().map((c) => [c.id, c]));
    const sesMap = new Map(db.select().from(classSessions).all().map((s) => [s.id, s]));
    const order = new Map(ids.map((id, i) => [id, i]));
    return recs.filter((r) => sMap.has(r.studentId)).map((r) => { const ses = sesMap.get(r.sessionId)!; return { ...r, student: sMap.get(r.studentId)!, session: ses, course: cMap.get(ses.courseId)! }; })
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }

  dashboard(courseIds?: number[]) {
    const today = localDate();
    const todaySessions = this.listSessions({ date: today, courseIds });
    const sum = (k: "present" | "late" | "absent" | "excused" | "enrolled") => todaySessions.reduce((t, s) => t + s[k], 0);
    const open = todaySessions.filter((s) => s.status === "open");
    const awaiting = open.reduce((t, s) => t + (s.enrolled - s.present - s.late - s.absent - s.excused), 0);
    const filter = courseIds ? `AND cs.course_id IN (${courseIds.join(",") || "NULL"})` : "";
    const trendRows = sqlite.prepare(`SELECT cs.date d, a.status st, COUNT(*) c FROM attendance a JOIN class_sessions cs ON cs.id=a.session_id WHERE cs.date >= ? ${filter} GROUP BY cs.date, a.status ORDER BY cs.date`).all(localDate(new Date(Date.now() - 24 * 86400000))) as { d: string; st: string; c: number }[];
    const tm = new Map<string, any>();
    for (const r of trendRows) { const t = tm.get(r.d) ?? { date: r.d, present: 0, late: 0, absent: 0, excused: 0 }; t[r.st] = r.c; tm.set(r.d, t); }
    const trend = Array.from(tm.values()).slice(-14).map((t) => ({ ...t, rate: rateOf(t.present, t.late, t.absent) }));
    let all = this.listStudents();
    if (courseIds) all = all.filter((s) => s.courseIds.some((c) => courseIds.includes(c)));
    const atRisk = all.filter((s) => s.total >= 3 && s.rate < 75).sort((a, b) => a.rate - b.rate);
    const o = all.reduce((t, s) => ({ p: t.p + s.present, l: t.l + s.late, a: t.a + s.absent }), { p: 0, l: 0, a: 0 });
    return {
      today, totals: { students: all.length, courses: courseIds?.length ?? this.offeredCourses().length, sessionsToday: todaySessions.length, openSessions: open.length },
      todayCounts: { present: sum("present"), late: sum("late"), absent: sum("absent"), excused: sum("excused"), awaiting, expected: sum("enrolled") },
      overallRate: rateOf(o.p, o.l, o.a), atRiskCount: atRisk.length, trend, atRisk: atRisk.slice(0, 8), recent: this.log({ limit: 12, courseIds }),
    };
  }

  report(from: string, to: string, courseId?: number) {
    const sessions = this.listSessions({ from, to, courseId }).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const log = this.log({ from, to, courseId }).sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt) || a.student.name.localeCompare(b.student.name));
    const course = courseId ? this.listCourses().find((c) => c.id === courseId) ?? null : null;
    const courseMap = new Map(this.listCourses().map((c) => [c.id, c]));
    const enr = db.select().from(enrollments).where(eq(enrollments.status, "current")).all();
    const per = new Map<number, { p: number; l: number; a: number; e: number }>();
    for (const r of log) {
      const m = per.get(r.studentId) ?? { p: 0, l: 0, a: 0, e: 0 };
      if (r.status === "present") m.p++; else if (r.status === "late") m.l++; else if (r.status === "absent") m.a++; else m.e++;
      per.set(r.studentId, m);
    }
    const relevant = db.select().from(students).all().filter((s) => courseId ? enr.some((e) => e.studentId === s.id && e.courseId === courseId) : true);
    const studentRows = relevant.map((s) => {
      const m = per.get(s.id) ?? { p: 0, l: 0, a: 0, e: 0 };
      const cids = enr.filter((e) => e.studentId === s.id).map((e) => e.courseId);
      return { ...s, courseIds: cids, courses: cids.map((c) => courseMap.get(c)?.code).filter(Boolean).join(", "), total: m.p + m.l + m.a + m.e, present: m.p, late: m.l, absent: m.a, excused: m.e, rate: rateOf(m.p, m.l, m.a) };
    }).sort((a, b) => a.studentCode.localeCompare(b.studentCode));
    const t = log.reduce((acc, r) => { (acc as any)[r.status]++; return acc; }, { present: 0, late: 0, absent: 0, excused: 0 });
    const courseSummary = (courseId ? [course!] : this.offeredCourses()).map((c) => {
      const ss = sessions.filter((s) => s.courseId === c.id);
      const p = ss.reduce((x, s) => x + s.present, 0), l = ss.reduce((x, s) => x + s.late, 0), a = ss.reduce((x, s) => x + s.absent, 0), e = ss.reduce((x, s) => x + s.excused, 0);
      return { course: c, sessions: ss.length, present: p, late: l, absent: a, excused: e, rate: rateOf(p, l, a) };
    });
    return { from, to, course, generatedAt: new Date().toISOString(), totals: { sessions: sessions.length, records: log.length, ...t, rate: rateOf(t.present, t.late, t.absent) }, students: studentRows, sessions, log, courseSummary };
  }

  // ======================= seed =======================
  seedIfEmpty() {
    if ((sqlite.prepare("SELECT COUNT(*) c FROM students").get() as { c: number }).c > 0) return;
    let seedRand = 20261011;
    const rand = () => { seedRand = (seedRand * 1103515245 + 12345) & 0x7fffffff; return seedRand / 0x7fffffff; };
    const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

    const staffSeed = [
      ["Dr. Ahmed Salah", "Professor", "Business Administration", "ahmed.salah@sams.edu.eg", "+20 100 555 0101", "B-214"],
      ["Prof. Hala Ramadan", "Professor", "Accounting", "hala.ramadan@sams.edu.eg", "+20 100 555 0102", "A-108"],
      ["Dr. Laila Hassan", "Associate Professor", "Economics", "laila.hassan@sams.edu.eg", "+20 100 555 0103", "C-202"],
      ["Dr. Tarek Nabil", "Associate Professor", "Economics", "tarek.nabil@sams.edu.eg", "+20 100 555 0104", "C-210"],
      ["Dr. Mona Saleh", "Professor", "Finance", "mona.saleh@sams.edu.eg", "+20 100 555 0105", "D-118"],
      ["Dr. Rania Adel", "Lecturer", "Marketing", "rania.adel@sams.edu.eg", "+20 100 555 0106", "B-305"],
      ["Dr. Karim Fawzy", "Lecturer", "Management Information Systems", "karim.fawzy@sams.edu.eg", "+20 100 555 0107", "Lab Wing 2"],
      ["Dr. Sherif Ali", "Associate Professor", "Business Administration", "sherif.ali@sams.edu.eg", "+20 100 555 0108", "B-220"],
    ];
    const st = staffSeed.map(([name, title, department, email, phone, office]) => db.insert(staff).values({ name, title, department, email, phone, office }).returning().get());
    const S = (i: number) => st[i];

    type CS = [string, string, number, string, number, number, [number, string, string, string][]];
    const B = ["08:00", "09:30", "10:00", "11:30", "12:00", "13:30", "14:00", "15:30", "16:00", "17:30"];
    const slot = (day: number, b: number, room: string, kind = "Lecture"): [number, string, string, string] => [day, B[b * 2], B[b * 2 + 1], room + "|" + kind];
    const current: CS[] = [
      ["ACCT101", "Financial Accounting", 3, "Accounting", 1, 1, [slot(0, 0, "B101"), slot(2, 2, "B204", "Section")]],
      ["MKT101", "Marketing Management", 3, "Marketing", 0, 2, [slot(0, 1, "Hall A"), slot(3, 0, "B205", "Section")]],
      ["LAW101", "Business Law", 3, "Business Administration", 0, 2, [slot(1, 0, "B103"), slot(4, 1, "B110", "Section")]],
      ["MIS101", "Management Information Systems", 3, "Management Information Systems", 0, 2, [slot(1, 2, "Lab 2"), slot(3, 1, "Lab 2", "Section")]],
      ["STAT101", "Statistics", 3, "Economics", 0, 2, [slot(2, 0, "B201"), slot(4, 2, "Lab 1", "Section")]],
      ["OM101", "Operations Management", 3, "Business Administration", 7, 2, [slot(6, 1, "B301"), slot(3, 3, "B302", "Section")]],
      ["ECON101", "Microeconomics", 3, "Economics", 3, 1, [slot(6, 0, "Hall B"), slot(1, 1, "C104", "Section")]],
      ["ACC201", "Cost Accounting", 3, "Accounting", 1, 2, [slot(0, 2, "A201"), slot(2, 3, "A203", "Section")]],
      ["FIN101", "Corporate Finance", 3, "Finance", 4, 3, [slot(6, 2, "D101"), slot(3, 2, "D102", "Section")]],
      ["HRM101", "Human Resource Management", 3, "Business Administration", 7, 3, [slot(0, 3, "B210"), slot(4, 0, "B211", "Section")]],
      ["ENT101", "Entrepreneurship", 3, "Business Administration", 7, 3, [slot(1, 3, "Innovation Hub"), slot(4, 3, "Innovation Hub", "Section")]],
      ["BUS102", "International Business", 3, "Business Administration", 4, 3, [slot(2, 1, "Hall C"), slot(6, 3, "B115", "Section")]],
      ["MKT102", "Digital Marketing", 3, "Marketing", 5, 3, [slot(3, 0, "Lab 3"), slot(1, 4, "Lab 3", "Section")]],
    ];
    const previous: [string, string, number, string, number][] = [
      ["BUS101", "Introduction to Business", 3, "Business Administration", 7], ["MATH101", "Business Mathematics", 3, "Economics", 2],
      ["ENG101", "English for Business", 2, "Business Administration", 5], ["CS101", "Computer Skills", 2, "Management Information Systems", 6],
      ["ACC100", "Principles of Accounting", 3, "Accounting", 1], ["ECO100", "Principles of Economics", 3, "Economics", 3],
    ];
    const cur = current.map(([code, name, credits, department, di, level, sl]) => {
      const d = S(di);
      const c = db.insert(courses).values({ code, name, credits, department, doctorId: d.id, instructor: d.name, room: sl[0][3].split("|")[0], offered: 1, capacity: 60, level, lateAfterMin: 10,
        description: `${name} — core ${department.toLowerCase()} course, level ${level}.` }).returning().get();
      for (const [day, start, end, rk] of sl) { const [room, kind] = rk.split("|"); db.insert(courseSlots).values({ courseId: c.id, day, start, end, room, kind }).run(); }
      return c;
    });
    const prev = previous.map(([code, name, credits, department, di]) => db.insert(courses).values({ code, name, credits, department, doctorId: S(di).id, instructor: S(di).name, room: "—", offered: 0, level: 1 }).returning().get());
    const byCode = (c: string) => cur.find((x) => x.code === c)!;

    // students
    const first = ["Omar", "Nour", "Youssef", "Mariam", "Salma", "Mostafa", "Farida", "Karim", "Habiba", "Ali", "Laila", "Hassan", "Jana", "Ziad", "Malak", "Adam", "Rana", "Khaled", "Hana", "Seif", "Dina", "Mahmoud", "Yara", "Amr", "Reem", "Tamer", "Nada", "Ibrahim", "Lina", "Hamza", "Sara", "Mohamed", "Aya", "Marwan", "Noha", "Fady", "Rowan", "Sherif", "Menna", "Bassel", "Joudy", "Kareem", "Tala", "Yassin", "Heba", "Ramy", "Mai", "Adham", "Nadine", "Hesham", "Rahma", "Ezz", "Lojain", "Moaz", "Shahd", "Taha", "Rokaya", "Galal", "Basma"];
    const last = ["Hassan", "El-Sayed", "Abdelrahman", "Fathy", "Mansour", "Ibrahim", "Saleh", "Kamal", "Nasser", "Farouk", "Gamal", "Shawky", "Ezzat", "Lotfy", "Hamdy", "Zaki", "Mostafa", "Youssef"];
    const female = new Set(["Nour", "Mariam", "Salma", "Farida", "Habiba", "Laila", "Jana", "Malak", "Rana", "Hana", "Dina", "Yara", "Reem", "Nada", "Lina", "Sara", "Aya", "Noha", "Rowan", "Menna", "Joudy", "Tala", "Heba", "Mai", "Nadine", "Rahma", "Lojain", "Shahd", "Rokaya", "Basma"]);
    const reliability = new Map<number, number>();
    const ahmedCourses = ["ACCT101", "MKT101", "LAW101", "MIS101", "STAT101", "OM101"].map((c) => byCode(c).id);
    const ahmedBase = "2025104"; const ahmedCode = ahmedBase + luhn(ahmedBase);
    const ahmed = this.createStudent({ name: "Ahmed Mohamed", email: "ahmed.mohamed@sams.edu.eg", phone: "+20 100 234 5678", department: "Business Administration", year: 2, gender: "Male", courseIds: ahmedCourses, address: "6th of October City, Giza", dob: "2006-03-14" } as any, { code: ahmedCode, silent: true });
    reliability.set(ahmed.id, 0.92);

    const slotsAll = this.slots();
    const conflicts = (ids: number[], cid: number) => {
      const mine = slotsAll.filter((s) => ids.includes(s.courseId));
      return slotsAll.filter((s) => s.courseId === cid).some((s) => mine.some((m) => m.day === s.day && toMin(m.start) < toMin(s.end) && toMin(s.start) < toMin(m.end)));
    };
    first.forEach((f, i) => {
      const l = pick(last);
      const dept = DEPARTMENTS[i % DEPARTMENTS.length];
      const level = 1 + Math.floor(rand() * 4);
      const ids: number[] = [];
      const pool = [...cur].sort(() => rand() - 0.5);
      const want = 4 + Math.floor(rand() * 3);
      for (const c of pool) { if (ids.length >= want) break; if (!conflicts(ids, c.id)) ids.push(c.id); }
      const s = this.createStudent({ name: `${f} ${l}`, email: `${f.toLowerCase()}.${l.toLowerCase().replace(/[^a-z]/g, "")}${i}@sams.edu.eg`, phone: `+20 1${Math.floor(rand() * 3)}${String(Math.floor(rand() * 1e8)).padStart(8, "0")}`, department: dept, year: level, gender: female.has(f) ? "Female" : "Male", courseIds: ids } as any, { silent: true });
      reliability.set(s.id, i % 11 === 3 ? 0.58 : i % 7 === 2 ? 0.72 : 0.86 + rand() * 0.12);
    });

    // past semesters
    const allS = db.select().from(students).all();
    const insEnr = sqlite.prepare("INSERT OR IGNORE INTO enrollments (student_id, course_id, semester, status, score, grade) VALUES (?,?,?,?,?,?)");
    for (const s of allS) {
      if (s.year < 2) continue;
      prev.forEach((c, k) => {
        const sem = k < 3 ? "Fall 2025" : "Spring 2026";
        const base = s.id === ahmed.id ? [92, 86, 95, 81, 88, 84][k] : Math.round(55 + rand() * 42 - ((reliability.get(s.id) ?? 0.9) < 0.7 ? 12 : 0));
        insEnr.run(s.id, c.id, sem, "completed", base, letterFor(base).grade);
      });
    }
    // current-semester provisional coursework (some pending)
    for (const e of db.select().from(enrollments).where(eq(enrollments.status, "current")).all()) {
      const c = cur.find((x) => x.id === e.courseId)!;
      const isDoctor = c.doctorId === st[0].id;
      if (e.studentId === ahmed.id) {
        const sc: Record<string, number> = { ACCT101: 88, MKT101: 82, LAW101: 91, MIS101: 93, STAT101: 79, OM101: 86 };
        db.update(enrollments).set({ score: sc[c.code], grade: letterFor(sc[c.code]).grade }).where(eq(enrollments.id, e.id)).run();
      } else if (!isDoctor || rand() < 0.55) {
        const sc = Math.round(52 + rand() * 45);
        db.update(enrollments).set({ score: sc, grade: letterFor(sc).grade }).where(eq(enrollments.id, e.id)).run();
      }
    }

    // payments
    const insPay = sqlite.prepare("INSERT INTO payments (student_id, date, description, amount, method, reference, status) VALUES (?,?,?,?,?,?,?)");
    const ref = () => "SAMS-" + Math.floor(rand() * 1e6).toString(36).toUpperCase().padStart(5, "0");
    for (const s of allS) {
      if (s.id === ahmed.id) {
        insPay.run(s.id, "2026-09-15", "Tuition Fee (Fall 2026) — installment 1", 8000, "Credit Card", ref(), "Paid");
        insPay.run(s.id, "2026-08-10", "Registration Fee", 2500, "Fawry", ref(), "Paid");
        insPay.run(s.id, "2026-07-20", "Lab & Library Fee", 1000, "Bank Transfer", ref(), "Paid");
        insPay.run(s.id, "2026-06-15", "Student Activity Fee", 500, "Mobile Wallet", ref(), "Paid");
        continue;
      }
      const methods = ["Credit Card", "Fawry", "Bank Transfer", "Mobile Wallet"];
      insPay.run(s.id, "2026-08-" + String(5 + Math.floor(rand() * 20)).padStart(2, "0"), "Registration Fee", 2500, pick(methods), ref(), "Paid");
      insPay.run(s.id, "2026-07-" + String(5 + Math.floor(rand() * 20)).padStart(2, "0"), "Lab & Library + Activity Fees", 1500, pick(methods), ref(), "Paid");
      const r = rand();
      if (r < 0.55) insPay.run(s.id, "2026-09-" + String(1 + Math.floor(rand() * 25)).padStart(2, "0"), "Tuition Fee (Fall 2026)", 10500, pick(methods), ref(), "Paid");
      else if (r < 0.85) insPay.run(s.id, "2026-09-" + String(1 + Math.floor(rand() * 25)).padStart(2, "0"), "Tuition Fee (Fall 2026) — installment 1", 6000 + Math.floor(rand() * 3) * 1000, pick(methods), ref(), "Paid");
    }

    // sessions + attendance
    const insAtt = sqlite.prepare("INSERT INTO attendance (session_id, student_id, status, method, recorded_at, note) VALUES (?,?,?,?,?,?)");
    const methods = ["qr", "qr", "qr", "barcode", "barcode", "manual"];
    const now = new Date();
    const startD = new Date(Math.max(atTime(SEMESTER_START, "00:00").getTime(), now.getTime() - 35 * 86400000));
    const enrollMap = new Map(cur.map((c) => [c.id, this.courseStudentIds(c.id)]));
    const tx = sqlite.transaction(() => {
      for (let d = new Date(startD); localDate(d) <= localDate(now); d.setDate(d.getDate() + 1)) {
        const date = localDate(d);
        for (const sl of slotsAll.filter((x) => x.day === d.getDay())) {
          const st0 = atTime(date, sl.start), en = atTime(date, sl.end);
          if (en > now) continue; // today's future/in-progress handled by tick + demo below
          const ses = db.insert(classSessions).values({ courseId: sl.courseId, slotId: sl.id, date, startsAt: st0.toISOString(), endsAt: en.toISOString(), status: "closed" }).returning().get();
          for (const sid of enrollMap.get(sl.courseId) ?? []) {
            const r = rand(); const p = reliability.get(sid) ?? 0.9;
            let status: AttendanceStatus, off: number, m: string, note: string | null = null;
            if (r < p * 0.87) { status = "present"; off = -8 + rand() * 17; m = pick(methods); }
            else if (r < p) { status = "late"; off = 11 + rand() * 25; m = pick(methods); }
            else if (r < p + 0.025) { status = "excused"; off = 0; m = "manual"; note = rand() < 0.5 ? "Medical certificate" : "Official academy activity"; }
            else { status = "absent"; off = 90; m = "auto"; }
            insAtt.run(ses.id, sid, status, m, new Date(st0.getTime() + off * 60000).toISOString(), note);
          }
        }
      }
    });
    tx();
    this.tick();
    // give in-progress classes some arrivals, and make sure Dr. Ahmed has a live class for the demo
    const fillOpen = (sesId: number, c: { id: number; lateAfterMin: number }, startAt: Date, fill: number) => {
      const mins = Math.max(1, (now.getTime() - startAt.getTime()) / 60000);
      for (const sid of enrollMap.get(c.id) ?? []) {
        if (sid === ahmed.id || rand() > fill) continue;
        const off = rand() * Math.min(mins, 40);
        insAtt.run(sesId, sid, off > c.lateAfterMin ? "late" : "present", pick(methods), new Date(startAt.getTime() + off * 60000).toISOString(), null);
      }
    };
    for (const o of db.select().from(classSessions).where(eq(classSessions.status, "open")).all()) {
      fillOpen(o.id, cur.find((c) => c.id === o.courseId)!, new Date(o.startsAt), 0.6);
    }
    const openNow = this.listSessions({ status: "open" });
    const demo: [string, number, number][] = [];
    if (!openNow.some((s) => s.course.doctorId === st[0].id)) demo.push(["MKT101", 16, 0.7]);
    if (openNow.length + demo.length < 2) demo.push(["STAT101", 4, 0.35]);
    for (const [code, minsAgo, fill] of demo) {
      const c = byCode(code);
      const startAt = new Date(now.getTime() - minsAgo * 60000);
      const ses = this.openSession(c.id, null, startAt, new Date(startAt.getTime() + 90 * 60000));
      fillOpen(ses.id, c, startAt, fill);
    }

    // calendar
    const ev: [string, string, string, string, string][] = [
      ["Armed Forces Day — academy closed", "2026-10-06", "", "", "holiday"],
      ["Midterm Exam — Marketing Management", "2026-10-15", "10:00 AM", "B203", "exam"],
      ["Course Registration Deadline (add / drop)", "2026-10-18", "11:59 PM", "Online", "registration"],
      ["Tuition second installment due", "2026-10-20", "", "Finance Office", "deadline"],
      ["Midterm Exam — Statistics", "2026-10-22", "12:00 PM", "B201", "exam"],
      ["Midterm Exam — Financial Accounting", "2026-10-25", "09:00 AM", "Hall A", "exam"],
      ["Midterm Exam — Business Law", "2026-10-26", "10:00 AM", "B103", "exam"],
      ["Student Activity — Business Fair", "2026-10-28", "11:00 AM", "Main Hall", "activity"],
      ["Final Exam Registration opens", "2026-11-05", "", "Online", "registration"],
      ["Career Day with industry partners", "2026-11-12", "10:00 AM", "Conference Center", "activity"],
      ["Research Week — Graduation Projects", "2026-11-22", "", "Library", "activity"],
      ["Last day of classes", "2026-12-17", "", "", "deadline"],
      ["Final Exams begin", "2026-12-20", "09:00 AM", "Exam Halls", "exam"],
      ["Coptic Christmas — academy closed", "2027-01-07", "", "", "holiday"],
    ];
    for (const [title, date, time, location, category] of ev) db.insert(events).values({ title, date, time, location, category }).run();

    // notifications
    const ago = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
    const nts: [string, string, string, string, number, number][] = [
      ["all", "academic", "Exam Schedule Released", "The final exam schedule for Fall 2026 is now available in the academic calendar.", 2, 0],
      [`student:${ahmed.id}`, "financial", "Payment Reminder", "Your tuition fee second installment of 2,500 EGP is due on Oct 20, 2026.", 5, 0],
      [`student:${ahmed.id}`, "academic", "New Assignment", "A new assignment has been added for Marketing Management (MKT101).", 20, 0],
      ["all", "system", "Academic Notice", "Updated policy for course registration. Please check the details before Oct 18.", 26, 1],
      ["students", "academic", "Midterm week approaching", "Midterm exams start Oct 15. Check your exam halls in the calendar.", 50, 1],
      ["all", "system", "Welcome to SAMS Connect", "We're glad to have you on board. Explore your dashboard to get started.", 300, 1],
      ["doctors", "academic", "Grade submission window", "Coursework grades for Fall 2026 should be submitted by Oct 30.", 8, 0],
      ["doctor:" + st[0].id, "academic", "Room change", "MKT101 section on Wednesday moves to room B205 starting this week.", 30, 1],
      ["admin", "system", "Nightly backup completed", "All academy records were backed up successfully.", 9, 0],
      ["admin", "financial", "Outstanding balances", "Several students still have an outstanding tuition balance before the Oct 20 deadline.", 28, 0],
    ];
    for (const [target, category, title, body, h, read] of nts) db.insert(notifications).values({ target, category, title, body, createdAt: ago(h), read }).run();

    const acts: [string, string, number][] = [
      ["New student registered: Basma Youssef", "student", 1.2], ["Course registration period opened for MKT102", "registration", 3],
      ["Payment of 8,000 EGP received from Ahmed Mohamed", "payment", 6], ["New staff member added: Dr. Sherif Ali", "staff", 26],
      ["Calendar event added: Career Day with industry partners", "calendar", 40], ["Attendance report exported (Fall 2026)", "report", 52],
    ];
    for (const [text, kind, h] of acts) db.insert(activities).values({ text, kind, at: ago(h) }).run();
  }
}

export const storage = new DatabaseStorage();
