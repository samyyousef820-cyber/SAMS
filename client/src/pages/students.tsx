import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader, RateBar, IdCard, StatusBadge, MethodTag, fmtDate, fmtTime, EmptyState } from "@/components/shared";
import type { Course, LogEntry, Student, StudentStats } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(2, "Enter the student's full name"),
  email: z.string().email("Enter a valid email"),
  department: z.string().min(1, "Choose a department"),
  year: z.string().min(1),
  courseIds: z.array(z.number()).min(1, "Enroll in at least one course"),
});
type FormValues = z.infer<typeof formSchema>;

export default function Students() {
  const { toast } = useToast();
  const { data: students, isLoading } = useQuery<StudentStats[]>({ queryKey: ["/api/students"] });
  const { data: courses } = useQuery<Course[]>({ queryKey: ["/api/courses"] });
  const { data: meta } = useQuery<{ departments: string[] }>({ queryKey: ["/api/meta"] });
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [sort, setSort] = useState<"code" | "rate" | "name">("code");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<StudentStats | null>(null);
  const [created, setCreated] = useState<Student | null>(null);

  const rows = useMemo(() => {
    let r = (students ?? []).filter((s) => (dept === "all" || s.department === dept) && (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.studentCode.includes(q.toUpperCase()) || s.email.includes(q.toLowerCase())));
    if (sort === "rate") r = [...r].sort((a, b) => a.rate - b.rate);
    if (sort === "name") r = [...r].sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }, [students, q, dept, sort]);
  const courseMap = new Map(courses?.map((c) => [c.id, c]));

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { name: "", email: "", department: "", year: "1", courseIds: [] } });
  const create = useMutation({
    mutationFn: async (v: FormValues) => (await apiRequest("POST", "/api/students", { ...v, year: Number(v.year) })).json() as Promise<Student>,
    onSuccess: (s) => { queryClient.invalidateQueries(); setAdding(false); form.reset(); setCreated(s); },
    onError: (e: Error) => toast({ title: "Could not add student", description: e.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/students/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(); setSelected(null); toast({ title: "Student removed" }); },
  });

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Every student gets a unique ID with a check digit, printed as both a QR code and a Code 128 barcode."
        actions={<Button onClick={() => setAdding(true)} data-testid="button-add-student"><UserPlus className="h-4 w-4 me-2" />Add student</Button>}
      />

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute start-2.5 top-2.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID or email" className="h-8 ps-8 w-64 text-sm" data-testid="input-student-search" />
          </div>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="h-8 w-[200px] text-xs" data-testid="select-dept"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {meta?.departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="h-8 w-[170px] text-xs" data-testid="select-sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="code">Sort by ID</SelectItem>
              <SelectItem value="name">Sort by name</SelectItem>
              <SelectItem value="rate">Lowest attendance first</SelectItem>
            </SelectContent>
          </Select>
          <span className="ms-auto text-xs text-muted-foreground">{rows.length} students</span>
        </div>
        {isLoading ? <div className="p-4"><Skeleton className="h-96" /></div> : rows.length === 0 ? (
          <EmptyState icon={<Users className="h-7 w-7" />} title="No students match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs text-muted-foreground border-b">
                  <th className="font-medium px-4 py-2.5">Student ID</th>
                  <th className="font-medium px-4 py-2.5">Name</th>
                  <th className="font-medium px-4 py-2.5 hidden md:table-cell">Department</th>
                  <th className="font-medium px-4 py-2.5 hidden lg:table-cell">Courses</th>
                  <th className="font-medium px-4 py-2.5 text-end">Absences</th>
                  <th className="font-medium px-4 py-2.5">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setSelected(s)} data-testid={`row-student-${s.id}`}>
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{s.studentCode}</td>
                    <td className="px-4 py-2.5"><div>{s.name}</div><div className="text-[11px] text-muted-foreground">{s.email}</div></td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-xs">{s.department} · L{s.year}</td>
                    <td className="px-4 py-2.5 hidden lg:table-cell"><div className="flex flex-wrap gap-1">{s.courseIds.map((c) => <span key={c} className="font-mono text-[10px] rounded border px-1.5 py-0.5 text-muted-foreground">{courseMap.get(c)?.code}</span>)}</div></td>
                    <td className="px-4 py-2.5 text-end font-mono tabular text-xs">{s.absent}</td>
                    <td className="px-4 py-2.5 w-[190px]"><RateBar rate={s.rate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* add dialog */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register a student</DialogTitle>
            <DialogDescription>An 8-digit student ID is generated automatically from the intake year, a sequence number and a Luhn check digit. Fees and a welcome notification are created too.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full name</FormLabel><FormControl><Input {...field} data-testid="input-student-name" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} data-testid="input-student-email" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Department</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-student-dept"><SelectValue placeholder="Choose…" /></SelectTrigger></FormControl>
                      <SelectContent>{meta?.departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="year" render={({ field }) => (
                  <FormItem><FormLabel>Level</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger data-testid="select-student-year"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{[1, 2, 3, 4].map((y) => <SelectItem key={y} value={String(y)}>Level {y}</SelectItem>)}</SelectContent>
                    </Select></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="courseIds" render={({ field }) => (
                <FormItem><FormLabel>Courses</FormLabel>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {courses?.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                        <Checkbox checked={field.value.includes(c.id)} data-testid={`checkbox-course-${c.id}`}
                          onCheckedChange={(v) => field.onChange(v ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))} />
                        <span className="font-mono text-xs">{c.code}</span><span className="truncate text-xs text-muted-foreground">{c.name}</span>
                      </label>
                    ))}
                  </div><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                <Button type="submit" disabled={create.isPending} data-testid="button-submit-student">{create.isPending ? "Registering…" : "Register & issue ID"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* created confirmation */}
      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ID issued</DialogTitle><DialogDescription>This card can be scanned at any check-in station right away.</DialogDescription></DialogHeader>
          {created && <IdCard student={created} />}
        </DialogContent>
      </Dialog>

      {/* detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && <StudentDetail s={selected} courseMap={courseMap} onDelete={() => remove.mutate(selected.id)} deleting={remove.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentDetail({ s, courseMap, onDelete, deleting }: { s: StudentStats; courseMap: Map<number, Course>; onDelete: () => void; deleting: boolean }) {
  const { data: history } = useQuery<LogEntry[]>({ queryKey: ["/api/students", s.id, "history"] });
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{s.name}</DialogTitle>
        <DialogDescription>{s.email} · {s.courseIds.map((c) => courseMap.get(c)?.code).join(", ")}</DialogDescription>
      </DialogHeader>
      <div className="grid md:grid-cols-2 gap-4">
        <IdCard student={s} />
        <div className="grid grid-cols-2 gap-2 content-start">
          {([["Present", s.present], ["Late", s.late], ["Absent", s.absent], ["Excused", s.excused]] as const).map(([k, v]) => (
            <div key={k} className="rounded-md border p-3"><div className="text-[11px] text-muted-foreground">{k}</div><div className="font-mono font-semibold tabular">{v}</div></div>
          ))}
          <div className="col-span-2 rounded-md border p-3"><div className="text-[11px] text-muted-foreground mb-1.5">Attendance rate</div><RateBar rate={s.rate} /></div>
        </div>
      </div>
      <div className="mt-2">
        <div className="text-xs font-medium text-muted-foreground mb-2">Recent history</div>
        <div className="max-h-56 overflow-y-auto divide-y rounded-md border">
          {!history ? <Skeleton className="h-24 m-2" /> : history.length === 0 ? <p className="p-3 text-xs text-muted-foreground">No attendance yet.</p> : history.slice(0, 40).map((h) => (
            <div key={h.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
              <span className="w-24">{fmtDate(h.session.date)}</span>
              <span className="font-mono w-16">{h.course.code}</span>
              <span className="text-muted-foreground w-20 whitespace-nowrap tabular">{h.status === "absent" ? "—" : fmtTime(h.recordedAt)}</span>
              <MethodTag method={h.method} />
              <span className="ms-auto"><StatusBadge status={h.status} /></span>
            </div>
          ))}
        </div>
      </div>
      <DialogFooter className="sm:justify-between">
        {confirm ? (
          <div className="flex items-center gap-2 text-xs">Delete this student and all their records?
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={deleting} data-testid="button-confirm-delete">Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirm(true)} data-testid="button-delete-student"><Trash2 className="h-3.5 w-3.5 me-1.5" />Remove student</Button>
        )}
      </DialogFooter>
    </>
  );
}
