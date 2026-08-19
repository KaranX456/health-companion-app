import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { DoctorLink } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState, InfoBanner, ListSkeleton } from "@/components/common";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/care-team")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Care team — AI Health Companion" },
      { name: "description", content: "Authorize doctors to view your record, and revoke access anytime." },
      { property: "og:title", content: "Care team — AI Health Companion" },
      {
        property: "og:description",
        content: "Authorize doctors to view your record, and revoke access anytime.",
      },
    ],
  }),
  component: CareTeamPage,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function CareTeamPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const [doctorId, setDoctorId] = useState("");

  const q = useQuery({
    enabled: !!uid,
    queryKey: ["care-team", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_patient_links")
        .select("id, patient_id, doctor_id, status, authorized_at, doctors(full_name)")
        .eq("patient_id", uid!)
        .order("authorized_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DoctorLink[];
    },
  });

  const authorize = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("doctor_patient_links").insert({
        patient_id: uid!,
        doctor_id: doctorId.trim(),
        status: "active",
        authorized_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Doctor authorized");
      setDoctorId("");
      void qc.invalidateQueries({ queryKey: ["care-team", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("doctor_patient_links")
        .update({ status: "revoked" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access revoked");
      void qc.invalidateQueries({ queryKey: ["care-team", uid] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppLayout title="Care team" description="You decide who can see your health record.">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <InfoBanner>
            Ask your doctor for their provider ID. You can revoke access at any time — they lose
            access immediately.
          </InfoBanner>
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Authorize a doctor</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!UUID_RE.test(doctorId.trim())) {
                    toast.error("Enter a valid doctor ID.");
                    return;
                  }
                  authorize.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="docid">Doctor ID</Label>
                  <Input
                    id="docid"
                    value={doctorId}
                    maxLength={64}
                    onChange={(e) => setDoctorId(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                  />
                </div>
                <Button type="submit" className="rounded-xl" disabled={authorize.isPending}>
                  Authorize access
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Authorized doctors</CardTitle>
          </CardHeader>
          <CardContent>
            {q.isLoading ? (
              <ListSkeleton rows={2} />
            ) : (q.data?.length ?? 0) === 0 ? (
              <EmptyState title="No doctors linked" hint="Authorize a doctor to share your record." />
            ) : (
              <ul className="space-y-3">
                {q.data!.map((link) => (
                  <li key={link.id} className="rounded-2xl border border-border px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{link.doctors?.full_name ?? "Doctor"}</p>
                        <p className="text-xs text-muted-foreground">
                          {link.doctor_id} · authorized {formatDate(link.authorized_at)}
                        </p>
                      </div>
                      <Badge variant={link.status === "active" ? "default" : "secondary"}>
                        {link.status}
                      </Badge>
                    </div>
                    {link.status === "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 rounded-xl"
                        onClick={() => revoke.mutate(link.id)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
