import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ShieldCheck, Stethoscope } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { InfoBanner } from "@/components/common";
import { today } from "@/lib/format";

export const Route = createFileRoute("/triage")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Photo triage — AI Health Companion" },
      {
        name: "description",
        content: "Share a photo and short description to get non-diagnostic next-step guidance.",
      },
      { property: "og:title", content: "Photo triage — AI Health Companion" },
      {
        property: "og:description",
        content: "Share a photo and short description to get non-diagnostic next-step guidance.",
      },
    ],
  }),
  component: TriagePage,
});

type Outcome = "doctor" | "monitor";

function TriagePage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();

  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState(4);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("symptoms").insert({
        patient_id: uid!,
        description: `Photo triage${fileName ? ` (${fileName})` : ""}: ${description.trim()}`,
        body_location: location.trim() || null,
        severity,
        onset_date: today(),
        source: "photo_triage",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOutcome(severity >= 6 ? "doctor" : "monitor");
      toast.success("Submitted", { description: "Saved to your symptom timeline." });
      void qc.invalidateQueries({ queryKey: ["symptoms", uid] });
      void qc.invalidateQueries({ queryKey: ["dashboard", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout title="Photo-based triage" description="A photo and a few words — we'll suggest a next step.">
      <div className="space-y-6">
        <InfoBanner>
          This tool never names a condition. It only suggests whether something is worth a doctor's
          look. This is guidance, not a diagnosis.
        </InfoBanner>

        {outcome ? (
          <Card
            className={`rounded-2xl ${outcome === "doctor" ? "border-primary" : "border-border"}`}
          >
            <CardContent className="space-y-3 py-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                {outcome === "doctor" ? (
                  <Stethoscope className="size-6" />
                ) : (
                  <ShieldCheck className="size-6" />
                )}
              </div>
              <h2 className="text-xl font-semibold">
                {outcome === "doctor" ? "Worth a doctor's look" : "Common, monitor"}
              </h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                {outcome === "doctor"
                  ? "Based on what you shared, we suggest booking time with a clinician. Your entry has been saved so you can show it to them."
                  : "Nothing here suggests urgency. Keep an eye on it and check back in if it changes."}
              </p>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setOutcome(null);
                  setPreview(null);
                  setFileName(null);
                  setDescription("");
                  setLocation("");
                  setSeverity(4);
                }}
              >
                Submit another
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>New triage submission</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (description.trim().length < 3) {
                    toast.error("Add a short description.");
                    return;
                  }
                  submit.mutate();
                }}
              >
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="photo">Photo</Label>
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setFileName(file.name);
                      setPreview(URL.createObjectURL(file));
                    }}
                  />
                  {preview ? (
                    <img
                      src={preview}
                      alt="Selected area of concern"
                      className="mt-3 max-h-64 rounded-2xl border border-border object-contain"
                    />
                  ) : (
                    <p className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                      <Camera className="size-4" /> Photos stay on your device; only your description
                      is saved.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="tdesc">Short description</Label>
                  <Textarea
                    id="tdesc"
                    value={description}
                    maxLength={1000}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Red patch on my forearm, slightly itchy, appeared two days ago"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tloc">Body location</Label>
                  <Input
                    id="tloc"
                    value={location}
                    maxLength={120}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Left forearm"
                  />
                </div>
                <div className="space-y-3">
                  <Label>How much is it bothering you? {severity}/10</Label>
                  <Slider
                    value={[severity]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={(v) => setSeverity(v[0] ?? 4)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" className="rounded-xl" disabled={submit.isPending}>
                    {submit.isPending ? "Submitting…" : "Submit for triage"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
