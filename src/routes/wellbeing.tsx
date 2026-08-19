import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { HeartHandshake } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { WellbeingCheckin } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { EmptyState, ListSkeleton } from "@/components/common";

export const Route = createFileRoute("/wellbeing")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Wellbeing check-in — AI Health Companion" },
      { name: "description", content: "Log your daily mood, add notes and watch your trend over time." },
      { property: "og:title", content: "Wellbeing check-in — AI Health Companion" },
      {
        property: "og:description",
        content: "Log your daily mood, add notes and watch your trend over time.",
      },
    ],
  }),
  component: WellbeingPage,
});

function WellbeingPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();

  const [mood, setMood] = useState(6);
  const [notes, setNotes] = useState("");
  const [showSupport, setShowSupport] = useState(false);

  const q = useQuery({
    enabled: !!uid,
    queryKey: ["checkins", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellbeing_checkins")
        .select("*")
        .eq("patient_id", uid!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as WellbeingCheckin[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wellbeing_checkins").insert({
        patient_id: uid!,
        mood_rating: mood,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      if (mood <= 3) {
        const severity = mood <= 1 ? "high" : mood === 2 ? "moderate" : "low";
        const { error: escError } = await supabase.from("crisis_escalations").insert({
          patient_id: uid!,
          severity,
          status: "open",
        });
        if (escError) throw escError;
      }
    },
    onSuccess: () => {
      toast.success("Check-in saved");
      setShowSupport(mood <= 3);
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["checkins", uid] });
      void qc.invalidateQueries({ queryKey: ["dashboard", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chartData = (q.data ?? [])
    .slice()
    .reverse()
    .map((c) => ({
      date: new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      mood: c.mood_rating,
    }));

  return (
    <AppLayout title="Wellbeing check-in" description="A minute a day helps you spot patterns.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>How are you feeling today?</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div className="space-y-3">
                <Label>Mood: {mood}/10</Label>
                <Slider
                  value={[mood]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={(v) => setMood(v[0] ?? 6)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Anything you want to note?</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  maxLength={1000}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Slept badly, but the walk helped."
                />
              </div>
              <Button type="submit" className="rounded-xl" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save check-in"}
              </Button>
            </form>

            {showSupport ? (
              <Card className="mt-6 rounded-2xl border-primary/40 bg-accent/40">
                <CardContent className="space-y-2 py-5">
                  <p className="flex items-center gap-2 font-medium text-accent-foreground">
                    <HeartHandshake className="size-5" /> You don't have to carry this alone
                  </p>
                  <p className="text-sm text-accent-foreground/90">
                    Low days happen, and support is available whenever you want it. Talking to
                    someone you trust, your doctor, or a local support line can help. Your care team
                    has been gently notified so they can check in.
                  </p>
                  <ul className="list-disc pl-5 text-sm text-accent-foreground/90">
                    <li>Reach out to a trusted friend or family member today.</li>
                    <li>Contact your doctor or a local mental-health support line.</li>
                    <li>If you're in immediate danger, call your local emergency number.</li>
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Your trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {q.isLoading ? (
              <ListSkeleton rows={2} />
            ) : chartData.length === 0 ? (
              <EmptyState title="No check-ins yet" hint="Save your first check-in to see a trend." />
            ) : (
              <>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 10]} fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="mood"
                        stroke="var(--color-primary)"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2">
                  {q.data!.slice(0, 8).map((c) => (
                    <li key={c.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                      <span className="font-medium">{c.mood_rating}/10</span>{" "}
                      <span className="text-muted-foreground">
                        · {new Date(c.created_at).toLocaleDateString()}
                      </span>
                      {c.notes ? <p className="text-muted-foreground">{c.notes}</p> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
