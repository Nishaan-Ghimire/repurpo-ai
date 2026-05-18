import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { generateContent } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Calendar as CalIcon, ChevronLeft, ChevronRight, Plus, Search, Youtube, Mic2,
  FileText, Link2, Copy, Edit3, RefreshCw, Check, CopyPlus, Sparkles,
  Twitter, Linkedin, Instagram, Mail, Video,
} from "lucide-react";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/premium-loader";

export const Route = createFileRoute("/_authenticated/calendar")({ component: CalendarPage });

type SourceType = "youtube" | "podcast" | "blog" | "text";
type Status = "draft" | "generated" | "used";

interface Upload {
  id: string;
  title: string;
  content_type: string;
  original_content: string | null;
  transcript: string | null;
  status: string;
  calendar_date: string;
  created_at: string;
}
interface Asset {
  id: string;
  upload_id: string;
  platform: string;
  generated_text: string;
  created_at: string;
}

const SOURCE_META: Record<SourceType, { label: string; icon: any }> = {
  youtube:  { label: "YouTube",  icon: Youtube },
  podcast:  { label: "Podcast",  icon: Mic2 },
  blog:     { label: "Blog",     icon: Link2 },
  text:     { label: "Text",     icon: FileText },
};

const PLATFORMS = [
  { id: "twitter",    label: "Twitter thread",    icon: Twitter },
  { id: "linkedin",   label: "LinkedIn post",     icon: Linkedin },
  { id: "instagram",  label: "Instagram caption", icon: Instagram },
  { id: "newsletter", label: "Newsletter draft",  icon: Mail },
  { id: "tiktok",     label: "Reel / short",      icon: Video },
] as const;
type PlatformId = (typeof PLATFORMS)[number]["id"];
const ALL_PLATFORM_IDS = PLATFORMS.map((p) => p.id) as PlatformId[];

