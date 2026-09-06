import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ArrowRight } from "lucide-react";
import { AppLayout, NAV } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Patient, WellbeingCheckin } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your health dashboard — AI Health Companion" },
      {
        name: "description",
        content:
          "See your medications, recent symptoms, mood trend and appointment prep at a glance.",
      },
      { property: "og:title", content: "Your health dashboard — AI Health Companion" },
      {
        property: "og:description",
        content: "See your medications, recent symptoms, mood trend and appointment prep at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data, isLoading } = useQuery({
    enabled: !!uid,
    queryKey: ["dashboard", uid],
    queryFn: async () => {
      const [patient, meds, symptoms, prep, checkins] = await Promise.all([
        supabase.from("patients").select("id, full_name, date_of_birth").eq("id", uid!).maybeSingle(),
        supabase.from("medications").select("id").eq("patient_id", uid!).eq("active", true),
        supabase.from("symptoms").select("id").eq("patient_id", uid!),
        supabase.from("appointment_prep_questions").select("id").eq("patient_id", uid!),
        supabase
          .from("wellbeing_checkins")
          .select("id, patient_id, mood_rating, notes, created_at")
          .eq("patient_id", uid!)
          .order("created_at", { ascending: false })
          .limit(14),
      ]);
      return {
        patient: (patient.data as Patient | null) ?? null,
        activeMeds: meds.data?.length ?? 0,
        symptomCount: symptoms.data?.length ?? 0,
        prepCount: prep.data?.length ?? 0,
        checkins: ((checkins.data as WellbeingCheckin[] | null) ?? []).slice().reverse(),
      };
    },
  });

  const chartData = (data?.checkins ?? []).map((c) => ({
    date: new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    mood: c.mood_rating,
  }));

  const firstName = data?.patient?.full_name?.split(" ")[0] ?? "there";

  return (
    <AppLayout title={`Hello, ${isLoading ? "…" : firstName}`} description="Here's your health at a glance.">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Active medications", value: data?.activeMeds },
            { label: "Logged symptoms", value: data?.symptomCount },
            { label: "Prep questions", value: data?.prepCount },
          ].map((stat) => (
            <Card key={stat.label} className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <p className="text-3xl font-semibold">{stat.value ?? 0}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Mood trend</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : chartData.length === 0 ? (
              <EmptyState
                title="No check-ins yet"
                hint="Log how you're feeling on the Wellbeing screen to build your trend."
              />
            ) : (
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
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Quick links</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NAV.filter((n) => n.to !== "/").map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:bg-accent/50"
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <item.icon className="size-4 text-primary" />
                  {item.label}
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
