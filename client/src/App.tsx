import { useEffect, useRef, useState, type ComponentType } from "react";
import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, BookOpen, CalendarDays, GraduationCap, ClipboardCheck, ClipboardList, Wallet, CalendarRange, Bell, UserRound,
  LogOut, Search, Menu, X, ScanLine, ListX, FileSpreadsheet, Users, Briefcase, Library, BarChart3, Landmark, PenLine, Moon, Sun, MoreHorizontal, Home,
} from "lucide-react";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import CheckIn from "@/pages/checkin";
import LogPage from "@/pages/log";
import Students from "@/pages/students";
import Reports from "@/pages/reports";
import AttendanceAnalytics from "@/pages/dashboard";
import { StudentDashboard, StudentCourses, Grades, MyAttendance, Registration, Fees } from "@/pages/student";
import { DoctorDashboard, DoctorCourses, Gradebook } from "@/pages/doctor";
import { AdminDashboard, StaffPage, ProgramsPage, FinancePage } from "@/pages/admin";
import { Schedule, CalendarPage, NotificationsPage, ProfilePage } from "@/pages/common";
import { Logo, LiveProvider, LiveDot, Avatar } from "@/components/shared";
import { AppProviders, useAuth, useT, useWho } from "@/lib/app";
import { cn } from "@/lib/utils";
import type { Notification, Role, Course, Student, Staff } from "@shared/schema";

type NavItem = { href: string; label: string; icon: ComponentType<{ className?: string }> };
const NAV: Record<Role, NavItem[]> = {
  student: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/courses", label: "My Courses", icon: BookOpen },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/grades", label: "Grades & Results", icon: GraduationCap },
    { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
    { href: "/registration", label: "Course Registration", icon: ClipboardList },
    { href: "/fees", label: "Fees & Payments", icon: Wallet },
    { href: "/calendar", label: "Academic Calendar", icon: CalendarRange },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/profile", label: "Profile", icon: UserRound },
  ],
  doctor: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/courses", label: "My Courses", icon: BookOpen },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/checkin", label: "Attendance Check-in", icon: ScanLine },
    { href: "/log", label: "Absence Log", icon: ListX },
    { href: "/gradebook", label: "Gradebook", icon: PenLine },
    { href: "/reports", label: "Reports", icon: FileSpreadsheet },
    { href: "/calendar", label: "Academic Calendar", icon: CalendarRange },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/profile", label: "Profile", icon: UserRound },
  ],
  admin: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/students", label: "Students", icon: Users },
    { href: "/staff", label: "Staff", icon: Briefcase },
    { href: "/programs", label: "Academic Programs", icon: Library },
    { href: "/analytics", label: "Attendance Overview", icon: BarChart3 },
    { href: "/checkin", label: "Attendance Check-in", icon: ScanLine },
    { href: "/log", label: "Absence Log", icon: ListX },
    { href: "/reports", label: "Reports", icon: FileSpreadsheet },
    { href: "/finance", label: "Finance", icon: Landmark },
    { href: "/calendar", label: "Academic Calendar", icon: CalendarRange },
    { href: "/notifications", label: "Notifications", icon: Bell },
  ],
};

function BrandBlock({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-3">
      <Logo className={cn("text-white shrink-0", compact ? "h-8 w-8" : "h-10 w-10")} />
      <div className="leading-tight min-w-0">
        <div className="font-bold text-white tracking-tight">SAMS Connect</div>
        {!compact && <div className="text-[10.5px] text-white/60 leading-snug">{t("Sadat Academy for Management Sciences")}</div>}
      </div>
    </div>
  );
}

