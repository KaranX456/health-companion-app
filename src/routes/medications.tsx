import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Medication } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { EmptyState, ListSkeleton } from "@/components/common";
import { formatDate, today } from "@/lib/format";

type MedicationReminder = {
  id: string;
  medication_id: string;
  patient_id: string;
  time_of_day: string;
  label: string | null;
  active: boolean;
  created_at?: string | null;
};

function formatTimeOfDay(value: string) {
  const [h, m] = value.split(":");
  const hour = Number(h);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m ?? "00"} ${suffix}`;
}


export const Route = createFileRoute("/medications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Medication companion — AI Health Companion" },
      { name: "description", content: "Manage medications, track adherence and report side effects." },
      { property: "og:title", content: "Medication companion — AI Health Companion" },
      {
        property: "og:description",
        content: "Manage medications, track adherence and report side effects.",
      },
    ],
  }),
  component: MedicationsPage,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type MedForm = {
  drug_name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date: string;
};

const emptyForm: MedForm = {
  drug_name: "",
  dosage: "",
  frequency: "",
  start_date: today(),
  end_date: "",
};

function MedicationsPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();

  const [form, setForm] = useState<MedForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adherence, setAdherence] = useState<Record<string, boolean>>({});
  const [sideEffectMed, setSideEffectMed] = useState("");
  const [sideEffect, setSideEffect] = useState("");
  const [reminderDrafts, setReminderDrafts] = useState<Record<string, { time: string; label: string }>>({});


  const medsQ = useQuery({
    enabled: !!uid,
    queryKey: ["medications", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .eq("patient_id", uid!)
        .order("active", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Medication[];
    },
  });

  const saveMed = useMutation({
    mutationFn: async () => {
      const payload = {
        patient_id: uid!,
        drug_name: form.drug_name.trim(),
        dosage: form.dosage.trim() || null,
        frequency: form.frequency.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        active: true,
      };
      if (editingId) {
        const { error } = await supabase.from("medications").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("medications").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Medication updated" : "Medication added");
      setForm(emptyForm);
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ["medications", uid] });
      void qc.invalidateQueries({ queryKey: ["dashboard", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (med: Medication) => {
      const { error } = await supabase
        .from("medications")
        .update({ active: !med.active })
        .eq("id", med.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medication updated");
      void qc.invalidateQueries({ queryKey: ["medications", uid] });
      void qc.invalidateQueries({ queryKey: ["dashboard", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reportSideEffect = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("symptoms").insert({
        patient_id: uid!,
        description: `Possible side effect of ${sideEffectMed}: ${sideEffect.trim()}`,
        severity: 5,
        onset_date: today(),
        source: "patient_logged",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Side effect reported", { description: "Saved to your symptom timeline." });
      setSideEffect("");
      setSideEffectMed("");
      void qc.invalidateQueries({ queryKey: ["symptoms", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remindersQ = useQuery({
    enabled: !!uid,
    queryKey: ["medication_reminders", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medication_reminders")
        .select("*")
        .eq("patient_id", uid!)
        .order("time_of_day", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MedicationReminder[];
    },
  });

  const invalidateReminders = () =>
    void qc.invalidateQueries({ queryKey: ["medication_reminders", uid] });

  const addReminder = useMutation({
    mutationFn: async (vars: { medicationId: string; time: string; label: string }) => {
      const { error } = await supabase.from("medication_reminders").insert({
        patient_id: uid!,
        medication_id: vars.medicationId,
        time_of_day: vars.time.length === 5 ? `${vars.time}:00` : vars.time,
        label: vars.label.trim() || null,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Reminder added");
      setReminderDrafts((prev) => ({ ...prev, [vars.medicationId]: { time: "", label: "" } }));
      invalidateReminders();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleReminder = useMutation({
    mutationFn: async (r: MedicationReminder) => {
      const { error } = await supabase
        .from("medication_reminders")
        .update({ active: !r.active })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reminder updated");
      invalidateReminders();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medication_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reminder deleted");
      invalidateReminders();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeMeds = (medsQ.data ?? []).filter((m) => m.active);

  const remindersByMed = (remindersQ.data ?? []).reduce<Record<string, MedicationReminder[]>>(
    (acc, r) => {
      (acc[r.medication_id] ??= []).push(r);
      return acc;
    },
    {},
  );


  return (
    <AppLayout title="Medication companion" description="Keep your medication list accurate and current.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{editingId ? "Edit medication" : "Add a medication"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.drug_name.trim().length < 2) {
                  toast.error("Enter the medication name.");
                  return;
                }
                saveMed.mutate();
              }}
            >
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="drug">Medication</Label>
                <Input
                  id="drug"
                  value={form.drug_name}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, drug_name: e.target.value })}
                  placeholder="Metformin"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dosage">Dosage</Label>
                <Input
                  id="dosage"
                  value={form.dosage}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                  placeholder="500 mg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="freq">Frequency</Label>
                <Input
                  id="freq"
                  value={form.frequency}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  placeholder="Twice daily"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start">Start date</Label>
                <Input
                  id="start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end">End date</Label>
                <Input
                  id="end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" className="rounded-xl" disabled={saveMed.isPending}>
                  {editingId ? "Save changes" : "Add medication"}
                </Button>
                {editingId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Your medications</CardTitle>
          </CardHeader>
          <CardContent>
            {medsQ.isLoading ? (
              <ListSkeleton />
            ) : (medsQ.data?.length ?? 0) === 0 ? (
              <EmptyState title="No medications yet" hint="Add your first medication to get started." />
            ) : (
              <ul className="space-y-3">
                {medsQ.data!.map((m) => (
                  <li key={m.id} className="rounded-2xl border border-border px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {m.drug_name} {m.dosage ? <span className="text-muted-foreground">· {m.dosage}</span> : null}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {m.frequency ?? "No schedule"} · started {formatDate(m.start_date)}
                        </p>
                      </div>
                      <Badge variant={m.active ? "default" : "secondary"}>
                        {m.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => {
                          setEditingId(m.id);
                          setForm({
                            drug_name: m.drug_name,
                            dosage: m.dosage ?? "",
                            frequency: m.frequency ?? "",
                            start_date: m.start_date ?? today(),
                            end_date: m.end_date ?? "",
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => toggleActive.mutate(m)}
                      >
                        {m.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle>This week's adherence</CardTitle>
          </CardHeader>
          <CardContent>
            {activeMeds.length === 0 ? (
              <EmptyState title="No active medications" hint="Add one to track your weekly doses." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-125 text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Medication</th>
                      {DAYS.map((d) => (
                        <th key={d} className="pb-2 text-center font-medium">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeMeds.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="py-3 pr-3 font-medium">{m.drug_name}</td>
                        {DAYS.map((d) => {
                          const key = `${m.id}-${d}`;
                          return (
                            <td key={d} className="py-3 text-center">
                              <Checkbox
                                checked={!!adherence[key]}
                                aria-label={`${m.drug_name} ${d}`}
                                onCheckedChange={(v) =>
                                  setAdherence((prev) => ({ ...prev, [key]: v === true }))
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle>Report a side effect</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!sideEffectMed || sideEffect.trim().length < 3) {
                  toast.error("Pick a medication and describe what you noticed.");
                  return;
                }
                reportSideEffect.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="semed">Medication</Label>
                <select
                  id="semed"
                  value={sideEffectMed}
                  onChange={(e) => setSideEffectMed(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">Select…</option>
                  {(medsQ.data ?? []).map((m) => (
                    <option key={m.id} value={m.drug_name}>
                      {m.drug_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sedesc">What did you notice?</Label>
                <Textarea
                  id="sedesc"
                  value={sideEffect}
                  maxLength={1000}
                  onChange={(e) => setSideEffect(e.target.value)}
                  placeholder="Nausea about an hour after each dose"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="rounded-xl" disabled={reportSideEffect.isPending}>
                  Report side effect
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
