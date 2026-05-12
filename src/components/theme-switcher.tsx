import { Check, Palette } from "lucide-react";
import { ACCENTS, useTheme } from "@/lib/theme-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ThemeSwitcher({ size = "icon" }: { size?: "icon" | "sm" }) {
  const { accent, setAccent } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="border-border/60 bg-card/40 backdrop-blur">
          <Palette className="h-4 w-4" />
          {size !== "icon" && <span className="ml-1.5">Theme</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-strong">
        <DropdownMenuLabel>Accent color</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACCENTS.map((a) => (
          <DropdownMenuItem
            key={a.id}
            onClick={() => setAccent(a.id)}
            className="flex items-center gap-3"
          >
            <span
              className="h-5 w-5 rounded-full ring-1 ring-border"
              style={{ background: a.swatch }}
            />
            <span className="flex-1">{a.label}</span>
            {accent === a.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
