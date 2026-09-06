import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { PrepQuestion, Symptom } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, ListSkeleton } from "@/components/common";
import { Section } from "@/components/Section";

export const Route = createFileRoute("/prep")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Appointment prep — AI Health Companion" },
      { name: "description", content: "Walk into your appointment with the right questions ready." },
      { property: "og:title", content: "Appointment prep — AI Health Companion" },
      {
        property: "og:description",
        content: "Walk into your appointment with the right questions ready.",
      },
    ],
  }),
  component: PrepPage,
});

function PrepPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [done, setDone] = useState<Record<string, boolean>>({});

  const q = useQuery({
    enabled: !!uid,
    queryKey: ["prep", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_prep_questions")
        .select("*")
        .eq("patient_id", uid!);
      if (error) throw error;
      return (data ?? []) as PrepQuestion[];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data: symptoms, error: sErr } = await supabase
        .from("symptoms")
        .select("*")
        .eq("patient_id", uid!)
        .order("onset_date", { ascending: false })
        .limit(1);
      if (sErr) throw sErr;
      const latest = (symptoms?.[0] ?? null) as Symptom | null;
      const topic = latest ? latest.description : "my overall health";
      const rows = [
        {
          patient_id: uid!,
          question: `What could be causing ${topic}, and what should I watch for?`,
          based_on_symptom_id: latest?.id ?? null,
        },
        {
          patient_id: uid!,
          question: `Are there tests or treatments we should consider for ${topic}?`,
          based_on_symptom_id: latest?.id ?? null,
        },
      ];
      const { error } = await supabase.from("appointment_prep_questions").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Questions added");
      void qc.invalidateQueries({ queryKey: ["prep", uid] });
      void qc.invalidateQueries({ queryKey: ["dashboard", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout title="Appointment prep" description="Questions worth asking at your next visit.">
      <div className="space-y-6">
        <Section
          title="Questions for your next visit"
          action={
            <Button className="rounded-xl" onClick={() => generate.mutate()} disabled={generate.isPending}>
              <Sparkles className="size-4" />
              {generate.isPending ? "Generating…" : "Generate questions"}
            </Button>
          }
        >
            {q.isLoading ? (
              <ListSkeleton />
            ) : (q.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No questions yet"
                hint="Generate a couple based on your most recent symptom."
              />
            ) : (
              <ul className="divide-y divide-border">
                {q.data!.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                    <Checkbox
                      id={item.id}
                      checked={!!done[item.id]}
                      onCheckedChange={(v) => setDone((p) => ({ ...p, [item.id]: v === true }))}
                    />
                    <label
                      htmlFor={item.id}
                      className={`text-sm ${done[item.id] ? "text-muted-foreground line-through" : ""}`}
                    >
                      {item.question}
                    </label>
                  </li>
                ))}
              </ul>
            )}
        </Section>
      </div>
    </AppLayout>
  );
}
