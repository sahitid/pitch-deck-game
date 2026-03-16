"use client";

import { useEffect, useState } from "react";

const COLORS = ["#e8d5a0", "#c9a039", "#f0e6c8", "#5cff7e", "#fff8e1", "#d5cba5"];

interface Piece {
  id: number;
  left: string;
  bg: string;
  w: string;
  h: string;
  radius: string;
  delay: string;
  duration: string;
}

export function Confetti({ fire }: { fire: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (fire === 0) return;
    const p: Piece[] = Array.from({ length: 22 }, (_, i) => ({
      id: i,
      left: Math.random() * 100 + "%",
      bg: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: Math.random() * 6 + 4 + "px",
      h: Math.random() * 6 + 4 + "px",
      radius: Math.random() > 0.5 ? "50%" : "2px",
      delay: Math.random() * 1 + "s",
      duration: Math.random() * 1.2 + 1.5 + "s",
    }));
    setPieces(p);
    const t = setTimeout(() => setPieces([]), 3500);
    return () => clearTimeout(t);
  }, [fire]);

  if (!pieces.length) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute top-[-10px] opacity-0 animate-confetti-fall"
          style={{
            left: p.left,
            background: p.bg,
            width: p.w,
            height: p.h,
            borderRadius: p.radius,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}
