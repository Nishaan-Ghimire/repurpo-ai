import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { detectViralMoments, HOOK_STYLES, type HookStyle } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame, Sparkles, Copy, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/premium-loader";

export const Route = createFileRoute("/_authenticated/moments")({ component: MomentsPage });

interface Upload { id: string; title: string; transcript: string | null; viral_moments: any; }
interface Moment {
  quote: string;
  score: number;
  reason: string;
  angle: string;
  suggested_platforms: string[];
  suggested_hook_style: HookStyle;
}

const HOOK_LABEL: Record<HookStyle, string> = {
  controversial: "Controversial", curiosity: "Curiosity", storytelling: "Storytelling",
  authority: "Authority", statistical: "Statistical", emotional: "Emotional",
  bold_claim: "Bold Claim", question: "Question",
};

function scoreColor(s: number) {
  if (s >= 85) return "from-yellow-400 to-amber-600 text-black";
  if (s >= 70) return "from-primary to-primary/70 text-primary-foreground";
  return "from-muted to-muted/70 text-muted-foreground";
}

function MomentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const detect = useServerFn(detectViralMoments);

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [moments, setMoments] = useState<Moment[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("content_uploads").select("id,title,transcript,viral_moments")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Upload[];
        setUploads(list);
        if (!selected && list[0]) setSelected(list[0].id);
      });
  }, [user]);

  const current = useMemo(() => uploads.find((u) => u.id === selected), [uploads, selected]);

  useEffect(() => {
    if (!current) { setMoments([]); return; }
    const cached = Array.isArray(current.viral_moments) ? (current.viral_moments as Moment[]) : [];
    setMoments(cached);
  }, [current?.id]);

  const run = async () => {
    if (!current?.transcript || current.transcript.length < 50) {
      return toast.error("This source needs a transcript first.");
    }
    setBusy(true);
    try {
      const { moments } = await detect({ data: { transcript: current.transcript } });
      setMoments(moments);
      await supabase.from("content_uploads").update({ viral_moments: moments }).eq("id", current.id);
      toast.success(`Found ${moments.length} viral moments`);
    } catch (e: any) {
      toast.error(e.message ?? "Detection failed");
    } finally {
      setBusy(false);
    }
  };

  const useInGenerator = (m: Moment) => {
    navigate({ to: "/content", search: { uploadId: current!.id, moment: m.quote } as any });
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          <Flame className="h-4 w-4 text-primary-foreground" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold">Viral Moment Detector</h1>
          <p className="text-sm text-muted-foreground">Find the scroll-stopping moments inside your long-form content.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl glass p-4 md:p-5 md:grid-cols-[1fr_auto]">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger><SelectValue placeholder="Pick a content source" /></SelectTrigger>
          <SelectContent>
            {uploads.map((u) => <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          onClick={run}
          disabled={busy || !current?.transcript}
          className="bg-gradient-primary text-primary-foreground btn-shine shadow-glow"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {busy ? "Analyzing…" : moments.length ? "Re-detect" : "Detect viral moments"}
        </Button>
      </div>

      {busy && <div className="mt-6"><PremiumLoader label="Reading transcript" sublabel="Scoring moments by viral potential…" /></div>}

      {!busy && moments.length === 0 && current && (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No moments yet. Hit <span className="text-foreground font-medium">Detect viral moments</span> to analyze this source.
        </div>
      )}

      {moments.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {moments.map((m, i) => (
            <div key={i} className="group rounded-2xl glass p-5 transition hover:shadow-glow">
              <div className="flex items-start justify-between gap-3">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${scoreColor(m.score)} font-display text-lg font-bold shadow-glow`}>
                  {m.score}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                    {HOOK_LABEL[m.suggested_hook_style]}
                  </span>
                  {m.suggested_platforms.slice(0, 3).map((p) => (
                    <span key={p} className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-4 font-display text-base leading-snug">"{m.quote}"</p>
              <div className="mt-3 rounded-lg bg-background/40 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.angle}</span> — {m.reason}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(m.quote); toast.success("Quote copied"); }}>
                  <Copy className="mr-2 h-3.5 w-3.5" /> Copy
                </Button>
                <Button size="sm" onClick={() => useInGenerator(m)} className="bg-gradient-primary text-primary-foreground btn-shine">
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
