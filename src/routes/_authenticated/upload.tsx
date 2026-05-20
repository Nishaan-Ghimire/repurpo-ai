import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { transcribeAudio, importFromUrl } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload as UploadIcon, FileText, Link2 } from "lucide-react";
import { toast } from "sonner";
import { PremiumLoader } from "@/components/premium-loader";

export const Route = createFileRoute("/_authenticated/upload")({ component: UploadPage });

function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const transcribe = useServerFn(transcribeAudio);
  const importUrl = useServerFn(importFromUrl);

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // URL import state
  const [url, setUrl] = useState("");
  const [urlPreview, setUrlPreview] = useState<{ title: string; content: string; sourceUrl: string; kind: string } | null>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const submitText = async () => {
    if (!user || !title.trim() || !text.trim()) return toast.error("Title and content are required.");
    setBusy(true);
    const { data, error } = await supabase
      .from("content_uploads")
      .insert({ user_id: user.id, title, original_content: text, transcript: text, content_type: "text", status: "ready" })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Uploaded!");
    navigate({ to: "/content", search: { uploadId: data.id } as any });
  };

  const submitFile = async () => {
    if (!user || !title.trim() || !file) return toast.error("Title and file are required.");
    setBusy(true);
    try {
      setStage("Uploading file…");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("content-uploads").upload(path, file);
      if (upErr) throw upErr;

      setStage("Transcribing audio (Chirp 3)…");
      const { data: signed } = await supabase.storage.from("content-uploads").createSignedUrl(path, 600);
      if (!signed) throw new Error("Could not sign file URL");

      const { transcript } = await transcribe({ data: { signedUrl: signed.signedUrl, mimeType: file.type } });

      setStage("Saving…");
      const { data, error } = await supabase
        .from("content_uploads")
        .insert({
          user_id: user.id,
          title,
          transcript,
          content_type: file.type.startsWith("video") ? "video" : "audio",
          file_path: path,
          status: "ready",
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Transcribed!");
      navigate({ to: "/content", search: { uploadId: data.id } as any });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const fetchUrl = async () => {
    if (!url.trim()) return toast.error("Paste a URL first.");
    setBusy(true);
    setStage("Fetching content…");
    setUrlPreview(null);
    try {
      const res = await importUrl({ data: { url: url.trim() } });
      setUrlPreview({ title: res.title, content: res.content, sourceUrl: res.sourceUrl, kind: res.kind });
      if (!title.trim()) setTitle(res.title);
      toast.success(`Imported from ${res.kind === "youtube" ? "YouTube" : res.kind === "twitter" ? "X/Twitter" : "URL"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const submitUrl = async () => {
    if (!user || !urlPreview) return;
    if (!title.trim()) return toast.error("Add a title.");
    setBusy(true);
    const { data, error } = await supabase
      .from("content_uploads")
      .insert({
        user_id: user.id,
        title,
        original_content: urlPreview.sourceUrl,
        transcript: urlPreview.content,
        content_type: urlPreview.kind === "youtube" ? "video" : "text",
        status: "ready",
      })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved!");
    navigate({ to: "/content", search: { uploadId: data.id } as any });
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Upload content</h1>
      <p className="mt-1 text-muted-foreground">Audio, video, or paste text. We'll handle the rest.</p>

      <div className="mt-8 space-y-4 rounded-2xl glass p-5 md:p-6">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder="Episode 12: Building in public" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <Tabs defaultValue="file">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="file">Upload file</TabsTrigger>
            <TabsTrigger value="url">Import from URL</TabsTrigger>
            <TabsTrigger value="text">Paste text</TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background/30 p-8 text-center transition hover:border-primary hover:bg-accent/30 md:p-12"
            >
              <UploadIcon className="h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-medium">{file ? file.name : "Drop audio/video here or tap to browse"}</p>
              <p className="mt-1 text-xs text-muted-foreground">mp3, wav, mp4, m4a · max ~9MB</p>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,video/*,.mp3,.mp4,.wav,.m4a"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button onClick={submitFile} disabled={busy || !file} className="mt-4 w-full bg-gradient-primary text-primary-foreground btn-shine shadow-glow">
              {busy ? "Working…" : "Upload & transcribe"}
            </Button>
            {busy && <div className="mt-4"><PremiumLoader label={stage || "Working"} /></div>}
          </TabsContent>

          <TabsContent value="url" className="mt-4 space-y-3">
            <Label htmlFor="url">URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="url"
                placeholder="YouTube video, blog post, or X thread URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-background/40"
              />
              <Button onClick={fetchUrl} disabled={busy || !url.trim()} variant="secondary">
                <Link2 className="mr-2 h-4 w-4" /> Fetch
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Supports YouTube (auto-transcript), articles/blogs, and X/Twitter pages.
            </p>

            {busy && stage && <PremiumLoader label={stage} />}

            {urlPreview && (
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium truncate">{urlPreview.title}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                    {urlPreview.kind}
                  </span>
                </div>
                <Textarea
                  rows={10}
                  value={urlPreview.content}
                  onChange={(e) => setUrlPreview({ ...urlPreview, content: e.target.value })}
                  className="mt-3 bg-background/40"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {urlPreview.content.length.toLocaleString()} characters extracted — edit before saving if needed.
                </p>
                <Button
                  onClick={submitUrl}
                  disabled={busy}
                  className="mt-3 w-full bg-gradient-primary text-primary-foreground btn-shine shadow-glow"
                >
                  {busy ? "Saving…" : "Save & continue"}
                </Button>
              </div>
            )}
          </TabsContent>



          <TabsContent value="text" className="mt-4">
            <Label htmlFor="text">Transcript or article</Label>
            <Textarea
              id="text"
              rows={10}
              placeholder="Paste your transcript, article, blog draft, or YouTube transcript…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="bg-background/40"
            />
            <Button onClick={submitText} disabled={busy} className="mt-4 w-full bg-gradient-primary text-primary-foreground btn-shine shadow-glow">
              <FileText className="mr-2 h-4 w-4" /> {busy ? "Saving…" : "Save content"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
