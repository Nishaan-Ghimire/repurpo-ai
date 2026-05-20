import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { generateContent, generateHooks, HOOK_STYLES, type HookStyle } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Copy, Sparkles, Twitter, Linkedin, Instagram, Mail, Video,
  Search, Trash2, RefreshCw, ClipboardCopy, Clock, Zap, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/premium-loader";
import { fireGoldConfetti } from "@/lib/confetti";
import { RewriteControls } from "@/components/rewrite-controls";

const HOOK_STYLE_LABELS: Record<HookStyle, string> = {
  controversial: "Controversial",
  curiosity: "Curiosity",
  storytelling: "Storytelling",
  authority: "Authority",
  statistical: "Statistical",
  emotional: "Emotional",
  bold_claim: "Bold Claim",
  question: "Question-Based",
};

interface Hook { style: HookStyle; text: string; }

export const Route = createFileRoute("/_authenticated/content")({
  component: ContentPage,
  validateSearch: (s: Record<string, unknown>) => ({
    uploadId: (s.uploadId as string) || "",
    moment: (s.moment as string) || "",
  }),
});

const PLATFORMS = [
  { id: "twitter", label: "Twitter/X", icon: Twitter },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "newsletter", label: "Newsletter", icon: Mail },
  { id: "tiktok", label: "TikTok/Reel", icon: Video },
] as const;
type PlatformId = (typeof PLATFORMS)[number]["id"];

interface Upload { id: string; title: string; transcript: string | null; created_at: string; }
interface Asset { id: string; upload_id: string; platform: string; generated_text: string; created_at: string; }

