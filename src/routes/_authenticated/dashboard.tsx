import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Upload, Mic, FileText, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ uploads: 0, voices: 0, assets: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [u, v, a] = await Promise.all([
        supabase.from("content_uploads").select("id", { count: "exact", head: true }),
        supabase.from("voice_profiles").select("id", { count: "exact", head: true }),
        supabase.from("generated_assets").select("id", { count: "exact", head: true }),
      ]);
      setStats({ uploads: u.count ?? 0, voices: v.count ?? 0, assets: a.count ?? 0 });
    })();
  }, [user]);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Welcome back 👋</h1>
      <p className="mt-1 text-muted-foreground">Let's turn your next idea into a week of content.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { label: "Uploads", value: stats.uploads },
          { label: "Voice profiles", value: stats.voices },
          { label: "Generated assets", value: stats.assets },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="mt-2 font-display text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <QuickAction to="/upload" icon={Upload} title="Upload content" body="Drop in audio, video or text" />
        <QuickAction to="/voice" icon={Mic} title="Train your voice" body="Paste examples to mimic your style" />
        <QuickAction to="/content" icon={FileText} title="View library" body="Browse generated assets" />
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-gradient-primary p-8 text-primary-foreground shadow-elegant">
        <Sparkles className="h-6 w-6" />
        <h2 className="mt-3 font-display text-2xl font-bold">Ready to generate?</h2>
        <p className="mt-1 opacity-90">Upload a transcript or audio file to get started.</p>
        <Button asChild className="mt-4" variant="secondary">
          <Link to="/upload">New upload <ArrowRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, title, body }: { to: "/upload" | "/voice" | "/content"; icon: any; title: string; body: string }) {
  return (
    <Link to={to} className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:shadow-elegant">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 font-display font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{body}</div>
    </Link>
  );
}
