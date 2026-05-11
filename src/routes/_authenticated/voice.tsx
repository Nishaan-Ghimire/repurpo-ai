import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { analyzeVoice } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/voice")({ component: VoicePage });

interface Profile {
  id: string;
  profile_name: string;
  example_content: string | null;
  analysis: any;
  is_default: boolean;
  created_at: string;
}

function VoicePage() {
  const { user } = useAuth();
  const analyze = useServerFn(analyzeVoice);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [examples, setExamples] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("voice_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !name.trim() || examples.trim().length < 50) {
      return toast.error("Add a name and at least 50 chars of example content.");
    }
    setBusy(true);
    try {
      const { analysis } = await analyze({ data: { examples } });
      const { error } = await supabase.from("voice_profiles").insert({
        user_id: user.id,
        profile_name: name,
        example_content: examples,
        tone: analysis.tone,
        writing_style: analysis.summary,
        analysis,
        is_default: profiles.length === 0,
      });
      if (error) throw error;
      toast.success("Voice profile created!");
      setName(""); setExamples("");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await supabase.from("voice_profiles").delete().eq("id", id);
    load();
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("voice_profiles").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("voice_profiles").update({ is_default: true }).eq("id", id);
    load();
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Brand Voice</h1>
      <p className="mt-1 text-muted-foreground">Paste 3-5 samples of your writing. We'll learn your style.</p>

      <div className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div>
          <Label htmlFor="vname">Profile name</Label>
          <Input id="vname" placeholder="My Twitter voice" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ex">Writing examples</Label>
          <Textarea
            id="ex"
            rows={10}
            placeholder="Paste tweets, LinkedIn posts, articles, newsletters — anything you've written."
            value={examples}
            onChange={(e) => setExamples(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">{examples.length} chars · aim for 500+</p>
        </div>
        <Button onClick={create} disabled={busy} className="w-full bg-gradient-primary shadow-glow">
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</> : <><Wand2 className="mr-2 h-4 w-4" /> Analyze voice</>}
        </Button>
      </div>

      <h2 className="mt-10 font-display text-xl font-bold">Your profiles</h2>
      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" />
      ) : profiles.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No profiles yet. Create your first above.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold">{p.profile_name}</h3>
                    {p.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                        <CheckCircle2 className="h-3 w-3" /> Default
                      </span>
                    )}
                  </div>
                  {p.analysis?.summary && (
                    <p className="mt-2 text-sm text-muted-foreground">{p.analysis.summary}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {p.analysis?.tone && <Badge>Tone: {p.analysis.tone}</Badge>}
                    {p.analysis?.humor_level && <Badge>Humor: {p.analysis.humor_level}</Badge>}
                    {p.analysis?.emoji_usage && <Badge>Emoji: {p.analysis.emoji_usage}</Badge>}
                    {p.analysis?.sentence_length && <Badge>Sentences: {p.analysis.sentence_length}</Badge>}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {!p.is_default && (
                    <Button size="sm" variant="outline" onClick={() => setDefault(p.id)}>Set default</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-secondary-foreground">{children}</span>;
}
