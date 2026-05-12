import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Accent = "gold" | "emerald" | "sapphire" | "rose" | "violet";

export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: "gold", label: "Gold", swatch: "linear-gradient(135deg, #b8893a, #f4d27a, #b8893a)" },
  { id: "emerald", label: "Emerald", swatch: "linear-gradient(135deg, #1f9c6b, #6ce6ad, #1f9c6b)" },
  { id: "sapphire", label: "Sapphire", swatch: "linear-gradient(135deg, #2554d6, #7aa4ff, #2554d6)" },
  { id: "rose", label: "Rose", swatch: "linear-gradient(135deg, #c63760, #ff8caa, #c63760)" },
  { id: "violet", label: "Violet", swatch: "linear-gradient(135deg, #6b2dc6, #b48bff, #6b2dc6)" },
];

interface Ctx {
  accent: Accent;
  setAccent: (a: Accent) => void;
}

const ThemeCtx = createContext<Ctx>({ accent: "gold", setAccent: () => {} });

const KEY = "repurpo:accent";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<Accent>("gold");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem(KEY) as Accent)) || "gold";
    setAccentState(stored);
    document.documentElement.dataset.accent = stored;
  }, []);

  const setAccent = (a: Accent) => {
    setAccentState(a);
    if (typeof window !== "undefined") {
      localStorage.setItem(KEY, a);
      document.documentElement.dataset.accent = a;
    }
  };

  return <ThemeCtx.Provider value={{ accent, setAccent }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
