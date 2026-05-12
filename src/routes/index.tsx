import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Sparkles, Wand2, Mic, FileText, Twitter, Linkedin, Instagram, Mail, Video, ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Repurpo — Turn one idea into a week of content" },
      { name: "description", content: "AI content repurposing in your brand voice. One upload becomes a Twitter thread, LinkedIn post, Instagram caption, newsletter, and short-form script." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <Logos />
      <Features />
      <Workflow />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </span>
          Repurpo
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#workflow" className="hover:text-foreground">How it works</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/login">Sign in</Link></Button>
          <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground btn-shine shadow-glow"><Link to="/signup">Get started</Link></Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 text-center">
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur ring-glow">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        Powered by Gemini & Chirp 3
      </div>
      <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-7xl">
        Turn one idea into <br />
        <span className="text-gradient">a week of content.</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
        Upload a video, podcast, or rough draft. Repurpo transcribes it, learns your brand voice,
        and turns it into platform-native posts for X, LinkedIn, Instagram, your newsletter, and Reels.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground btn-shine shadow-glow">
          <Link to="/signup">Start free <ArrowRight className="ml-1 h-4 w-4" /></Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href="#workflow">See how it works</a>
        </Button>
      </div>
      <div className="mt-16 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { i: Twitter, l: "Twitter thread" },
          { i: Linkedin, l: "LinkedIn post" },
          { i: Instagram, l: "IG caption" },
          { i: Mail, l: "Newsletter" },
          { i: Video, l: "Reel script" },
        ].map(({ i: Icon, l }) => (
          <div key={l} className="rounded-xl glass p-4 hover-lift">
            <Icon className="mx-auto h-5 w-5 text-primary" />
            <div className="mt-2 text-xs font-medium">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Logos() {
  return (
    <section className="border-y border-border/60 bg-background py-8">
      <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
        Built for solo creators, podcasters, founders & agencies
      </p>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Mic, title: "Auto-transcribe", body: "Upload audio or video — Chirp 3 returns a clean transcript in seconds." },
    { icon: Wand2, title: "Brand voice memory", body: "Paste your past posts. Repurpo learns your tone, hooks, and style." },
    { icon: Sparkles, title: "Platform-native output", body: "Each post is rewritten in the language of its platform — not generic AI." },
    { icon: FileText, title: "Edit & export", body: "Tweak inline, copy with one click, export to your scheduler." },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="text-center font-display text-4xl font-bold">Built to sound like you.</h2>
      <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
        Most AI tools spit out the same beige paragraphs. Repurpo studies your voice first.
      </p>
      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl glass p-6 hover-lift">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Workflow() {
  const steps = [
    { n: "01", t: "Upload", d: "Drop in audio, video, transcript, or paste raw text." },
    { n: "02", t: "Set your voice", d: "Paste 3-5 past posts so Repurpo learns your style." },
    { n: "03", t: "Generate", d: "Pick platforms — get every asset in seconds." },
  ];
  return (
    <section id="workflow" className="border-y border-border/40 bg-card/20 py-24 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center font-display text-4xl font-bold">From input to inbox in 3 steps</h2>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl glass p-8 hover-lift">
              <div className="font-display text-5xl font-bold text-gradient">{s.n}</div>
              <h3 className="mt-4 font-display text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    { name: "Free", price: "$0", desc: "Try it out", features: ["3 generations / mo", "1 voice profile", "All platforms"] },
    { name: "Creator", price: "$19", desc: "Most popular", features: ["100 generations / mo", "5 voice profiles", "Audio transcription", "Priority models"], featured: true },
    { name: "Studio", price: "$49", desc: "For agencies", features: ["Unlimited generations", "Unlimited voices", "Team workspace", "API access"] },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="text-center font-display text-4xl font-bold">Simple pricing</h2>
      <p className="mt-4 text-center text-muted-foreground">Start free. Upgrade when you're publishing daily.</p>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`rounded-2xl p-8 hover-lift ${t.featured ? "glass-strong border-primary/40 ring-glow" : "glass"}`}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-xl font-semibold">{t.name}</h3>
              <span className="text-xs text-muted-foreground">{t.desc}</span>
            </div>
            <div className="mt-4">
              <span className="font-display text-4xl font-bold">{t.price}</span>
              <span className="text-sm text-muted-foreground">/mo</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <Button asChild className={`mt-6 w-full ${t.featured ? "bg-gradient-primary text-primary-foreground btn-shine shadow-glow" : ""}`} variant={t.featured ? "default" : "outline"}>
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24 text-center">
      <div className="rounded-3xl border border-primary/40 bg-gradient-primary p-12 text-primary-foreground shadow-elegant btn-shine">
        <h2 className="font-display text-4xl font-bold">Stop rewriting. Start repurposing.</h2>
        <p className="mx-auto mt-4 max-w-lg opacity-90">Free to start. No credit card required.</p>
        <Button asChild size="lg" variant="secondary" className="mt-8">
          <Link to="/signup">Create your account <ArrowRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
      © {new Date().getFullYear()} Repurpo. Built with Lovable.
    </footer>
  );
}