function statusOf(u: Upload, assetCount: number): Status {
  if (u.status === "used") return "used";
  if (assetCount > 0) return "generated";
  return "draft";
}
function inferSourceType(u: Upload): SourceType {
  const ct = (u.content_type || "").toLowerCase();
  if (ct === "youtube" || ct === "podcast" || ct === "blog" || ct === "text") return ct as SourceType;
  if (ct.startsWith("audio") || ct.startsWith("video")) return "podcast";
  return "text";
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function CalendarPage() {
  const { user } = useAuth();
  const generate = useServerFn(generateContent);

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [u, a] = await Promise.all([
      supabase.from("content_uploads").select("*").order("calendar_date", { ascending: false }),
      supabase.from("generated_assets").select("id,upload_id,platform,generated_text,created_at").order("created_at", { ascending: false }),
    ]);
    setUploads((u.data as Upload[]) ?? []);
    setAssets((a.data as Asset[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) refresh(); }, [user]);

  const assetsByUpload = useMemo(() => {
    const map: Record<string, Asset[]> = {};
    for (const a of assets) (map[a.upload_id] ||= []).push(a);
    return map;
  }, [assets]);

  const filteredUploads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return uploads.filter((u) => {
      const s = statusOf(u, (assetsByUpload[u.id] ?? []).length);
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (q && !u.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [uploads, assetsByUpload, statusFilter, query]);

  const uploadsByDate = useMemo(() => {
    const map: Record<string, Upload[]> = {};
    for (const u of filteredUploads) (map[u.calendar_date] ||= []).push(u);
    return map;
  }, [filteredUploads]);

  const days = useMemo(() => buildGrid(cursor, view), [cursor, view]);
  const openUpload = openId ? uploads.find((u) => u.id === openId) ?? null : null;

  const shift = (dir: -1 | 1) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + 7 * dir);
    setCursor(d);
  };

  const headerLabel = view === "month"
    ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : `Week of ${days[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  // ---- mutations ----
  const markUsed = async (id: string) => {
    await supabase.from("content_uploads").update({ status: "used" }).eq("id", id);
    setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "used" } : x)));
    toast.success("Marked as used");
  };

  const duplicate = async (u: Upload) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("content_uploads")
      .insert({
        user_id: user.id,
        title: `${u.title} (copy)`,
        content_type: u.content_type,
        original_content: u.original_content,
        transcript: u.transcript,
        status: "ready",
        calendar_date: ymd(new Date()),
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setUploads((arr) => [data as Upload, ...arr]);
    toast.success("Duplicated");
  };

  const regenerate = async (u: Upload, platforms: PlatformId[]) => {
    if (!user) return;
    if (!u.transcript && !u.original_content) return toast.error("No transcript or text to repurpose.");
    setBusy(true);
    try {
      const { data: voice } = await supabase
        .from("voice_profiles").select("analysis").eq("is_default", true).maybeSingle();
      const { outputs } = await generate({
        data: {
          transcript: (u.transcript || u.original_content || "").slice(0, 50000),
          platforms,
          voiceAnalysis: (voice?.analysis as Record<string, unknown> | null) ?? null,
        },
      });

      // delete old assets for these platforms, insert new
      const oldIds = (assetsByUpload[u.id] ?? [])
        .filter((a) => platforms.includes(a.platform as PlatformId))
        .map((a) => a.id);
      if (oldIds.length) await supabase.from("generated_assets").delete().in("id", oldIds);

      const rows = Object.entries(outputs).map(([platform, text]) => ({
        upload_id: u.id, user_id: user.id, platform, generated_text: text,
      }));
      if (rows.length) await supabase.from("generated_assets").insert(rows);
      await refresh();
      toast.success(`Generated ${rows.length} output${rows.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Content Calendar</h1>
          <p className="mt-1 text-muted-foreground">One source → many assets. Organize, reuse, repeat.</p>
        </div>
        <NewSourceDialog
          open={newOpen} setOpen={setNewOpen} onCreated={refresh} defaultDate={ymd(cursor)}
        />
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl glass p-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-[10rem] px-2 text-center font-medium">{headerLabel}</div>
          <Button variant="ghost" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="ml-1" onClick={() => setCursor(new Date())}>Today</Button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 w-44 pl-7 text-xs" placeholder="Search titles…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {(["all","draft","generated","used"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-2.5 py-1 text-xs capitalize ${
                statusFilter === s ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >{s}</button>
          ))}
          <div className="ml-2 inline-flex rounded-md border border-border p-0.5 text-xs">
            <button
              className={`rounded px-2 py-1 ${view === "month" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
              onClick={() => setView("month")}
            >Month</button>
            <button
              className={`rounded px-2 py-1 ${view === "week" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
              onClick={() => setView("week")}
            >Week</button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="bg-background/80 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
        {days.map(({ date, inMonth }) => {
          const key = ymd(date);
          const today = ymd(new Date()) === key;
          const items = uploadsByDate[key] ?? [];
          return (
            <div
              key={key}
              className={`min-h-[110px] bg-background/60 p-1.5 ${inMonth ? "" : "opacity-50"}`}
            >
              <div className={`mb-1 flex items-center justify-between text-[11px] ${today ? "text-primary font-bold" : "text-muted-foreground"}`}>
                <span>{date.getDate()}</span>
                {items.length > 0 && <span>{items.length}</span>}
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((u) => (
                  <ContentCard key={u.id} u={u} assetCount={(assetsByUpload[u.id] ?? []).length} onClick={() => setOpenId(u.id)} />
                ))}
                {items.length > 3 && (
                  <button
                    onClick={() => setOpenId(items[3].id)}
                    className="block w-full rounded text-left text-[10px] text-muted-foreground hover:text-foreground"
                  >+ {items.length - 3} more</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="mt-6 rounded-xl border border-border/60 bg-background/40 p-4">
          <PremiumLoader label="Loading calendar" />
        </div>
      )}

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {openUpload && (
            <DetailPanel
              u={openUpload}
              assets={assetsByUpload[openUpload.id] ?? []}
              busy={busy}
              onMarkUsed={() => markUsed(openUpload.id)}
              onDuplicate={() => duplicate(openUpload)}
              onRegenAll={() => regenerate(openUpload, ALL_PLATFORM_IDS)}
              onRegenOne={(p) => regenerate(openUpload, [p])}
              onChangeAsset={async (id, text) => {
                setAssets((arr) => arr.map((x) => (x.id === id ? { ...x, generated_text: text } : x)));
                await supabase.from("generated_assets").update({ generated_text: text }).eq("id", id);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ContentCard({ u, assetCount, onClick }: { u: Upload; assetCount: number; onClick: () => void }) {
  const src = inferSourceType(u);
  const Icon = SOURCE_META[src].icon;
  const status = statusOf(u, assetCount);
  const badgeClass =
    status === "used" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : status === "generated" ? "bg-primary/15 text-primary border-primary/30"
    : "bg-muted/50 text-muted-foreground border-border";
  return (
    <button
      onClick={onClick}
      className="block w-full rounded-md border border-border/60 bg-card/70 px-1.5 py-1 text-left text-[11px] backdrop-blur hover:border-primary/50 hover:shadow-glow"
    >
      <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 shrink-0 text-primary" />
        <span className="truncate font-medium">{u.title}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-1">
        <span className={`rounded-full border px-1.5 py-0 text-[9px] capitalize ${badgeClass}`}>{status}</span>
        {assetCount > 0 && <span className="text-[9px] text-muted-foreground">{assetCount} outputs</span>}
      </div>
    </button>
  );
}

function DetailPanel({
  u, assets, busy, onMarkUsed, onDuplicate, onRegenAll, onRegenOne, onChangeAsset,
}: {
  u: Upload;
  assets: Asset[];
  busy: boolean;
  onMarkUsed: () => void;
  onDuplicate: () => void;
  onRegenAll: () => void;
  onRegenOne: (p: PlatformId) => void;
  onChangeAsset: (id: string, text: string) => void;
}) {
  const src = inferSourceType(u);
  const SrcIcon = SOURCE_META[src].icon;
  const input = u.original_content || u.transcript || "";
  const wordCount = input ? input.trim().split(/\s+/).length : 0;
  const status = statusOf(u, assets.length);

  const assetsByPlatform = useMemo(() => {
    const map: Record<string, Asset[]> = {};
    for (const a of assets) (map[a.platform] ||= []).push(a);
    return map;
  }, [assets]);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 font-display">
          <SrcIcon className="h-4 w-4 text-primary" />
          {u.title}
        </SheetTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{SOURCE_META[src].label}</span>
          <span>•</span>
          <span>{new Date(u.calendar_date).toLocaleDateString()}</span>
          {wordCount > 0 && <><span>•</span><span>{wordCount.toLocaleString()} words</span></>}
          <span>•</span>
          <span className="capitalize text-foreground">{status}</span>
        </div>
      </SheetHeader>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onRegenAll} disabled={busy} className="bg-gradient-primary text-primary-foreground btn-shine shadow-glow">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Regenerate all
        </Button>
        <Button size="sm" variant="outline" onClick={onMarkUsed}><Check className="mr-1.5 h-3.5 w-3.5" /> Mark used</Button>
        <Button size="sm" variant="outline" onClick={onDuplicate}><CopyPlus className="mr-1.5 h-3.5 w-3.5" /> Duplicate</Button>
      </div>

      <section className="mt-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original input</h3>
        <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs">
          {input ? (
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/90">
              {input.length > 1200 ? `${input.slice(0, 1200)}…` : input}
            </pre>
          ) : (
            <span className="text-muted-foreground">No original content stored.</span>
          )}
        </div>
      </section>

      <section className="mt-6 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Generated outputs</h3>
        {PLATFORMS.map(({ id, label, icon: Icon }) => {
          const list = assetsByPlatform[id] ?? [];
          return (
            <div key={id} className="rounded-xl glass p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-primary text-primary-foreground shadow-glow">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {label}
                </div>
                <Button size="sm" variant="ghost" onClick={() => onRegenOne(id)} disabled={busy}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
                </Button>
              </div>
              {list.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No output yet for this platform.</p>
              ) : list.map((a) => (
                <OutputBlock key={a.id} asset={a} onChange={(t) => onChangeAsset(a.id, t)} />
              ))}
            </div>
          );
        })}
      </section>
    </>
  );
}

function OutputBlock({ asset, onChange }: { asset: Asset; onChange: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-2">
      {editing ? (
        <Textarea
          value={asset.generated_text}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.min(12, Math.max(4, asset.generated_text.split("\n").length + 1))}
          className="bg-background/60 font-mono text-[11px]"
        />
      ) : (
        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{asset.generated_text}</pre>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(asset.generated_text); toast.success("Copied"); }}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
          <Edit3 className="mr-1 h-3.5 w-3.5" /> {editing ? "Done" : "Edit"}
        </Button>
      </div>
    </div>
  );
}

function NewSourceDialog({
  open, setOpen, onCreated, defaultDate,
}: { open: boolean; setOpen: (o: boolean) => void; onCreated: () => void; defaultDate: string }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<SourceType>("text");
  const [date, setDate] = useState(defaultDate);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setDate(defaultDate); }, [open, defaultDate]);

  const save = async () => {
    if (!user) return;
    if (!title.trim()) return toast.error("Add a title");
    setSaving(true);
    const { error } = await supabase.from("content_uploads").insert({
      user_id: user.id,
      title: title.trim(),
      content_type: type,
      original_content: content || null,
      transcript: type === "text" ? content || null : null,
      status: "ready",
      calendar_date: date,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setTitle(""); setContent(""); setType("text");
    setOpen(false);
    onCreated();
    toast.success("Content source added");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary text-primary-foreground btn-shine shadow-glow">
          <Plus className="mr-1.5 h-4 w-4" /> New source
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <CalIcon className="h-4 w-4 text-primary" /> New content source
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Title</label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Podcast with Alex — Ep 12" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Source type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SourceType)}
                className="mt-1 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm"
              >
                {(Object.keys(SOURCE_META) as SourceType[]).map((k) => (
                  <option key={k} value={k}>{SOURCE_META[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Calendar date</label>
              <Input className="mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">
              {type === "youtube" || type === "blog" ? "URL or notes" : "Content / transcript"}
            </label>
            <Textarea className="mt-1" rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste link, transcript, or raw text…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground btn-shine shadow-glow">
            {saving ? "Saving…" : "Add to calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- grid builder ----
function buildGrid(cursor: Date, view: "month" | "week"): Array<{ date: Date; inMonth: boolean }> {
  if (view === "week") {
    const start = new Date(cursor);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return { date: d, inMonth: d.getMonth() === cursor.getMonth() };
    });
  }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    return { date: d, inMonth: d.getMonth() === cursor.getMonth() };
  });
}
