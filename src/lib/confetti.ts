import confetti from "canvas-confetti";

export function fireGoldConfetti() {
  const styles = getComputedStyle(document.documentElement);
  // Pick the live primary color so confetti follows the active accent
  const primary = styles.getPropertyValue("--primary").trim() || "oklch(0.78 0.14 86)";
  const glow = styles.getPropertyValue("--primary-glow").trim() || "oklch(0.86 0.17 92)";
  const colors = [primary, glow, "#ffffff", "#f4d27a"];

  const duration = 1400;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.7 },
      colors,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  confetti({
    particleCount: 80,
    spread: 80,
    origin: { y: 0.6 },
    colors,
    scalar: 1,
  });
}
