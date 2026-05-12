interface Props {
  label?: string;
  sublabel?: string;
}

export function PremiumLoader({ label = "Generating", sublabel }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="premium-loader" aria-hidden />
      <div>
        <div className="font-display text-lg font-semibold shimmer-text">{label}</div>
        {sublabel && <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>}
      </div>
    </div>
  );
}
