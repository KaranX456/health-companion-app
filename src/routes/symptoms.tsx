import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Allergy, Medication, Symptom } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ListSkeleton } from "@/components/common";
import { formatDate, today } from "@/lib/format";

export const Route = createFileRoute("/symptoms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Symptom organizer — AI Health Companion" },
      { name: "description", content: "Log symptoms and build a pre-visit summary for your doctor." },
      { property: "og:title", content: "Symptom organizer — AI Health Companion" },
      {
        property: "og:description",
        content: "Log symptoms and build a pre-visit summary for your doctor.",
      },
    ],
  }),
  component: SymptomsPage,
});

function SymptomsPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();

  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState(5);
  const [onset, setOnset] = useState(today());

  const symptomsQ = useQuery({
    enabled: !!uid,
    queryKey: ["symptoms", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("symptoms")
        .select("*")
        .eq("patient_id", uid!)
        .order("onset_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Symptom[];
    },
  });

  const summaryQ = useQuery({
    enabled: !!uid,
    queryKey: ["previsit", uid],
    queryFn: async () => {
      const [meds, allergies] = await Promise.all([
        supabase.from("medications").select("*").eq("patient_id", uid!).eq("active", true),
        supabase.from("allergies").select("*").eq("patient_id", uid!),
      ]);
      return {
        meds: (meds.data ?? []) as Medication[],
        allergies: (allergies.data ?? []) as Allergy[],
      };
    },
  });

  const addSymptom = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("symptoms").insert({
        patient_id: uid!,
        description: description.trim(),
        body_location: location.trim() || null,
        severity,
        onset_date: onset,
        source: "patient_logged",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Symptom logged");
      setDescription("");
      setLocation("");
      setSeverity(5);
      setOnset(today());
      void qc.invalidateQueries({ queryKey: ["symptoms", uid] });
      void qc.invalidateQueries({ queryKey: ["dashboard", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout title="Symptom organizer" description="Log what you feel, when you feel it.">
      <Tabs defaultValue="log" className="space-y-6">
        <TabsList className="no-print">
          <TabsTrigger value="log">Log &amp; timeline</TabsTrigger>
          <TabsTrigger value="summary">Pre-visit summary</TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Log a symptom</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (description.trim().length < 3) {
                    toast.error("Please describe the symptom.");
                    return;
                  }
                  addSymptom.mutate();
                }}
              >
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="desc">What are you feeling?</Label>
                  <Textarea
                    id="desc"
                    value={description}
                    maxLength={1000}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Dull headache behind the eyes, worse in the afternoon"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc">Body location</Label>
                  <Input
                    id="loc"
                    value={location}
                    maxLength={120}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Head, left knee…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="onset">Onset date</Label>
                  <Input
                    id="onset"
                    type="date"
                    value={onset}
                    onChange={(e) => setOnset(e.target.value)}
                  />
                </div>
                <div className="space-y-3 sm:col-span-2">
                  <Label>Severity: {severity}/10</Label>
                  <Slider
                    value={[severity]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={(v) => setSeverity(v[0] ?? 5)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" className="rounded-xl" disabled={addSymptom.isPending}>
                    {addSymptom.isPending ? "Saving…" : "Add symptom"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {symptomsQ.isLoading ? (
                <ListSkeleton />
              ) : (symptomsQ.data?.length ?? 0) === 0 ? (
                <EmptyState title="No symptoms logged yet" hint="Your entries will appear here in order." />
              ) : (
                <ol className="space-y-3">
                  {symptomsQ.data!.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-2xl border border-border bg-card px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{s.description}</p>
                        <Badge variant="secondary">Severity {s.severity ?? "—"}/10</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(s.onset_date)}
                        {s.body_location ? ` · ${s.body_location}` : ""} · {s.source.replace(/_/g, " ")}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <div className="mb-4 no-print">
            <Button className="rounded-xl" onClick={() => window.print()}>
              <Printer className="size-4" /> Print summary
            </Button>
          </div>
          <Card className="print-area rounded-2xl">
            <CardHeader>
              <CardTitle>Pre-visit summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <section>
                <h3 className="mb-2 font-semibold">Recent symptoms</h3>
                {(symptomsQ.data?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground">None recorded.</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {symptomsQ.data!.slice(0, 10).map((s) => (
                      <li key={s.id}>
                        {s.description} — severity {s.severity ?? "—"}/10, from {formatDate(s.onset_date)}
                        {s.body_location ? ` (${s.body_location})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="mb-2 font-semibold">Active medications</h3>
                {(summaryQ.data?.meds.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground">None recorded.</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {summaryQ.data!.meds.map((m) => (
                      <li key={m.id}>
                        {m.drug_name} {m.dosage ?? ""} {m.frequency ? `· ${m.frequency}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="mb-2 font-semibold">Allergies</h3>
                {(summaryQ.data?.allergies.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground">None recorded.</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {summaryQ.data!.allergies.map((a) => (
                      <li key={a.id}>
                        {a.allergen} — {a.reaction ?? "reaction not recorded"} ({a.severity.replace(/_/g, " ")})
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
