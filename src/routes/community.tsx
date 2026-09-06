import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import type { CommunityContent } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ListSkeleton } from "@/components/common";
import { Section } from "@/components/Section";

export const Route = createFileRoute("/community")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Community stories — AI Health Companion" },
      {
        name: "description",
        content: "Lived-experience stories from other patients. Not medical advice.",
      },
      { property: "og:title", content: "Community stories — AI Health Companion" },
      {
        property: "og:description",
        content: "Lived-experience stories from other patients. Not medical advice.",
      },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const q = useQuery({
    queryKey: ["community"],
    queryFn: async () => {
      const { data, error } = await supabase.from("community_content").select("*").limit(60);
      if (error) throw error;
      return (data ?? []) as CommunityContent[];
    },
  });

  return (
    <AppLayout title="Community" description="Stories from people living with similar conditions.">
      <Section title="Community experiences">
      {q.isLoading ? (
        <ListSkeleton rows={4} />
      ) : (q.data?.length ?? 0) === 0 ? (
        <EmptyState title="No stories yet" hint="Check back soon for community content." />
      ) : (
        <div className="divide-y divide-border">
          {q.data!.map((c) => (
            <article key={c.id} className="grid gap-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <Badge variant="secondary" className="w-fit">
                  Lived experience — not medical advice
                </Badge>
                <h3 className="font-semibold">{c.title}</h3>
                <p className="text-sm text-muted-foreground">{c.excerpt ?? "No excerpt provided."}</p>
              </div>
                {c.source_ref ? (
                  <a
                    href={c.source_ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Read the source <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
            </article>
          ))}
        </div>
      )}
      </Section>
    </AppLayout>
  );
}
