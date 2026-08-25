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

import { Switch } from "@/components/ui/switch";
import { EmptyState, ListSkeleton } from "@/components/common";
import { formatDate, today } from "@/lib/format";

type Recurrence = "daily" | "once";

type MedicationReminder = {
  id: string;
  medication_id: string;
  patient_id: string;
  time_of_day: string;
  label: string | null;
  active: boolean;
  recurrence: Recurrence | null;
  created_at?: string | null;
};

type ReminderLog = {
  id: string;
  reminder_id: string;
  medication_id: string;
  patient_id: string;
  scheduled_for: string;
  confirmed_at: string | null;
};

function lastSevenDays() {
  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
    });
  }
  return days;
}

function localDayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  const [sideEffectMed, setSideEffectMed] = useState("");
  const [sideEffect, setSideEffect] = useState("");
  const [reminderDrafts, setReminderDrafts] = useState<
    Record<string, { time: string; label: string; recurrence: Recurrence }>
  >({});


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
    mutationFn: async (vars: {
      medicationId: string;
      time: string;
      label: string;
      recurrence: Recurrence;
    }) => {
      const { error } = await supabase.from("medication_reminders").insert({
        patient_id: uid!,
        medication_id: vars.medicationId,
        time_of_day: vars.time.length === 5 ? `${vars.time}:00` : vars.time,
        label: vars.label.trim() || null,
        recurrence: vars.recurrence,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Reminder added");
      setReminderDrafts((prev) => ({
        ...prev,
        [vars.medicationId]: { time: "", label: "", recurrence: "daily" },
      }));
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

  const days = lastSevenDays();

  const logsQ = useQuery({
    enabled: !!uid,
    queryKey: ["medication_reminder_logs", uid],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data, error } = await supabase
        .from("medication_reminder_logs")
        .select("*")
        .eq("patient_id", uid!)
        .gte("scheduled_for", since.toISOString())
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReminderLog[];
    },
  });

  const medNameById = new Map((medsQ.data ?? []).map((m) => [m.id, m.drug_name]));

  const adherenceRows = (remindersQ.data ?? [])
    .filter((r) => medNameById.has(r.medication_id))
    .map((r) => {
      const byDay: Record<string, ReminderLog | undefined> = {};
      for (const log of logsQ.data ?? []) {
        if (log.reminder_id !== r.id) continue;
        const key = localDayKey(log.scheduled_for);
        const existing = byDay[key];
        if (!existing || (!existing.confirmed_at && log.confirmed_at)) byDay[key] = log;
      }
      return { reminder: r, drugName: medNameById.get(r.medication_id) ?? "Medication", byDay };
    });


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
            <CardTitle>Medication reminders</CardTitle>
            <p className="text-sm text-muted-foreground">
              We'll email you at each scheduled time asking if you've taken your dose — no need to log in
              to confirm, just click Yes in the email.
            </p>
            <p className="text-sm text-muted-foreground">
              We check every 5 minutes, so it may take up to 5 minutes after the scheduled time for the
              email to arrive.
            </p>
          </CardHeader>
          <CardContent>
            {activeMeds.length === 0 ? (
              <EmptyState title="Add a medication above to set reminders" />
            ) : (
              <div className="space-y-5">
                {activeMeds.map((m) => {
                  const reminders = remindersByMed[m.id] ?? [];
                  const draft = reminderDrafts[m.id] ?? {
                    time: "",
                    label: "",
                    recurrence: "daily" as Recurrence,
                  };
                  return (
                    <div key={m.id} className="rounded-2xl border border-border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="font-medium">{m.drug_name}</p>
                        <span className="text-xs font-medium text-muted-foreground">Reminders</span>
                      </div>
                      {reminders.length === 0 ? (
                        <p className="mb-3 text-sm text-muted-foreground">No reminders yet for this medication.</p>
                      ) : (
                        <ul className="mb-3 space-y-2">
                          {reminders.map((r) => (
                            <li
                              key={r.id}
                              className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{formatTimeOfDay(r.time_of_day)}</p>
                                  <Badge variant="secondary">
                                    {r.recurrence === "once" ? "One-time" : "Daily"}
                                  </Badge>
                                </div>
                                {r.label ? <p className="text-xs text-muted-foreground">{r.label}</p> : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={r.active}
                                  onCheckedChange={() => toggleReminder.mutate(r)}
                                  aria-label={`Toggle reminder for ${m.drug_name} at ${formatTimeOfDay(r.time_of_day)}`}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-xl text-destructive"
                                  onClick={() => deleteReminder.mutate(r.id)}
                                  disabled={deleteReminder.isPending}
                                >
                                  Delete
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <form
                        className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!draft.time) {
                            toast.error("Pick a time for the reminder.");
                            return;
                          }
                          addReminder.mutate({
                            medicationId: m.id,
                            time: draft.time,
                            label: draft.label,
                            recurrence: draft.recurrence,
                          });
                        }}
                      >
                        <div className="space-y-1.5 sm:w-40">
                          <Label htmlFor={`time-${m.id}`}>Time</Label>
                          <Input
                            id={`time-${m.id}`}
                            type="time"
                            value={draft.time}
                            onChange={(e) =>
                              setReminderDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...draft, time: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <Label htmlFor={`label-${m.id}`}>Label (optional)</Label>
                          <Input
                            id={`label-${m.id}`}
                            value={draft.label}
                            maxLength={80}
                            placeholder="e.g., with breakfast"
                            onChange={(e) =>
                              setReminderDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...draft, label: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5 sm:w-36">
                          <Label htmlFor={`rec-${m.id}`}>Repeats</Label>
                          <select
                            id={`rec-${m.id}`}
                            value={draft.recurrence}
                            onChange={(e) =>
                              setReminderDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...draft, recurrence: e.target.value as Recurrence },
                              }))
                            }
                            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                          >
                            <option value="daily">Daily</option>
                            <option value="once">One-time</option>
                          </select>
                        </div>
                        <Button
                          type="submit"
                          className="rounded-xl"
                          disabled={addReminder.isPending || !draft.time}
                        >
                          Add reminder
                        </Button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle>This week's adherence</CardTitle>
            <p className="text-sm text-muted-foreground">
              Based on the reminder emails you've confirmed over the last 7 days.
            </p>
          </CardHeader>
          <CardContent>
            {logsQ.isLoading || remindersQ.isLoading ? (
              <ListSkeleton />
            ) : adherenceRows.length === 0 ? (
              <EmptyState
                title="No reminders scheduled yet"
                hint="Add a reminder above and your confirmations will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-125 text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Dose</th>
                      {days.map((d) => (
                        <th key={d.key} className="pb-2 text-center font-medium">
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adherenceRows.map((row) => (
                      <tr key={row.reminder.id} className="border-t border-border">
                        <td className="py-3 pr-3">
                          <p className="font-medium">{row.drugName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeOfDay(row.reminder.time_of_day)}
                            {row.reminder.label ? ` · ${row.reminder.label}` : ""}
                          </p>
                        </td>
                        {days.map((d) => {
                          const log = row.byDay[d.key];
                          const taken = !!log?.confirmed_at;
                          return (
                            <td key={d.key} className="py-3 text-center">
                              {!log ? (
                                <span className="text-muted-foreground" aria-label="No dose scheduled">
                                  ·
                                </span>
                              ) : taken ? (
                                <span className="text-primary" aria-label="Taken">
                                  ✓
                                </span>
                              ) : (
                                <span className="text-muted-foreground" aria-label="Not yet confirmed">
                                  ○
                                </span>
                              )}
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
