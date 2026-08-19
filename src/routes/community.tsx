import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import type { CommunityContent } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ListSkeleton } from "@/components/common";

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
      {q.isLoading ? (
        <ListSkeleton rows={4} />
      ) : (q.data?.length ?? 0) === 0 ? (
        <EmptyState title="No stories yet" hint="Check back soon for community content." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data!.map((c) => (
            <Card key={c.id} className="flex flex-col rounded-2xl">
              <CardHeader className="pb-2">
                <Badge variant="secondary" className="mb-2 w-fit">
                  Lived experience — not medical advice
                </Badge>
                <CardTitle className="text-base">{c.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <p className="text-sm text-muted-foreground">{c.excerpt ?? "No excerpt provided."}</p>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
