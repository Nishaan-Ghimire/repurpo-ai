import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({ component: AccountPage });

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      setName(data?.full_name ?? "");
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved!");
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Account</h1>
      <div className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div>
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div>
          <Label htmlFor="fn">Full name</Label>
          <Input id="fn" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button onClick={save} disabled={busy} className="bg-gradient-primary shadow-glow">
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
      <Button
        variant="outline"
        className="mt-6"
        onClick={async () => { await signOut(); navigate({ to: "/" }); }}
      >
        Sign out
      </Button>
    </div>
  );
}
