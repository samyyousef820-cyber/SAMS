import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { z } from "zod";

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentCode: text("student_code").notNull().unique(), // 8 digits: intake year + seq + Luhn check digit
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  department: text("department").notNull(),
  program: text("program").notNull().default("Bachelor of Business Administration"),
  year: integer("year").notNull(), // academic level 1-4
  gender: text("gender").notNull().default("Male"),
  dob: text("dob").notNull().default("2005-01-01"),
  address: text("address").notNull().default(""),
  nationalId: text("national_id").notNull().default(""),
});

export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  title: text("title").notNull(), // Professor, Associate Professor, Lecturer, Teaching Assistant
  department: text("department").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  office: text("office").notNull().default(""),
});

export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  credits: integer("credits").notNull().default(3),
  department: text("department").notNull(),
  doctorId: integer("doctor_id"),
  instructor: text("instructor").notNull(),
  room: text("room").notNull(),
  offered: integer("offered").notNull().default(1), // offered this semester
  capacity: integer("capacity").notNull().default(60),
  level: integer("level").notNull().default(1),
  description: text("description").notNull().default(""),
  lateAfterMin: integer("late_after_min").notNull().default(10),
});

export const courseSlots = sqliteTable("course_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull(),
  day: integer("day").notNull(), // JS getDay(): 0 Sun … 6 Sat
  start: text("start").notNull(), // HH:mm
  end: text("end").notNull(),
  room: text("room").notNull(),
  kind: text("kind").notNull().default("Lecture"),
});

export const enrollments = sqliteTable("enrollments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull(),
  courseId: integer("course_id").notNull(),
  semester: text("semester").notNull(),
  status: text("status").notNull().default("current"), // current | completed
  score: integer("score"),
  grade: text("grade"),
});

export const classSessions = sqliteTable("class_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id").notNull(),
  slotId: integer("slot_id"),
  date: text("date").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  status: text("status").notNull().default("open"),
});

export const attendance = sqliteTable("attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  studentId: integer("student_id").notNull(),
  status: text("status").notNull(),
  method: text("method").notNull(),
  recordedAt: text("recorded_at").notNull(),
  note: text("note"),
});

export const fees = sqliteTable("fees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  dueDate: text("due_date").notNull(),
  semester: text("semester").notNull(),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull(),
  reference: text("reference").notNull(),
  status: text("status").notNull().default("Paid"),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull().default(""),
  location: text("location").notNull().default(""),
  category: text("category").notNull(), // exam | registration | activity | holiday | deadline
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  target: text("target").notNull(), // all | students | doctors | admin | student:ID | doctor:ID
  category: text("category").notNull(), // academic | financial | system
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
  read: integer("read").notNull().default(0),
});

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  kind: text("kind").notNull(),
  at: text("at").notNull(),
});

// ---------- validation ----------
export const insertStudentSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  year: z.coerce.number().int().min(1).max(4),
  gender: z.string().optional(),
  courseIds: z.array(z.number()).optional(),
});
export const insertStaffSchema = z.object({
  name: z.string().min(2), title: z.string().min(2), department: z.string().min(1),
  email: z.string().email(), phone: z.string().optional(), office: z.string().optional(),
});
export const insertCourseSchema = z.object({
  code: z.string().min(3), name: z.string().min(2), credits: z.coerce.number().int().min(1).max(6),
  department: z.string().min(1), doctorId: z.coerce.number().int(), capacity: z.coerce.number().int().min(5).max(500),
  level: z.coerce.number().int().min(1).max(4), day: z.coerce.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/), room: z.string().min(1),
});
export const insertEventSchema = z.object({
  title: z.string().min(2), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().optional(),
  location: z.string().optional(), category: z.enum(["exam", "registration", "activity", "holiday", "deadline"]),
});
export const checkInSchema = z.object({
  sessionId: z.number(), code: z.string().min(1), method: z.enum(["qr", "barcode", "manual", "camera"]),
});
export const statusUpdateSchema = z.object({
  sessionId: z.number(), studentId: z.number(),
  status: z.enum(["present", "late", "absent", "excused"]), note: z.string().optional(),
});
export const paymentSchema = z.object({
  amount: z.coerce.number().int().min(1), method: z.enum(["Credit Card", "Fawry", "Bank Transfer", "Mobile Wallet"]),
});
export const profileUpdateSchema = z.object({
  email: z.string().email().optional(), phone: z.string().optional(), address: z.string().optional(),
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type CourseSlot = typeof courseSlots.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type ClassSession = typeof classSessions.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type Fee = typeof fees.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type AcademicEvent = typeof events.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export type SessionView = ClassSession & { course: Course; enrolled: number; present: number; late: number; absent: number; excused: number };
export type LogEntry = Attendance & { student: Student; course: Course; session: ClassSession };
export type StudentStats = Student & { courseIds: number[]; total: number; present: number; late: number; absent: number; excused: number; rate: number };
export type SlotView = CourseSlot & { course: Course };
export type Role = "student" | "doctor" | "admin";
export type AuthUser = { role: Role; id: number; name: string; subtitle: string; avatar?: string };
