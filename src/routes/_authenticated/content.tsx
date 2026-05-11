import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { generateContent } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Loader2, Copy, Sparkles, Twitter, Linkedin, Instagram, Mail, Video } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/content")({
  component: ContentPage,
  validateSearch: (s: Record<string, unknown>) => ({ uploadId: (s.uploadId as string) || "" }),
});

const PLATFORMS = [
  { id: "twitter", label: "Twitter/X", icon: Twitter },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "newsletter", label: "Newsletter", icon: Mail },
  { id: "tiktok", label: "TikTok/Reel", icon: Video },
] as const;

interface Upload { id: string; title: string; transcript: string | null; created_at: string; }
interface Asset { id: string; upload_id: string; platform: string; generated_text: string; created_at: string; }

function ContentPage() {
  const { user } = useAuth();
  const { uploadId } = Route.useSearch();
  const generate = useServerFn(generateContent);

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [picked, setPicked] = useState<string[]>(["twitter", "linkedin"]);
  const [intensity, setIntensity] = useState(6);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("content_uploads").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setUploads((data as Upload[]) ?? []);
      if (uploadId) setSelected(uploadId);
      else if (data && data.length) setSelected(data[0].id);
    });
  }, [user, uploadId]);

  useEffect(() => {
    if (!selected) return;
    supabase.from("generated_assets").select("*").eq("upload_id", selected).order("created_at", { ascending: false }).then(({ data }) => {
      setAssets((data as Asset[]) ?? []);
    });
  }, [selected]);

  const togglePlatform = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const run = async () => {
    if (!user || !selected) return toast.error("Pick an upload first.");
    if (picked.length === 0) return toast.error("Pick at least one platform.");
    const upload = uploads.find((u) => u.id === selected);
    if (!upload?.transcript) return toast.error("Upload has no transcript.");

    setBusy(true);
    try {
      const { data: voice } = await supabase.from("voice_profiles").select("analysis").eq("is_default", true).maybeSingle();
      const { outputs } = await generate({
        data: {
          transcript: upload.transcript,
          platforms: picked as any,
          voiceAnalysis: (voice?.analysis as Record<string, unknown> | null) ?? null,
          toneIntensity: intensity,
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

      const { data: refreshed } = await supabase.from("generated_assets").select("*").eq("upload_id", selected).order("created_at", { ascending: false });
      setAssets((refreshed as Asset[]) ?? []);
      toast.success("Generated!");
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const updateAsset = async (id: string, text: string) => {
    setAssets((a) => a.map((x) => (x.id === id ? { ...x, generated_text: text } : x)));
    await supabase.from("generated_assets").update({ generated_text: text }).eq("id", id);
  };

  if (uploads.length === 0) {
    return (
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold">No content yet</h1>
        <p className="mt-2 text-muted-foreground">Upload something to start generating.</p>
        <Button asChild className="mt-6 bg-gradient-primary shadow-glow">
          <Link to="/upload">Upload now</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Generated Content</h1>
      <p className="mt-1 text-muted-foreground">Pick an upload, choose platforms, and generate.</p>

      <div className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div>
          <label className="text-sm font-medium">Source</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                      : "border-border bg-secondary text-secondary-foreground hover:border-primary/50"
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

        <Button onClick={run} disabled={busy} className="w-full bg-gradient-primary shadow-glow">
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate</>}
        </Button>
      </div>

      {assets.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-xl font-bold">Outputs</h2>
          <Tabs defaultValue={assets[0].platform} className="mt-4">
            <TabsList className="flex-wrap">
              {Array.from(new Set(assets.map((a) => a.platform))).map((p) => {
                const meta = PLATFORMS.find((x) => x.id === p);
                const Icon = meta?.icon;
                return (
                  <TabsTrigger key={p} value={p}>
                    {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
                    {meta?.label ?? p}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {Array.from(new Set(assets.map((a) => a.platform))).map((p) => {
              const list = assets.filter((a) => a.platform === p);
              return (
                <TabsContent key={p} value={p} className="space-y-3">
                  {list.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => copy(a.generated_text)}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                        </Button>
                      </div>
                      <Textarea
                        value={a.generated_text}
                        onChange={(e) => updateAsset(a.id, e.target.value)}
                        rows={Math.min(20, Math.max(6, a.generated_text.split("\n").length + 2))}
                        className="mt-3 font-mono text-sm"
                      />
                    </div>
                  ))}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      )}
    </div>
  );
}
