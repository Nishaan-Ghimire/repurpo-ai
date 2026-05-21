import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { generateRatedHooks, HOOK_STYLES, type HookStyle } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Beaker, Sparkles, Copy, Wand2, TrendingUp, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/premium-loader";

export const Route = createFileRoute("/_authenticated/hooks")({ component: HooksLabPage });

interface Upload { id: string; title: string; transcript: string | null; original_content: string | null; }
interface VoiceProfile { id: string; profile_name: string; analysis: any; is_default: boolean }
interface RatedHook {
  style: HookStyle; text: string; score: number; reason: string;
  strengths: string[]; risks: string[];
}

const HOOK_LABEL: Record<HookStyle, string> = {
  controversial: "Controversial", curiosity: "Curiosity", storytelling: "Storytelling",
  authority: "Authority", statistical: "Statistical", emotional: "Emotional",
  bold_claim: "Bold Claim", question: "Question",
};

const PLATFORMS = ["twitter", "linkedin", "instagram", "newsletter", "tiktok"] as const;
type Platform = (typeof PLATFORMS)[number];

function scoreColor(s: number) {
  if (s >= 85) return "from-yellow-400 to-amber-600 text-black";
  if (s >= 70) return "from-primary to-primary/70 text-primary-foreground";
  return "from-muted to-muted/70 text-muted-foreground";
}

function scoreLabel(s: number) {
  if (s >= 85) return "Scroll-stopper";
  if (s >= 70) return "Strong";
  if (s >= 55) return "Solid";
  return "Average";
}

function HooksLabPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const generate = useServerFn(generateRatedHooks);

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [uploadId, setUploadId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [selectedStyles, setSelectedStyles] = useState<HookStyle[]>([...HOOK_STYLES]);
  const [count, setCount] = useState(12);
  const [hooks, setHooks] = useState<RatedHook[]>([]);
  const [busy, setBusy] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("content_uploads").select("id,title,transcript,original_content")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Upload[];
        setUploads(list);
        if (!uploadId && list[0]) setUploadId(list[0].id);
      });
    supabase.from("voice_profiles").select("id,profile_name,analysis,is_default")
      .eq("user_id", user.id).order("is_default", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as VoiceProfile[];
        setVoices(list);
        const def = list.find((v) => v.is_default) ?? list[0];
        if (def && !voiceId) setVoiceId(def.id);
      });
  }, [user]);

  const current = useMemo(() => uploads.find((u) => u.id === uploadId), [uploads, uploadId]);
  const activeVoice = useMemo(() => voices.find((v) => v.id === voiceId), [voices, voiceId]);

  const toggleStyle = (s: HookStyle) => {
    setSelectedStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const run = async () => {
    const topic = current?.transcript || current?.original_content || "";
    if (!topic || topic.length < 20) return toast.error("Pick a source with a transcript or content first.");
    if (selectedStyles.length === 0) return toast.error("Select at least one hook style.");
    setBusy(true);
    try {
      const { hooks } = await generate({
        data: {
          topic,
          platform,
          styles: selectedStyles,
          count,
          voiceAnalysis: activeVoice?.analysis ?? null,
        },
      });
      setHooks(hooks);
      toast.success(`Generated ${hooks.length} rated hooks`);
    } catch (e: any) {
      toast.error(e.message ?? "Hook generation failed");
    } finally {
      setBusy(false);
    }
  };

  const copyHook = async (h: RatedHook, idx: number) => {
    await navigator.clipboard.writeText(h.text);
    setCopiedIdx(idx);
    toast.success("Hook copied");
    setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1400);
  };

  const useInGenerator = (h: RatedHook) => {
    if (!uploadId) return;
    navigate({ to: "/content", search: { uploadId, hook: h.text } as any });
  };

  const avg = hooks.length ? Math.round(hooks.reduce((a, b) => a + b.score, 0) / hooks.length) : 0;
  const top = hooks[0]?.score ?? 0;

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          <Beaker className="h-4 w-4 text-primary-foreground" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold">Hook A/B Factory</h1>
          <p className="text-sm text-muted-foreground">Generate 10+ rated opening hooks. Pick the scroll-stopper.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 rounded-2xl glass p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Content source</label>
            <Select value={uploadId} onValueChange={setUploadId}>
              <SelectTrigger><SelectValue placeholder="Pick a source" /></SelectTrigger>
              <SelectContent>
                {uploads.map((u) => <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Platform</label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Brand voice (optional)</label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger><SelectValue placeholder="No voice profile" /></SelectTrigger>
              <SelectContent>
                {voices.map((v) => <SelectItem key={v.id} value={v.id}>{v.profile_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">Hook styles to test</label>
          <div className="flex flex-wrap gap-2">
            {HOOK_STYLES.map((s) => {
              const active = selectedStyles.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStyle(s)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "border-primary/40 bg-primary/15 text-primary shadow-glow"
                      : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {HOOK_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Variations</label>
            <div className="flex gap-1">
              {[8, 12, 16, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
                    count === n
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={run}
            disabled={busy || !current}
            className="bg-gradient-primary text-primary-foreground btn-shine shadow-glow"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {busy ? "Generating…" : hooks.length ? "Regenerate" : "Run A/B factory"}
          </Button>
        </div>
      </div>

      {busy && (
        <div className="mt-6">
          <PremiumLoader label="Engineering attention" sublabel="Drafting + scoring hook variations…" />
        </div>
      )}

      {!busy && hooks.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" /> Top hook
            <span className="font-display text-sm font-bold text-foreground">{top}</span>
          </span>
          <span className="text-muted-foreground">Avg score <span className="font-display text-sm font-bold text-foreground">{avg}</span></span>
          <span className="text-muted-foreground">{hooks.length} variations</span>
        </div>
      )}

      {!busy && hooks.length === 0 && current && (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Set styles + variations, then hit <span className="text-foreground font-medium">Run A/B factory</span>.
        </div>
      )}

      {hooks.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {hooks.map((h, i) => (
            <div key={i} className="group rounded-2xl glass p-5 transition hover:shadow-glow">
              <div className="flex items-start justify-between gap-3">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${scoreColor(h.score)} font-display text-lg font-bold shadow-glow`}>
                  {h.score}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-right">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                    {HOOK_LABEL[h.style]}
                  </span>
                  <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {scoreLabel(h.score)}
                  </span>
                </div>
              </div>
              <p className="mt-4 font-display text-base leading-snug">"{h.text}"</p>
              <div className="mt-3 rounded-lg bg-background/40 p-3 text-xs text-muted-foreground">
                {h.reason}
              </div>
              {(h.strengths?.length || h.risks?.length) ? (
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  {h.strengths?.length ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-primary">
                        <TrendingUp className="h-3 w-3" /> Strengths
                      </div>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {h.strengths.map((s, k) => <li key={k}>• {s}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {h.risks?.length ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5">
                      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Risks
                      </div>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {h.risks.map((s, k) => <li key={k}>• {s}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copyHook(h, i)}>
                  {copiedIdx === i ? <Check className="mr-2 h-3.5 w-3.5" /> : <Copy className="mr-2 h-3.5 w-3.5" />}
                  {copiedIdx === i ? "Copied" : "Copy"}
                </Button>
                <Button size="sm" onClick={() => useInGenerator(h)} className="bg-gradient-primary text-primary-foreground btn-shine">
                  <Wand2 className="mr-2 h-3.5 w-3.5" /> Use in generator
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