function ContentPage() {
  const { user } = useAuth();
  const { uploadId } = Route.useSearch();
  const generate = useServerFn(generateContent);
  const genHooks = useServerFn(generateHooks);

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [picked, setPicked] = useState<PlatformId[]>(["twitter", "linkedin"]);
  const [intensity, setIntensity] = useState(6);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  // Hook engine
  const [hookStyles, setHookStyles] = useState<HookStyle[]>(["curiosity", "bold_claim"]);
  const [hookPlatform, setHookPlatform] = useState<PlatformId>("linkedin");
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [hooksBusy, setHooksBusy] = useState(false);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);

  // library filters
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | PlatformId>("all");
  const [uploadFilter, setUploadFilter] = useState<"current" | "all">("current");
  const [dateFilter, setDateFilter] = useState<"all" | "7d" | "30d">("all");

  // regenerate w/ feedback per asset
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("content_uploads").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setUploads((data as Upload[]) ?? []);
      if (uploadId) setSelected(uploadId);
      else if (data && data.length) setSelected(data[0].id);
    });
  }, [user, uploadId]);

  const loadAssets = async (uploadId: string | null) => {
    if (!uploadId) return setAssets([]);
    const { data } = await supabase
      .from("generated_assets")
      .select("*")
      .eq("upload_id", uploadId)
      .order("created_at", { ascending: false });
    setAssets((data as Asset[]) ?? []);
  };

  const loadAllAssets = async () => {
    const { data } = await supabase
      .from("generated_assets")
      .select("*")
      .order("created_at", { ascending: false });
    setAssets((data as Asset[]) ?? []);
  };

  useEffect(() => {
    if (uploadFilter === "all") loadAllAssets();
    else if (selected) loadAssets(selected);
  }, [selected, uploadFilter]);

  const togglePlatform = (id: PlatformId) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const toggleHookStyle = (s: HookStyle) => {
    setHookStyles((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  // Load any previously saved hooks for this source
  useEffect(() => {
    if (!selected) { setHooks([]); setSelectedHook(null); return; }
    supabase.from("content_uploads").select("hooks").eq("id", selected).maybeSingle()
      .then(({ data }) => {
        const stored = (data?.hooks as Hook[] | null) ?? [];
        setHooks(stored);
        setSelectedHook(null);
      });
  }, [selected]);

  const runHooks = async () => {
    if (!user || !selected) return toast.error("Pick a source first.");
    if (hookStyles.length === 0) return toast.error("Pick at least one hook style.");
    const upload = uploads.find((u) => u.id === selected);
    const topic = upload?.transcript;
    if (!topic) return toast.error("Source has no transcript / text yet.");
    setHooksBusy(true);
    try {
      const { data: voice } = await supabase.from("voice_profiles").select("analysis").eq("is_default", true).maybeSingle();
      const { hooks: newHooks } = await genHooks({
        data: {
          topic,
          platform: hookPlatform,
          styles: hookStyles,
          voiceAnalysis: (voice?.analysis as Record<string, unknown> | null) ?? null,
        },
      });
      setHooks(newHooks);
      setSelectedHook(null);
      await supabase.from("content_uploads").update({ hooks: newHooks }).eq("id", selected);
      toast.success(`Generated ${newHooks.length} hooks.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Hook generation failed";
      toast.error(msg);
    } finally {
      setHooksBusy(false);
    }
  };

  const run = async () => {
    if (!user || !selected) return toast.error("Pick an upload first.");
    if (picked.length === 0) return toast.error("Pick at least one platform.");
    const upload = uploads.find((u) => u.id === selected);
    if (!upload?.transcript) return toast.error("Upload has no transcript.");

    setBusy(true);
    setElapsed(null);
    const startedAt = Date.now();
    try {
      const { data: voice } = await supabase.from("voice_profiles").select("analysis").eq("is_default", true).maybeSingle();
      const { outputs } = await generate({
        data: {
          transcript: upload.transcript,
          platforms: picked,
          voiceAnalysis: (voice?.analysis as Record<string, unknown> | null) ?? null,
          toneIntensity: intensity,
          selectedHook: selectedHook ?? undefined,
        },
      });

      const rows = Object.entries(outputs).map(([platform, text]) => ({
        upload_id: selected,
        user_id: user.id,
        platform,
        generated_text: text,
      }));
      const { error } = await supabase.from("generated_assets").insert(rows);
      if (error) throw error;
      await supabase.from("generation_logs").insert({
        user_id: user.id,
        generation_type: `repurpose:${picked.join(",")}`,
      });

      await loadAssets(selected);
      const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      setElapsed(seconds);
      fireGoldConfetti();
      toast.success(`Generated in ${seconds}s — saved you ~2 hours.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const regenerateOne = async (asset: Asset) => {
    if (!user) return;
    const upload = uploads.find((u) => u.id === asset.upload_id);
    if (!upload?.transcript) return toast.error("Upload missing.");
    if (!feedbackText.trim()) return toast.error("Add feedback to guide the regeneration.");
    setBusy(true);
    try {
      const { data: voice } = await supabase.from("voice_profiles").select("analysis").eq("is_default", true).maybeSingle();
      const { outputs } = await generate({
        data: {
          transcript: upload.transcript,
          platforms: [asset.platform as PlatformId],
          voiceAnalysis: (voice?.analysis as Record<string, unknown> | null) ?? null,
          toneIntensity: intensity,
          feedback: feedbackText,
          previousText: asset.generated_text,
        },
      });
      const newText = outputs[asset.platform];
      if (!newText) throw new Error("No output");
      await supabase.from("generated_assets").update({ generated_text: newText }).eq("id", asset.id);
      setAssets((a) => a.map((x) => (x.id === asset.id ? { ...x, generated_text: newText } : x)));
      setFeedbackOpen(null);
      setFeedbackText("");
      toast.success("Regenerated with your feedback.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const copyAll = () => {
    if (filtered.length === 0) return;
    const text = filtered
      .map((a) => {
        const meta = PLATFORMS.find((p) => p.id === a.platform);
        return `=== ${meta?.label ?? a.platform} ===\n${a.generated_text}`;
      })
      .join("\n\n");
    copy(text, `Copied ${filtered.length} formats`);
  };

  const deleteAsset = async (id: string) => {
    await supabase.from("generated_assets").delete().eq("id", id);
    setAssets((a) => a.filter((x) => x.id !== id));
  };

  const updateAsset = async (id: string, text: string) => {
    setAssets((a) => a.map((x) => (x.id === id ? { ...x, generated_text: text } : x)));
    await supabase.from("generated_assets").update({ generated_text: text }).eq("id", id);
  };

  const filtered = useMemo(() => {
    const cutoff =
      dateFilter === "7d" ? Date.now() - 7 * 864e5 :
      dateFilter === "30d" ? Date.now() - 30 * 864e5 : 0;
    return assets.filter((a) => {
      if (platformFilter !== "all" && a.platform !== platformFilter) return false;
      if (cutoff && new Date(a.created_at).getTime() < cutoff) return false;
      if (query && !a.generated_text.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [assets, platformFilter, dateFilter, query]);

  if (uploads.length === 0) {
    return (
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold">No content yet</h1>
        <p className="mt-2 text-muted-foreground">Upload something to start generating.</p>
        <Button asChild className="mt-6 bg-gradient-primary text-primary-foreground btn-shine shadow-glow">
          <Link to="/upload">Upload now</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Generated Content</h1>
      <p className="mt-1 text-muted-foreground">Pick an upload, choose platforms, and generate.</p>

      <div className="mt-8 space-y-5 rounded-2xl glass p-5 md:p-6">
        <div>
          <label className="text-sm font-medium">Source</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm backdrop-blur"
          >
            {uploads.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Platforms</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLATFORMS.map(({ id, label, icon: Icon }) => {
              const active = picked.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => togglePlatform(id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-primary bg-gradient-primary text-primary-foreground shadow-glow"
                      : "border-border bg-secondary/50 text-secondary-foreground hover:border-primary/50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Tone intensity: {intensity}/10</label>
          <Slider value={[intensity]} onValueChange={(v) => setIntensity(v[0])} min={1} max={10} step={1} className="mt-2" />
        </div>

        {/* Hook Engine */}
        <div className="rounded-xl border border-primary/30 bg-accent/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-primary text-primary-foreground shadow-glow">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="font-display text-sm font-semibold">Hook Engine</div>
                <div className="text-[11px] text-muted-foreground">
                  Generate scroll-stopping opening lines before the full post.
                </div>
              </div>
            </div>
            <select
              value={hookPlatform}
              onChange={(e) => setHookPlatform(e.target.value as PlatformId)}
              className="rounded-md border border-input bg-background/60 px-2 py-1 text-xs backdrop-blur"
            >
              {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          <div className="mt-3">
            <label className="text-xs font-medium text-muted-foreground">Hook styles</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {HOOK_STYLES.map((s) => {
                const active = hookStyles.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleHookStyle(s)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      active
                        ? "border-primary bg-gradient-primary text-primary-foreground shadow-glow"
                        : "border-border bg-background/40 hover:border-primary/50"
                    }`}
                  >
                    {HOOK_STYLE_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={runHooks}
            disabled={hooksBusy || !selected}
            className="mt-3"
          >
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            {hooksBusy ? "Generating hooks…" : "Generate Hook Variations"}
          </Button>

          {hooksBusy && (
            <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3">
              <PremiumLoader label="Engineering attention" sublabel="Crafting hooks tuned to your platform…" />
            </div>
          )}

          {hooks.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {hooks.map((h, i) => {
                const isSel = selectedHook === h.text;
                return (
                  <div
                    key={`${h.style}-${i}`}
                    className={`rounded-xl border p-3 transition ${
                      isSel ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-background/40 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {HOOK_STYLE_LABELS[h.style]}
                      </span>
                      {isSel && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                          <Check className="h-3 w-3" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">{h.text}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => copy(h.text, "Hook copied")}>
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant={isSel ? "secondary" : "outline"}
                        className="h-7 px-2 text-xs"
                        onClick={() => setSelectedHook(isSel ? null : h.text)}
                      >
                        {isSel ? "Unselect" : "Use This Hook"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedHook && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/10 p-2.5 text-xs">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="flex-1">
                <div className="font-semibold text-primary">Locked-in opening hook</div>
                <div className="mt-0.5 text-muted-foreground line-clamp-2">{selectedHook}</div>
              </div>
              <button
                onClick={() => setSelectedHook(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear selected hook"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <Button
          onClick={run}
          disabled={busy}
          className="w-full bg-gradient-primary text-primary-foreground btn-shine shadow-glow"
        >
          <Sparkles className="mr-2 h-4 w-4" /> {busy ? "Generating…" : selectedHook ? "Generate with selected hook" : "Generate"}
        </Button>

        {busy && (
          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <PremiumLoader label="Crafting your content" sublabel="Mimicking your voice across platforms…" />
          </div>
        )}

        {!busy && elapsed !== null && (
          <div className="rounded-xl border border-primary/30 bg-accent/40 p-4 text-center">
            <div className="font-display text-base font-semibold">
              <span className="text-gradient">Generated in {elapsed} seconds</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Saved you ~2 hours of writing.
            </div>
          </div>
        )}
      </div>

      {/* Library */}
      <div className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Library</h2>
            <p className="text-xs text-muted-foreground">{filtered.length} of {assets.length} assets</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copyAll}
            disabled={filtered.length === 0}
          >
            <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" /> Copy all formats
          </Button>
        </div>

        <div className="mt-4 grid gap-3 rounded-2xl glass p-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search content…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as "all" | PlatformId)}
            className="rounded-md border border-input bg-background/60 px-3 py-2 text-sm backdrop-blur"
          >
            <option value="all">All platforms</option>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as "all" | "7d" | "30d")}
            className="rounded-md border border-input bg-background/60 px-3 py-2 text-sm backdrop-blur"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <div className="md:col-span-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Source:</span>
            <button
              onClick={() => setUploadFilter("current")}
              className={`rounded-full border px-2.5 py-1 ${uploadFilter === "current" ? "border-primary text-primary" : "border-border"}`}
            >Current upload</button>
            <button
              onClick={() => setUploadFilter("all")}
              className={`rounded-full border px-2.5 py-1 ${uploadFilter === "all" ? "border-primary text-primary" : "border-border"}`}
            >All uploads</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">No assets match your filters.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {filtered.map((a) => {
              const meta = PLATFORMS.find((x) => x.id === a.platform);
              const Icon = meta?.icon ?? FileTextIcon;
              const isOpen = feedbackOpen === a.id;
              return (
                <div key={a.id} className="rounded-2xl glass p-4 hover-lift">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-primary text-primary-foreground shadow-glow">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {meta?.label ?? a.platform}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Textarea
                    value={a.generated_text}
                    onChange={(e) => updateAsset(a.id, e.target.value)}
                    rows={Math.min(14, Math.max(5, a.generated_text.split("\n").length + 2))}
                    className="mt-3 bg-background/40 font-mono text-xs"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => copy(a.generated_text)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setFeedbackOpen(isOpen ? null : a.id); setFeedbackText(""); }}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteAsset(a.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <RewriteControls
                    text={a.generated_text}
                    platform={a.platform}
                    onApply={(t) => updateAsset(a.id, t)}
                  />
                  {isOpen && (
                    <div className="mt-3 rounded-xl border border-primary/30 bg-accent/30 p-3">
                      <label className="text-xs font-medium">Tell the AI what to change</label>
                      <Textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        rows={3}
                        placeholder="e.g. Make it punchier, lead with a stat, drop the emojis…"
                        className="mt-1 bg-background/60 text-xs"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setFeedbackOpen(null)}>Cancel</Button>
                        <Button
                          size="sm"
                          onClick={() => regenerateOne(a)}
                          disabled={busy}
                          className="bg-gradient-primary text-primary-foreground btn-shine shadow-glow"
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Apply feedback
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// fallback icon if a platform id isn't recognized
function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Mail {...props} />;
}
