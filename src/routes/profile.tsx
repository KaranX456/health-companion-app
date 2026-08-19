import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Allergy, LabResult, MedicalHistory } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ListSkeleton } from "@/components/common";
import { formatDate, titleCase, today } from "@/lib/format";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Medical profile — AI Health Companion" },
      { name: "description", content: "Keep your conditions, allergies and lab results up to date." },
      { property: "og:title", content: "Medical profile — AI Health Companion" },
      {
        property: "og:description",
        content: "Keep your conditions, allergies and lab results up to date.",
      },
    ],
  }),
  component: ProfilePage,
});

const HISTORY_STATUS = ["active", "chronic", "resolved"] as const;
const SEVERITIES = ["mild", "moderate", "severe", "life_threatening"] as const;

function selectClass() {
  return "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
}

function ProfilePage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();

  /* ---------- medical history ---------- */
  const [hist, setHist] = useState({
    condition_name: "",
    icd10_code: "",
    status: "active" as (typeof HISTORY_STATUS)[number],
    diagnosed_date: today(),
    notes: "",
  });
  const [histEditId, setHistEditId] = useState<string | null>(null);

  const historyQ = useQuery({
    enabled: !!uid,
    queryKey: ["history", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_history")
        .select("*")
        .eq("patient_id", uid!);
      if (error) throw error;
      return (data ?? []) as MedicalHistory[];
    },
  });

  const saveHistory = useMutation({
    mutationFn: async () => {
      const payload = {
        patient_id: uid!,
        condition_name: hist.condition_name.trim(),
        icd10_code: hist.icd10_code.trim() || null,
        status: hist.status,
        diagnosed_date: hist.diagnosed_date || null,
        notes: hist.notes.trim() || null,
      };
      const { error } = histEditId
        ? await supabase.from("medical_history").update(payload).eq("id", histEditId)
        : await supabase.from("medical_history").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(histEditId ? "Condition updated" : "Condition added");
      setHistEditId(null);
      setHist({ condition_name: "", icd10_code: "", status: "active", diagnosed_date: today(), notes: "" });
      void qc.invalidateQueries({ queryKey: ["history", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteHistory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medical_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Condition removed");
      void qc.invalidateQueries({ queryKey: ["history", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------- allergies ---------- */
  const [allergy, setAllergy] = useState({
    allergen: "",
    reaction: "",
    severity: "mild" as (typeof SEVERITIES)[number],
  });
  const [allergyEditId, setAllergyEditId] = useState<string | null>(null);

  const allergyQ = useQuery({
    enabled: !!uid,
    queryKey: ["allergies", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("allergies").select("*").eq("patient_id", uid!);
      if (error) throw error;
      return (data ?? []) as Allergy[];
    },
  });

  const saveAllergy = useMutation({
    mutationFn: async () => {
      const payload = {
        patient_id: uid!,
        allergen: allergy.allergen.trim(),
        reaction: allergy.reaction.trim() || null,
        severity: allergy.severity,
      };
      const { error } = allergyEditId
        ? await supabase.from("allergies").update(payload).eq("id", allergyEditId)
        : await supabase.from("allergies").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(allergyEditId ? "Allergy updated" : "Allergy added");
      setAllergyEditId(null);
      setAllergy({ allergen: "", reaction: "", severity: "mild" });
      void qc.invalidateQueries({ queryKey: ["allergies", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAllergy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("allergies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Allergy removed");
      void qc.invalidateQueries({ queryKey: ["allergies", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------- labs ---------- */
  const [lab, setLab] = useState({
    test_name: "",
    value: "",
    unit: "",
    reference_range: "",
  });
  const [labPhoto, setLabPhoto] = useState<string | null>(null);
  const [labEditId, setLabEditId] = useState<string | null>(null);

  const labQ = useQuery({
    enabled: !!uid,
    queryKey: ["labs", uid],
    queryFn: async () => {
      const { data, error } = await supabase.from("lab_results").select("*").eq("patient_id", uid!);
      if (error) throw error;
      return (data ?? []) as LabResult[];
    },
  });

  const saveLab = useMutation({
    mutationFn: async (fromPhoto: boolean) => {
      const payload = {
        patient_id: uid!,
        test_name: lab.test_name.trim(),
        value: lab.value.trim() || null,
        unit: lab.unit.trim() || null,
        reference_range: lab.reference_range.trim() || null,
        ingestion_path: fromPhoto ? "photo_ocr" : "manual",
        reviewed_and_corrected: !fromPhoto,
      };
      const { error } = labEditId
        ? await supabase.from("lab_results").update(payload).eq("id", labEditId)
        : await supabase.from("lab_results").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(labEditId ? "Lab result updated" : "Lab result added");
      setLabEditId(null);
      setLabPhoto(null);
      setLab({ test_name: "", value: "", unit: "", reference_range: "" });
      void qc.invalidateQueries({ queryKey: ["labs", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmLab = useMutation({
    mutationFn: async (row: LabResult) => {
      const { error } = await supabase
        .from("lab_results")
        .update({ reviewed_and_corrected: true })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Value confirmed");
      void qc.invalidateQueries({ queryKey: ["labs", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLab = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lab_results").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lab result removed");
      void qc.invalidateQueries({ queryKey: ["labs", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout title="Medical profile" description="Conditions, allergies and lab results.">
      <Tabs defaultValue="history" className="space-y-6">
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="allergies">Allergies</TabsTrigger>
          <TabsTrigger value="labs">Lab results</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>{histEditId ? "Edit condition" : "Add a condition"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (hist.condition_name.trim().length < 2) {
                    toast.error("Enter the condition name.");
                    return;
                  }
                  saveHistory.mutate();
                }}
              >
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cond">Condition</Label>
                  <Input
                    id="cond"
                    value={hist.condition_name}
                    maxLength={140}
                    onChange={(e) => setHist({ ...hist, condition_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="icd">ICD-10 code</Label>
                  <Input
                    id="icd"
                    value={hist.icd10_code}
                    maxLength={16}
                    onChange={(e) => setHist({ ...hist, icd10_code: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hstatus">Status</Label>
                  <select
                    id="hstatus"
                    className={selectClass()}
                    value={hist.status}
                    onChange={(e) =>
                      setHist({ ...hist, status: e.target.value as (typeof HISTORY_STATUS)[number] })
                    }
                  >
                    {HISTORY_STATUS.map((s) => (
                      <option key={s} value={s}>
                        {titleCase(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ddate">Diagnosed</Label>
                  <Input
                    id="ddate"
                    type="date"
                    value={hist.diagnosed_date}
                    onChange={(e) => setHist({ ...hist, diagnosed_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="hnotes">Notes</Label>
                  <Textarea
                    id="hnotes"
                    value={hist.notes}
                    maxLength={1000}
                    onChange={(e) => setHist({ ...hist, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" className="rounded-xl" disabled={saveHistory.isPending}>
                    {histEditId ? "Save changes" : "Add condition"}
                  </Button>
                  {histEditId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl"
                      onClick={() => {
                        setHistEditId(null);
                        setHist({
                          condition_name: "",
                          icd10_code: "",
                          status: "active",
                          diagnosed_date: today(),
                          notes: "",
                        });
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
              <CardTitle>Your conditions</CardTitle>
            </CardHeader>
            <CardContent>
              {historyQ.isLoading ? (
                <ListSkeleton rows={2} />
              ) : (historyQ.data?.length ?? 0) === 0 ? (
                <EmptyState title="No conditions recorded" />
              ) : (
                <ul className="space-y-3">
                  {historyQ.data!.map((h) => (
                    <li key={h.id} className="rounded-2xl border border-border px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {h.condition_name}
                          {h.icd10_code ? (
                            <span className="text-muted-foreground"> · {h.icd10_code}</span>
                          ) : null}
                        </p>
                        <Badge variant="secondary">{titleCase(h.status)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Diagnosed {formatDate(h.diagnosed_date)}
                      </p>
                      {h.notes ? <p className="mt-1 text-sm">{h.notes}</p> : null}
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            setHistEditId(h.id);
                            setHist({
                              condition_name: h.condition_name,
                              icd10_code: h.icd10_code ?? "",
                              status: h.status,
                              diagnosed_date: h.diagnosed_date ?? today(),
                              notes: h.notes ?? "",
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl"
                          onClick={() => deleteHistory.mutate(h.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allergies" className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>{allergyEditId ? "Edit allergy" : "Add an allergy"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (allergy.allergen.trim().length < 2) {
                    toast.error("Enter the allergen.");
                    return;
                  }
                  saveAllergy.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="allergen">Allergen</Label>
                  <Input
                    id="allergen"
                    value={allergy.allergen}
                    maxLength={120}
                    onChange={(e) => setAllergy({ ...allergy, allergen: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="asev">Severity</Label>
                  <select
                    id="asev"
                    className={selectClass()}
                    value={allergy.severity}
                    onChange={(e) =>
                      setAllergy({ ...allergy, severity: e.target.value as (typeof SEVERITIES)[number] })
                    }
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {titleCase(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="reaction">Reaction</Label>
                  <Input
                    id="reaction"
                    value={allergy.reaction}
                    maxLength={200}
                    onChange={(e) => setAllergy({ ...allergy, reaction: e.target.value })}
                    placeholder="Hives, swelling…"
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" className="rounded-xl" disabled={saveAllergy.isPending}>
                    {allergyEditId ? "Save changes" : "Add allergy"}
                  </Button>
                  {allergyEditId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl"
                      onClick={() => {
                        setAllergyEditId(null);
                        setAllergy({ allergen: "", reaction: "", severity: "mild" });
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
              <CardTitle>Your allergies</CardTitle>
            </CardHeader>
            <CardContent>
              {allergyQ.isLoading ? (
                <ListSkeleton rows={2} />
              ) : (allergyQ.data?.length ?? 0) === 0 ? (
                <EmptyState title="No allergies recorded" />
              ) : (
                <ul className="space-y-3">
                  {allergyQ.data!.map((a) => (
                    <li key={a.id} className="rounded-2xl border border-border px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{a.allergen}</p>
                        <Badge
                          variant={
                            a.severity === "severe" || a.severity === "life_threatening"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {titleCase(a.severity)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{a.reaction ?? "Reaction not recorded"}</p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            setAllergyEditId(a.id);
                            setAllergy({
                              allergen: a.allergen,
                              reaction: a.reaction ?? "",
                              severity: a.severity,
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl"
                          onClick={() => deleteAllergy.mutate(a.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labs" className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>{labEditId ? "Edit lab result" : "Add a lab result"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (lab.test_name.trim().length < 2) {
                    toast.error("Enter the test name.");
                    return;
                  }
                  saveLab.mutate(!!labPhoto);
                }}
              >
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="labphoto">Photo of your lab report (optional)</Label>
                  <Input
                    id="labphoto"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLabPhoto(URL.createObjectURL(file));
                      toast.info("Type the values you see, then confirm them below.");
                    }}
                  />
                  {labPhoto ? (
                    <img
                      src={labPhoto}
                      alt="Lab report"
                      className="mt-3 max-h-56 rounded-2xl border border-border object-contain"
                    />
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="test">Test name</Label>
                  <Input
                    id="test"
                    value={lab.test_name}
                    maxLength={140}
                    onChange={(e) => setLab({ ...lab, test_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="val">Value</Label>
                  <Input
                    id="val"
                    value={lab.value}
                    maxLength={60}
                    onChange={(e) => setLab({ ...lab, value: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={lab.unit}
                    maxLength={40}
                    onChange={(e) => setLab({ ...lab, unit: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="range">Reference range</Label>
                  <Input
                    id="range"
                    value={lab.reference_range}
                    maxLength={60}
                    onChange={(e) => setLab({ ...lab, reference_range: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" className="rounded-xl" disabled={saveLab.isPending}>
                    {labEditId ? "Save changes" : "Add lab result"}
                  </Button>
                  {labEditId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl"
                      onClick={() => {
                        setLabEditId(null);
                        setLabPhoto(null);
                        setLab({ test_name: "", value: "", unit: "", reference_range: "" });
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
              <CardTitle>Your lab results</CardTitle>
            </CardHeader>
            <CardContent>
              {labQ.isLoading ? (
                <ListSkeleton rows={2} />
              ) : (labQ.data?.length ?? 0) === 0 ? (
                <EmptyState title="No lab results recorded" />
              ) : (
                <ul className="space-y-3">
                  {labQ.data!.map((l) => (
                    <li key={l.id} className="rounded-2xl border border-border px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {l.test_name}: {l.value ?? "—"} {l.unit ?? ""}
                        </p>
                        <Badge variant={l.reviewed_and_corrected ? "default" : "secondary"}>
                          {l.reviewed_and_corrected ? "Confirmed" : "Needs review"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Reference {l.reference_range ?? "—"} · {titleCase(l.ingestion_path)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!l.reviewed_and_corrected ? (
                          <Button
                            size="sm"
                            className="rounded-xl"
                            onClick={() => confirmLab.mutate(l)}
                          >
                            Confirm value
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            setLabEditId(l.id);
                            setLab({
                              test_name: l.test_name,
                              value: l.value ?? "",
                              unit: l.unit ?? "",
                              reference_range: l.reference_range ?? "",
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl"
                          onClick={() => deleteLab.mutate(l.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
