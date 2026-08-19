import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { DifferentialDiagnosis } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, InfoBanner, ListSkeleton } from "@/components/common";
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/guidance")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Guidance — AI Health Companion" },
      { name: "description", content: "Plain-language next steps from your care record. Guidance, not a diagnosis." },
      { property: "og:title", content: "Guidance — AI Health Companion" },
      {
        property: "og:description",
        content: "Plain-language next steps from your care record. Guidance, not a diagnosis.",
      },
    ],
  }),
  component: GuidancePage,
});

const URGENCY_TEXT: Record<DifferentialDiagnosis["urgency"], string> = {
  emergency: "Seek emergency care now",
  same_day: "See a doctor today",
  scheduled_visit: "Schedule a visit soon",
  monitor: "Keep monitoring",
};

function GuidancePage() {
  const { user } = useAuth();
  const uid = user?.id;

  const q = useQuery({
    enabled: !!uid,
    queryKey: ["differentials", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("differential_diagnoses")
        .select("*")
        .eq("patient_id", uid!)
        .order("rank", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DifferentialDiagnosis[];
    },
  });

  return (
    <AppLayout title="Guidance" description="What to do next, in plain language.">
      <div className="space-y-6">
        <InfoBanner>
          <strong>This is guidance, not a diagnosis.</strong> Only your doctor can diagnose you.
        </InfoBanner>

        {q.isLoading ? (
          <ListSkeleton />
        ) : (q.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No guidance yet"
            hint="Guidance appears here once your care team has reviewed your record."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {q.data!.map((d) => (
              <Card key={d.id} className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {d.disclosed_to_patient && d.condition_name
                      ? d.condition_name
                      : "Next step for you"}
                    {d.disclosed_to_patient && d.confidence_tier ? (
                      <Badge variant="secondary">{titleCase(d.confidence_tier)}</Badge>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-lg font-medium text-primary">{URGENCY_TEXT[d.urgency]}</p>
                  {d.disclosed_to_patient ? (
                    <p className="text-sm text-muted-foreground">
                      Shared with you by your care team{d.doctor_confirmed ? " and confirmed by a doctor" : ""}.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Details are still being reviewed by your care team. For now, follow the step above.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
