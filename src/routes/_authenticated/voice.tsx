import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { analyzeVoice, testVoice } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, Trash2, CheckCircle2, FlaskConical, Save, X } from "lucide-react";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/premium-loader";

export const Route = createFileRoute("/_authenticated/voice")({ component: VoicePage });

interface AnalysisShape {
  tone?: string;
  humor_level?: string;
  sentence_length?: string;
  formatting_style?: string;
  hook_style?: string;
  cta_style?: string;
  emoji_usage?: string;
  vocabulary_patterns?: string[];
  summary?: string;
}

interface Profile {
  id: string;
  profile_name: string;
  example_content: string | null;
  analysis: AnalysisShape | null;
  is_default: boolean;
  created_at: string;
}

function VoicePage() {
  const { user } = useAuth();
  const analyze = useServerFn(analyzeVoice);
  const test = useServerFn(testVoice);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const [examples, setExamples] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // ephemeral analysis preview before saving
  const [preview, setPreview] = useState<AnalysisShape | null>(null);

  // Test Voice state per profile id
  const [testingId, setTestingId] = useState<string | null>(null);
  const [samples, setSamples] = useState<Record<string, string>>({});

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

  const runAnalysis = async () => {
    if (!user || examples.trim().length < 50) {
      return toast.error("Add at least 50 chars of example content.");
    }
    setAnalyzing(true);
    setPreview(null);
    try {
      const { analysis } = await analyze({ data: { examples } });
      setPreview(analysis as AnalysisShape);
      toast.success("Voice analyzed — review and save.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const saveProfile = async () => {
    if (!user || !preview) return;
    if (!name.trim()) return toast.error("Add a profile name.");
    setSaving(true);
    try {
      const { error } = await supabase.from("voice_profiles").insert({
        user_id: user.id,
        profile_name: name,
        example_content: examples,
        tone: preview.tone,
        writing_style: preview.summary,
        analysis: preview as unknown as Record<string, unknown>,
        is_default: profiles.length === 0,
      });
      if (error) throw error;
      toast.success("Voice profile saved!");
      setName(""); setExamples(""); setPreview(null);
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
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

  const runTest = async (p: Profile) => {
    if (!p.analysis) return toast.error("No analysis available.");
    setTestingId(p.id);
    try {
      const { sample } = await test({ data: { voiceAnalysis: p.analysis as Record<string, unknown> } });
      setSamples((s) => ({ ...s, [p.id]: sample }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Test failed";
      toast.error(msg);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Brand Voice</h1>
      <p className="mt-1 text-muted-foreground">Paste 3-5 samples of your writing. We'll learn your style.</p>

      <div className="mt-8 space-y-4 rounded-2xl glass p-5 md:p-6">
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
            className="bg-background/40"
          />
          <p className="mt-1 text-xs text-muted-foreground">{examples.length} chars · aim for 500+</p>
        </div>

        {!preview && (
          <Button
            onClick={runAnalysis}
            disabled={analyzing}
            className="w-full bg-gradient-primary text-primary-foreground btn-shine shadow-glow"
          >
            <Wand2 className="mr-2 h-4 w-4" /> {analyzing ? "Analyzing…" : "Analyze voice"}
          </Button>
        )}

        {analyzing && (
          <PremiumLoader label="Studying your voice" sublabel="Tone · cadence · vocabulary…" />
        )}

        {preview && (
          <div className="rounded-xl border border-primary/30 bg-accent/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold">AI analysis preview</h3>
              <button
                onClick={() => setPreview(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                aria-label="Discard preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {preview.summary && (
              <p className="mt-2 text-sm text-muted-foreground">{preview.summary}</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
              <Field label="Tone" value={preview.tone} />
              <Field label="Humor" value={preview.humor_level} />
              <Field label="Sentences" value={preview.sentence_length} />
              <Field label="Emoji" value={preview.emoji_usage} />
              <Field label="Hook" value={preview.hook_style} />
              <Field label="CTA" value={preview.cta_style} />
            </div>
            {preview.vocabulary_patterns && preview.vocabulary_patterns.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium">Signature phrases</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {preview.vocabulary_patterns.slice(0, 8).map((v) => (
                    <span key={v} className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] text-secondary-foreground">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={saveProfile}
                disabled={saving || !name.trim()}
                className="bg-gradient-primary text-primary-foreground btn-shine shadow-glow"
              >
                <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save profile"}
              </Button>
              <Button variant="outline" onClick={runAnalysis} disabled={analyzing}>
                <Wand2 className="mr-2 h-4 w-4" /> Re-analyze
              </Button>
            </div>
          </div>
        )}
      </div>

      <h2 className="mt-10 font-display text-xl font-bold">Your profiles</h2>
      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted/40" />
      ) : profiles.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No profiles yet. Create your first above.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-2xl glass p-5 hover-lift">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold truncate">{p.profile_name}</h3>
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
                <div className="flex flex-wrap gap-2">
                  {!p.is_default && (
                    <Button size="sm" variant="outline" onClick={() => setDefault(p.id)}>Set default</Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runTest(p)}
                    disabled={testingId === p.id}
                  >
                    <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                    {testingId === p.id ? "Testing…" : "Test voice"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {testingId === p.id && (
                <div className="mt-4">
                  <PremiumLoader label="Writing in your voice" />
                </div>
              )}

              {samples[p.id] && testingId !== p.id && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-background/60 p-4">
                  <div className="text-xs font-medium text-muted-foreground">Sample post</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{samples[p.id]}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-xs font-medium">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-secondary-foreground">{children}</span>;
}