function GlobalSearch() {
  const { t } = useT();
  const who = useWho();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { data } = useQuery<{ courses: Course[]; students: Student[]; staff: Staff[] }>({ queryKey: [`/api/search?q=${encodeURIComponent(q)}&${who}`], enabled: q.trim().length >= 2 });
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const go = (href: string) => { setOpen(false); setQ(""); navigate(href); };
  const empty = data && !data.courses.length && !data.students.length && !data.staff.length;
  return (
    <div className="relative w-full max-w-md" ref={box}>
      <Search className="h-4 w-4 absolute start-3 top-2.5 text-muted-foreground" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={t(user?.role === "student" ? "Search for courses…" : "Search for courses, students…")}
        className="h-9 w-full rounded-lg border bg-muted/40 ps-9 pe-3 text-sm outline-none focus:bg-background focus:ring-2 focus:ring-primary/30" data-testid="input-global-search" />
      {open && q.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden text-sm">
          {!data ? <div className="p-3 text-muted-foreground">{t("Searching…")}</div> : empty ? <div className="p-3 text-muted-foreground">{t("No results")}</div> : (
            <div className="max-h-80 overflow-y-auto py-1">
              {data.courses.length > 0 && <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t("Courses")}</div>}
              {data.courses.map((c) => (
                <button key={c.id} onClick={() => go(user?.role === "admin" ? "/programs" : user?.role === "student" ? "/registration" : "/courses")} className="w-full text-start px-3 py-2 hover:bg-muted flex gap-2">
                  <span className="font-mono text-xs w-16 shrink-0 text-primary">{c.code}</span><span className="truncate">{c.name}</span>
                </button>
              ))}
              {data.students.length > 0 && <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t("Students")}</div>}
              {data.students.map((s) => (
                <button key={s.id} onClick={() => go(user?.role === "admin" ? "/students" : "/gradebook")} className="w-full text-start px-3 py-2 hover:bg-muted flex gap-2">
                  <span className="font-mono text-xs w-16 shrink-0 text-muted-foreground">{s.studentCode}</span><span className="truncate">{s.name}</span>
                </button>
              ))}
              {data.staff.length > 0 && <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t("Staff")}</div>}
              {data.staff.map((s) => (
                <button key={s.id} onClick={() => go(user?.role === "admin" ? "/staff" : "/calendar")} className="w-full text-start px-3 py-2 hover:bg-muted flex gap-2">
                  <span className="truncate">{s.name}</span><span className="text-xs text-muted-foreground truncate">{t(s.title)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const { t } = useT();
  const who = useWho();
  const [, navigate] = useLocation();
  const { data } = useQuery<Notification[]>({ queryKey: [`/api/notifications?${who}`] });
  const unread = data?.filter((n) => !n.read).length ?? 0;
  const read = useMutation({ mutationFn: (id: number) => apiRequest("POST", `/api/notifications/${id}/read`), onSuccess: () => queryClient.invalidateQueries() });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative h-9 w-9 grid place-items-center rounded-lg hover:bg-muted" aria-label={t("Notifications")} data-testid="button-bell">
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && <span className="absolute top-1 end-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center" data-testid="text-unread">{unread}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex justify-between"><span>{t("Notifications")}</span><span className="text-xs text-muted-foreground font-normal">{unread} {t("unread")}</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(data ?? []).slice(0, 5).map((n) => (
          <DropdownMenuItem key={n.id} onClick={() => read.mutate(n.id)} className="flex-col items-start gap-0.5 py-2">
            <div className="flex items-center gap-2 w-full"><span className={cn("h-2 w-2 rounded-full shrink-0", n.read ? "bg-transparent" : "bg-primary")} /><span className="text-sm font-medium truncate">{n.title}</span></div>
            <span className="text-xs text-muted-foreground line-clamp-2 ps-4">{n.body}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/notifications")} className="justify-center text-primary font-medium">{t("View all notifications")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LangSwitch() {
  const { lang, setLang } = useT();
  return (
    <button onClick={() => setLang(lang === "en" ? "ar" : "en")} className="h-9 px-2.5 rounded-lg hover:bg-muted flex items-center gap-1.5 text-sm font-medium" data-testid="button-lang" aria-label="Switch language">
      <span className="text-base leading-none">{lang === "en" ? "🇬🇧" : "🇪🇬"}</span>
      <span className="text-xs">{lang === "en" ? "EN" : "ع"}</span>
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const [location, navigate] = useLocation();
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location]);
  if (!user) return null;
  const items = NAV[user.role];
  const isActive = (href: string) => (href === "/" ? location === "/" : location.startsWith(href));
  const roleLabel = { student: "Student", doctor: "Doctor / Professor", admin: "Administrator" }[user.role];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 h-[72px] border-b border-sidebar-border">
        <BrandBlock />
        <button className="md:hidden text-white/70" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-3 space-y-0.5">
        {items.map((n) => (
          <Link key={n.href} href={n.href} data-testid={`link-nav-${n.href.replace("/", "") || "home"}`}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-colors",
              isActive(n.href) ? "bg-sidebar-accent text-white font-semibold shadow-sm" : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white")}>
            <n.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{t(n.label)}</span>
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between px-3 pb-2 text-[11px] text-white/50"><span>{t("Fall 2026")}</span><LiveDot label={false} /></div>
        <button onClick={logout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] text-sidebar-foreground/80 hover:bg-white/5 hover:text-white" data-testid="button-logout">
          <LogOut className="h-[18px] w-[18px] rtl:rotate-180" />{t("Logout")}
        </button>
      </div>
    </div>
  );

  const mobileTabs = user.role === "student"
    ? [{ href: "/", label: "Home", icon: Home }, { href: "/courses", label: "Courses", icon: BookOpen }, { href: "/schedule", label: "Schedule", icon: CalendarDays }, { href: "/attendance", label: "Attendance", icon: ClipboardCheck }]
    : user.role === "doctor"
      ? [{ href: "/", label: "Home", icon: Home }, { href: "/courses", label: "Courses", icon: BookOpen }, { href: "/checkin", label: "Check-in", icon: ScanLine }, { href: "/gradebook", label: "Grades", icon: PenLine }]
      : [{ href: "/", label: "Home", icon: Home }, { href: "/students", label: "Students", icon: Users }, { href: "/checkin", label: "Check-in", icon: ScanLine }, { href: "/reports", label: "Reports", icon: FileSpreadsheet }];

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden md:block fixed inset-y-0 start-0 z-40 w-64 bg-sidebar">{sidebar}</aside>
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-sidebar shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="md:ps-64 min-w-0">
        <header className="sticky top-0 z-30 h-16 flex items-center gap-3 border-b bg-card/90 backdrop-blur px-4 md:px-6">
          <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu" data-testid="button-menu"><Menu className="h-5 w-5" /></button>
          <div className="hidden sm:block flex-1"><GlobalSearch /></div>
          <div className="sm:hidden flex-1 font-semibold">SAMS Connect</div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LangSwitch />
            <button onClick={() => setDark((d) => !d)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-muted" aria-label="Toggle theme" data-testid="button-theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 ps-2 pe-1 py-1 rounded-lg hover:bg-muted ms-1" data-testid="button-user-menu">
                  <Avatar name={user.name} src={user.avatar} size={34} />
                  <div className="hidden lg:block text-start leading-tight">
                    <div className="text-sm font-semibold">{user.name}</div>
                    <div className="text-[11px] text-muted-foreground">{t(roleLabel)}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal"><div className="font-semibold">{user.name}</div><div className="text-xs text-muted-foreground">{user.subtitle}</div></DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role !== "admin" && <DropdownMenuItem onClick={() => navigate("/profile")}><UserRound className="h-4 w-4 me-2" />{t("Profile")}</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => navigate("/notifications")}><Bell className="h-4 w-4 me-2" />{t("Notifications")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-rose-600"><LogOut className="h-4 w-4 me-2" />{t("Logout")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="px-4 md:px-6 py-6 pb-24 md:pb-8 max-w-[1440px]">{children}</main>
      </div>
      <nav className="mobile-tabs md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-card grid grid-cols-5">
        {mobileTabs.map((n) => (
          <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[10.5px]", isActive(n.href) ? "text-primary font-semibold" : "text-muted-foreground")}>
            <n.icon className="h-5 w-5" />{t(n.label)}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] text-muted-foreground"><MoreHorizontal className="h-5 w-5" />{t("More")}</button>
      </nav>
    </div>
  );
}

function RoleRoute({ student, doctor, admin }: { student?: ComponentType; doctor?: ComponentType; admin?: ComponentType }) {
  const { user } = useAuth();
  const C = user?.role === "student" ? student : user?.role === "doctor" ? doctor : admin;
  return C ? <C /> : <NotFound />;
}

function AppRouter() {
  const { user } = useAuth();
  if (!user) return <Login />;
  return (
    <Shell>
      <Switch>
        <Route path="/"><RoleRoute student={StudentDashboard} doctor={DoctorDashboard} admin={AdminDashboard} /></Route>
        <Route path="/courses"><RoleRoute student={StudentCourses} doctor={DoctorCourses} /></Route>
        <Route path="/schedule"><RoleRoute student={Schedule} doctor={Schedule} admin={Schedule} /></Route>
        <Route path="/grades"><RoleRoute student={Grades} /></Route>
        <Route path="/attendance"><RoleRoute student={MyAttendance} /></Route>
        <Route path="/registration"><RoleRoute student={Registration} /></Route>
        <Route path="/fees"><RoleRoute student={Fees} /></Route>
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/profile"><RoleRoute student={ProfilePage} doctor={ProfilePage} /></Route>
        <Route path="/checkin/:id?"><RoleRoute doctor={CheckIn} admin={CheckIn} /></Route>
        <Route path="/log"><RoleRoute doctor={LogPage} admin={LogPage} /></Route>
        <Route path="/gradebook"><RoleRoute doctor={Gradebook} /></Route>
        <Route path="/reports"><RoleRoute doctor={Reports} admin={Reports} /></Route>
        <Route path="/students"><RoleRoute admin={Students} /></Route>
        <Route path="/staff"><RoleRoute admin={StaffPage} /></Route>
        <Route path="/programs"><RoleRoute admin={ProgramsPage} /></Route>
        <Route path="/analytics"><RoleRoute admin={AttendanceAnalytics} /></Route>
        <Route path="/finance"><RoleRoute admin={FinancePage} /></Route>
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProviders>
          <LiveProvider>
            <Toaster />
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </LiveProvider>
        </AppProviders>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
