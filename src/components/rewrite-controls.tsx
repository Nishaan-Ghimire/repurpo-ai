import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { rewriteContent, REWRITE_STYLES, type RewriteStyle } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import {
  Wand2, Undo2, Eye, EyeOff, Sparkles, Loader2,
  Scissors, StretchHorizontal, Briefcase, Coffee, Flame,
  HeartPulse, TrendingUp, Target, Baby, BookOpen,
} from "lucide-react";
import { toast } from "sonner";

const STYLE_META: Record<RewriteStyle, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  shorter: { label: "Shorter", icon: Scissors },
  longer: { label: "Longer", icon: StretchHorizontal },
  more_professional: { label: "More Professional", icon: Briefcase },
  more_casual: { label: "More Casual", icon: Coffee },
  more_aggressive: { label: "More Aggressive", icon: Flame },
  more_emotional: { label: "More Emotional", icon: HeartPulse },
  more_viral: { label: "More Viral", icon: TrendingUp },
  more_persuasive: { label: "More Persuasive", icon: Target },
  simpler: { label: "Simpler Language", icon: Baby },
  more_storytelling: { label: "More Storytelling", icon: BookOpen },
};

interface Props {
  text: string;
  platform: string;
  onApply: (newText: string) => void | Promise<void>;
}

export function RewriteControls({ text, platform, onApply }: Props) {
  const rewrite = useServerFn(rewriteContent);
  const [busy, setBusy] = useState<RewriteStyle | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [lastStyle, setLastStyle] = useState<RewriteStyle | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const run = async (style: RewriteStyle) => {
    if (busy) return;
    setBusy(style);
    try {
      const { rewritten } = await rewrite({ data: { text, platform, style } });
      setHistory((h) => [...h, text]);
      setLastStyle(style);
      await onApply(rewritten);
      toast.success(`Rewritten — ${STYLE_META[style].label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setLastStyle(null);
    await onApply(prev);
    toast.success("Reverted");
  };

  const previous = history[history.length - 1];

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-background/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Wand2 className="h-3 w-3 text-primary" />
          Rewrite
          {lastStyle && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              AI optimized · {STYLE_META[lastStyle].label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {previous && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={() => setCompareOpen((v) => !v)}
            >
              {compareOpen ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
              {compareOpen ? "Hide" : "Compare"}
            </Button>
          )}
          {previous && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={undo}>
              <Undo2 className="mr-1 h-3 w-3" /> Undo
            </Button>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {REWRITE_STYLES.map((s) => {
          const meta = STYLE_META[s];
          const Icon = meta.icon;
          const isBusy = busy === s;
          return (
            <button
              key={s}
              onClick={() => run(s)}
              disabled={!!busy}
              className="group inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/50 px-2.5 py-1 text-[11px] font-medium text-foreground/80 transition hover:border-primary/60 hover:bg-primary/10 hover:text-primary hover:shadow-glow disabled:opacity-50"
            >
              {isBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              {meta.label}
            </button>
          );
        })}
      </div>

      {compareOpen && previous && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-background/60 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Original</div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-foreground/80">
              {previous}
            </pre>
          </div>
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-2">
            <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-2.5 w-2.5" /> Rewritten
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed">
              {text}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
