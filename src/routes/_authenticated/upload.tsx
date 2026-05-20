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

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">Upload file</TabsTrigger>
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
