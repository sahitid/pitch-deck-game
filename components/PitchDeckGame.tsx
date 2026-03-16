"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  CardsData,
  GameState,
  Screen,
  Pitch,
  GameCard,
  CardType,
  HallEntry,
  SlotData,
} from "@/lib/types";
import {
  shuffle,
  dealHand,
  refillHand,
  buildSlotPitchText,
  pointsForSlots,
  filledSlotCount,
  isPitchValid,
  findSlotForCard,
  swapCards,
  drawTwoCards,
} from "@/lib/game";
import { Confetti } from "./Confetti";

/* ────────────────────────────────────────────
   Card visuals
   ──────────────────────────────────────────── */

const EMPTY_SLOT: SlotData = { card: null, handIndex: null };
const emptySlots = (): SlotData[] => [
  { ...EMPTY_SLOT },
  { ...EMPTY_SLOT },
  { ...EMPTY_SLOT },
  { ...EMPTY_SLOT },
];

function cardBg(type: CardType): string {
  switch (type) {
    case "product":
      return "bg-[#0a0a0a] text-cream border-[#333]";
    case "market":
      return "bg-[#f5f0e0] text-[#1a1a0a] border-[#d5cba5]";
    case "wildcard":
      return "bg-[#fff8e1] text-[#3a2a00] border-[#c9a039]";
  }
}

function cardShadowClass(type: CardType): string {
  return type === "wildcard" ? "card-shadow-gold" : "card-shadow";
}

function labelColor(type: CardType): string {
  switch (type) {
    case "product":
      return "text-[#555]";
    case "market":
      return "text-[#998]";
    case "wildcard":
      return "text-[#a08c40]";
  }
}

const CHIP_STYLES = [
  "bg-[#c93939]/80 text-[#f5c5c5] border-[#e55555]",
  "bg-[#3971c9]/80 text-[#b5d5f5] border-[#5991e9]",
  "bg-[#2a7a3a]/80 text-[#b5f5c5] border-[#4a9a5a]",
  "bg-[#8a5a3a]/80 text-[#f5d5b5] border-[#aa7a5a]",
  "bg-[#7a3a7a]/80 text-[#f5c5f5] border-[#9a5a9a]",
];
const JUDGE_CHIP = "bg-[#c9a039]/80 text-[#f5e5b5] border-[#e8d5a0]";

function initialState(): GameState {
  return {
    screen: "setup",
    players: [],
    totalRounds: 5,
    currentRound: 0,
    judgeIndex: 0,
    currentPitcherIndex: 0,
    pitchers: [],
    pitches: [],
    hands: {},
    scores: {},
    decks: { products: [], markets: [], wildcards: [] },
    discards: { products: [], markets: [], wildcards: [] },
    hallOfFame: [],
    passTarget: "",
    passRole: "pitcher",
    revealPitch: null,
    revealPoints: 0,
    drawTwoBuff: {},
  };
}

/* ────────────────────────────────────────────
   Slot Box — card-shaped on the felt
   ──────────────────────────────────────────── */

function SlotBox({
  slot,
  label,
  hint,
  bonus,
  onClick,
}: {
  slot: SlotData;
  label: string;
  hint: string;
  bonus?: boolean;
  onClick: () => void;
}) {
  const sz = "w-[95px] sm:w-[115px] h-[135px] sm:h-[155px]";

  return (
    <div className="flex flex-col items-center">
      <span
        className={`text-[10px] font-mono uppercase tracking-widest mb-1.5 ${bonus ? "text-gold-light/60" : "text-sage/80"}`}
      >
        {bonus ? `+ ${label}` : label}
      </span>
      {slot.card ? (
        <div
          className={`${sz} rounded-lg p-[10px] flex flex-col cursor-pointer select-none border-2 ${cardShadowClass(slot.card.type)} ${cardBg(slot.card.type)}`}
          style={{ transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)" }}
          onClick={onClick}
        >
          <span
            className={`text-[8px] uppercase tracking-widest font-medium ${labelColor(slot.card.type)}`}
          >
            {slot.card.type}
          </span>
          <span className="font-bold text-[13px] leading-snug mt-auto">
            {slot.card.text}
          </span>
          <span
            className={`text-[8px] text-right mt-1 ${slot.card.type === "product" ? "text-[#555]" : "text-[#998]"}`}
          >
            ✕ remove
          </span>
        </div>
      ) : (
        <div
          className={`${sz} rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-2.5 gap-1 ${bonus ? "border-gold/30" : "border-panel-border"}`}
        >
          <span className="text-[10px] text-sage/50 text-center font-medium">
            {hint}
          </span>
          {bonus && (
            <span className="text-[8px] text-gold/40 uppercase tracking-widest">
              bonus
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   Draw Pile — decorative stacked cards
   ──────────────────────────────────────────── */

function DrawPile({
  bg,
  border,
  label,
  count,
}: {
  bg: string;
  border: string;
  label: string;
  count: number;
}) {
  const cardStyle = `w-9 h-[52px] rounded ${bg} border ${border}`;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-9 h-[52px] animate-pile-breathe">
        <div
          className={`absolute inset-0 ${cardStyle}`}
          style={{ transform: "translate(3px, 3px)" }}
        />
        <div
          className={`absolute inset-0 ${cardStyle}`}
          style={{ transform: "translate(1.5px, 1.5px)" }}
        />
        <div className={`relative ${cardStyle}`} />
      </div>
      <span className="text-[9px] font-mono text-sage/50 mt-1.5">
        {label} · {count}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════ */

export function PitchDeckGame({ cardsData }: { cardsData: CardsData }) {
  const [g, setG] = useState<GameState>(initialState);
  const [playerNames, setPlayerNames] = useState<string[]>(["", "", ""]);
  const [roundsChoice, setRoundsChoice] = useState(5);
  const [slots, setSlots] = useState<SlotData[]>(emptySlots);
  const [tagline, setTagline] = useState("");
  const [judgeSelection, setJudgeSelection] = useState(-1);
  const [shuffledPitches, setShuffledPitches] = useState<
    (Pitch & { originalIndex: number })[]
  >([]);
  const [showScores, setShowScores] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [isDealing, setIsDealing] = useState(false);
  const [skipTradeOpen, setSkipTradeOpen] = useState(false);
  const [skipTradePhase, setSkipTradePhase] = useState<
    "menu" | "swap" | null
  >(null);
  const [swapSelection, setSwapSelection] = useState<number[]>([]);

  /* ─── Derived ─── */

  const validNames = useMemo(
    () => playerNames.filter((n) => n.trim().length > 0),
    [playerNames]
  );
  const canStart =
    validNames.length >= 3 &&
    new Set(validNames.map((n) => n.trim())).size === validNames.length;

  const currentPitcher =
    g.screen === "play" ? (g.pitchers[g.currentPitcherIndex] ?? null) : null;
  const currentHand = currentPitcher ? (g.hands[currentPitcher] ?? []) : [];
  const usedHandIndices = new Set(
    slots.filter((s) => s.handIndex !== null).map((s) => s.handIndex!)
  );
  const visibleHand = currentHand.map((card, i) => ({
    card,
    index: i,
    inSlot: usedHandIndices.has(i),
  }));
  const availableCards = visibleHand.filter((h) => !h.inSlot);

  const pitchText = buildSlotPitchText(slots);
  const slotCount = filledSlotCount(slots);
  const pitchValid = isPitchValid(slots);
  const pitchPoints = pointsForSlots(slotCount);

  const drawTwoPenalty = currentPitcher ? (g.drawTwoBuff[currentPitcher] ?? 0) : 0;
  const effectivePoints = Math.max(0, pitchPoints - drawTwoPenalty);

  const pointsLabel = useMemo(() => {
    const penalty = drawTwoPenalty > 0 ? ` (−${drawTwoPenalty} draw penalty)` : "";
    if (slotCount >= 4) return `${effectivePoints}pts — triple down!${penalty}`;
    if (slotCount >= 3) return `${effectivePoints}pts — double down!${penalty}`;
    if (pitchValid) return `${effectivePoints}pt${effectivePoints !== 1 ? "s" : ""}${penalty}`;
    return "";
  }, [slotCount, pitchValid, effectivePoints, drawTwoPenalty]);

  const isLastPitcher = g.currentPitcherIndex === g.pitchers.length - 1;
  const canSkip = !isLastPitcher || g.pitches.length > 0;

  const sortedScores = useMemo(
    () =>
      g.players
        .map((p) => ({ name: p, score: g.scores[p] ?? 0 }))
        .sort((a, b) => b.score - a.score),
    [g.players, g.scores]
  );

  /* ─── Setup ─── */

  const setPlayerName = useCallback((index: number, value: string) => {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const addPlayer = useCallback(() => {
    if (playerNames.length < 10) setPlayerNames((prev) => [...prev, ""]);
  }, [playerNames.length]);

  const removePlayer = useCallback(
    (index: number) => {
      if (playerNames.length > 3)
        setPlayerNames((prev) => prev.filter((_, i) => i !== index));
    },
    [playerNames.length]
  );

  /* ─── Start ─── */

  const startGame = useCallback(() => {
    const names = playerNames.map((n) => n.trim()).filter((n) => n.length > 0);
    if (names.length < 3) return;
    let decks = {
      products: shuffle([...cardsData.products]),
      markets: shuffle([...cardsData.markets]),
      wildcards: shuffle([...cardsData.wildcards]),
    };
    let discards = {
      products: [] as string[],
      markets: [] as string[],
      wildcards: [] as string[],
    };
    const hands: Record<string, GameCard[]> = {};
    for (const name of names) {
      const result = dealHand(decks, discards, cardsData);
      hands[name] = result.hand;
      decks = result.decks;
      discards = result.discards;
    }
    const judgeIndex = 0;
    const pitchers = names.filter((_, i) => i !== judgeIndex);
    setG({
      ...initialState(),
      screen: "round",
      players: names,
      totalRounds: roundsChoice,
      currentRound: 1,
      judgeIndex,
      pitchers,
      hands,
      scores: Object.fromEntries(names.map((n) => [n, 0])),
      decks,
      discards,
      passTarget: pitchers[0],
      passRole: "pitcher",
    });
  }, [playerNames, roundsChoice, cardsData]);

  /* ─── Navigation ─── */

  const startPitching = useCallback(() => {
    setG((prev) => ({
      ...prev,
      screen: "pass" as Screen,
      passTarget: prev.pitchers[0],
      passRole: "pitcher" as const,
      currentPitcherIndex: 0,
    }));
  }, []);

  const onReady = useCallback(() => {
    setSlots(emptySlots());
    setTagline("");
    setSkipTradeOpen(false);
    setSkipTradePhase(null);
    setSwapSelection([]);
    setIsDealing(true);
    setTimeout(() => {
      setIsDealing(false);
      setG((prev) => {
        const pitcher = prev.pitchers[prev.currentPitcherIndex];
        if (!pitcher) return prev;
        const hand = prev.hands[pitcher];
        if (!hand) return prev;
        return {
          ...prev,
          hands: {
            ...prev.hands,
            [pitcher]: hand.map((c) => ({ ...c, isNew: false })),
          },
        };
      });
    }, 1200);
    setG((prev) => {
      if (prev.currentPitcherIndex < prev.pitchers.length)
        return { ...prev, screen: "play" as Screen };
      return { ...prev, screen: "judge" as Screen };
    });
  }, []);

  /* ─── Slots ─── */

  const placeCard = useCallback(
    (handIndex: number) => {
      const card = currentHand[handIndex];
      if (!card) return;
      setSlots((prev) => {
        const si = findSlotForCard(card.type, prev);
        if (si === null) return prev;
        const next = prev.map((s) => ({ ...s }));
        next[si] = { card, handIndex };
        return next;
      });
    },
    [currentHand]
  );

  const clearSlot = useCallback((si: number) => {
    setSlots((prev) => {
      const next = prev.map((s) => ({ ...s }));
      next[si] = { card: null, handIndex: null };
      return next;
    });
  }, []);

  /* ─── Submit ─── */

  const submitPitch = useCallback(() => {
    if (!isPitchValid(slots)) return;
    const name = g.pitchers[g.currentPitcherIndex];
    const chain = slots.filter((s) => s.card).map((s) => s.card!);
    const text = buildSlotPitchText(slots);
    const penaltyCount = g.drawTwoBuff[name] ?? 0;
    const pitch: Pitch = {
      player: name,
      cards: chain,
      text,
      tagline,
      cardCount: chain.length,
      drawTwoPenalty: penaltyCount,
    };
    const remaining = g.hands[name].filter((_, i) => !usedHandIndices.has(i));
    let disc = { ...g.discards };
    for (const c of chain) {
      const k =
        c.type === "product"
          ? "products"
          : c.type === "market"
            ? "markets"
            : "wildcards";
      disc = { ...disc, [k]: [...disc[k], c.text] };
    }
    const refilled = refillHand(remaining, g.decks, disc, cardsData);
    const ni = g.currentPitcherIndex + 1;
    const last = ni >= g.pitchers.length;
    setG((prev) => ({
      ...prev,
      pitches: [...prev.pitches, pitch],
      hands: { ...prev.hands, [name]: refilled.hand },
      decks: refilled.decks,
      discards: refilled.discards,
      currentPitcherIndex: ni,
      screen: "pass" as Screen,
      passTarget: last ? prev.players[prev.judgeIndex] : prev.pitchers[ni],
      passRole: last ? ("judge" as const) : ("pitcher" as const),
      drawTwoBuff: { ...prev.drawTwoBuff, [name]: 0 },
    }));
    setSlots(emptySlots());
    setTagline("");
  }, [slots, tagline, g, cardsData, usedHandIndices]);

  /* ─── Skip & Trade ─── */

  const openSkipTrade = useCallback(() => {
    setSkipTradeOpen(true);
    setSkipTradePhase("menu");
    setSwapSelection([]);
  }, []);

  const advancePitcher = useCallback(() => {
    const ni = g.currentPitcherIndex + 1;
    const last = ni >= g.pitchers.length;
    setG((prev) => ({
      ...prev,
      currentPitcherIndex: ni,
      screen: "pass" as Screen,
      passTarget: last ? prev.players[prev.judgeIndex] : prev.pitchers[ni],
      passRole: last ? ("judge" as const) : ("pitcher" as const),
    }));
    setSlots(emptySlots());
    setSkipTradeOpen(false);
    setSkipTradePhase(null);
    setSwapSelection([]);
  }, [g.currentPitcherIndex, g.pitchers.length, g.pitchers]);

  const handleSwapCards = useCallback(() => {
    if (swapSelection.length === 0 || !currentPitcher) return;
    const r = swapCards(currentHand, swapSelection, g.decks, g.discards, cardsData);
    setG((prev) => ({
      ...prev,
      hands: { ...prev.hands, [currentPitcher!]: r.hand },
      decks: r.decks,
      discards: r.discards,
    }));
    advancePitcher();
  }, [swapSelection, currentPitcher, currentHand, g.decks, g.discards, cardsData, advancePitcher]);

  const handleDrawTwo = useCallback(() => {
    if (!currentPitcher) return;
    const r = drawTwoCards(currentHand, g.decks, g.discards, cardsData);
    setG((prev) => ({
      ...prev,
      hands: { ...prev.hands, [currentPitcher!]: r.hand },
      decks: r.decks,
      discards: r.discards,
      drawTwoBuff: { ...prev.drawTwoBuff, [currentPitcher!]: (prev.drawTwoBuff[currentPitcher!] ?? 0) + 1 },
    }));
    setSkipTradeOpen(false);
    setSkipTradePhase(null);
    setIsDealing(true);
    setTimeout(() => {
      setIsDealing(false);
      setG((prev) => {
        const pitcher = prev.pitchers[prev.currentPitcherIndex];
        if (!pitcher) return prev;
        const hand = prev.hands[pitcher];
        if (!hand) return prev;
        return {
          ...prev,
          hands: {
            ...prev.hands,
            [pitcher]: hand.map((c) => ({ ...c, isNew: false })),
          },
        };
      });
    }, 1200);
  }, [currentPitcher, currentHand, g.decks, g.discards, cardsData]);

  /* ─── Judge ─── */

  const showJudge = useCallback(() => {
    if (g.pitches.length === 0) {
      setG((prev) => {
        const n = prev.currentRound + 1;
        if (n > prev.totalRounds) return { ...prev, screen: "gameover" as Screen };
        const ji = (n - 1) % prev.players.length;
        return {
          ...prev,
          screen: "round" as Screen,
          currentRound: n,
          judgeIndex: ji,
          pitchers: prev.players.filter((_, i) => i !== ji),
          pitches: [],
          currentPitcherIndex: 0,
        };
      });
      return;
    }
    setShuffledPitches(shuffle(g.pitches.map((p, i) => ({ ...p, originalIndex: i }))));
    setJudgeSelection(-1);
    setG((prev) => ({ ...prev, screen: "judge" as Screen }));
  }, [g.pitches]);

  const confirmJudge = useCallback(() => {
    if (judgeSelection < 0) return;
    const wp = g.pitches[judgeSelection];
    const basePts = pointsForSlots(wp.cardCount);
    const pts = Math.max(0, basePts - wp.drawTwoPenalty);
    setG((prev) => ({
      ...prev,
      scores: { ...prev.scores, [wp.player]: (prev.scores[wp.player] ?? 0) + pts },
      hallOfFame: [
        ...prev.hallOfFame,
        { text: wp.text, player: wp.player, round: prev.currentRound },
      ],
      revealPitch: wp,
      revealPoints: pts,
      screen: "reveal" as Screen,
    }));
    setConfettiKey((k) => k + 1);
  }, [judgeSelection, g.pitches, g.currentRound]);

  /* ─── Next Round ─── */

  const nextRound = useCallback(() => {
    setG((prev) => {
      const n = prev.currentRound + 1;
      if (n > prev.totalRounds) return { ...prev, screen: "gameover" as Screen };
      const winner = prev.revealPitch?.player;
      const wi = winner ? prev.players.indexOf(winner) : -1;
      const ji = wi >= 0 ? wi : (n - 1) % prev.players.length;
      return {
        ...prev,
        screen: "round" as Screen,
        currentRound: n,
        judgeIndex: ji,
        pitchers: prev.players.filter((_, i) => i !== ji),
        pitches: [],
        currentPitcherIndex: 0,
      };
    });
  }, []);

  /* ─── End ─── */

  const shareToX = useCallback(() => {
    const w = sortedScores[0];
    const best = g.hallOfFame.slice(0, 3).map((h) => `→ "${h.text}"`).join("\n");
    const text = `🃏 just played PITCH DECK\n\nbest pitches:\n${best}\n\n${w.name} won with ${w.score}pts 🏆\n\nplay free: ${window.location.href}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  }, [sortedScores, g.hallOfFame]);

  const playAgain = useCallback(() => setG(initialState()), []);

  /* ─── Fan math ─── */

  function fanStyle(vi: number, total: number) {
    if (total <= 1) return { transform: "rotate(0deg)", zIndex: 1 };
    const t = vi / (total - 1);
    const angle = (t - 0.5) * 16;
    const lift = Math.abs(t - 0.5) * 8;
    return {
      transform: `rotate(${angle.toFixed(1)}deg) translateY(${lift.toFixed(1)}px)`,
      zIndex: vi + 1,
    };
  }

  // ════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════

  return (
    <>
      <Confetti fire={confettiKey} />

      {/* ═══════ SETUP ═══════ */}
      {g.screen === "setup" && (
        <div className="fixed inset-0 flex flex-col items-center justify-center px-5 overflow-y-auto animate-fade-in py-10">
          <div className="w-full max-w-sm space-y-7">
            <div className="text-center space-y-2">
              <h1
                className="text-5xl font-bold tracking-tight text-cream"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: "italic" }}
              >
                Pitch Deck
              </h1>
              <p className="text-sm font-mono text-sage">
                the startup card game &middot; 3–10 players
              </p>
            </div>

            <div className="bg-panel border-2 border-panel-border rounded-lg p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <label className="text-[11px] font-mono uppercase tracking-widest text-sage/70">
                  Players
                </label>
                <span className="text-[11px] font-mono text-sage/40">
                  {validNames.length}/10
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {playerNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="flex-1 bg-felt-dark border border-panel-border rounded-lg px-4 py-3 text-cream text-sm
                        focus:border-gold/50 transition-colors outline-none placeholder:text-sage/30"
                      placeholder={`Player ${i + 1}`}
                      value={name}
                      maxLength={16}
                      onChange={(e) => setPlayerName(i, e.target.value)}
                    />
                    {playerNames.length > 3 && (
                      <button
                        className="text-sage/40 hover:text-[#c93939] transition-colors text-xl leading-none px-1"
                        onClick={() => removePlayer(i)}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {playerNames.length < 10 && (
                <button
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-panel-border text-sage/40 text-xs font-mono uppercase tracking-widest
                    hover:border-sage/40 hover:text-sage/60 transition-colors"
                  onClick={addPlayer}
                >
                  + Add Player
                </button>
              )}
              {playerNames.length >= 8 && (
                <p className="text-[11px] text-sage/40 text-center">
                  Tip: For 8+ players, try 3 rounds for a faster game
                </p>
              )}
            </div>

            <div className="bg-panel border-2 border-panel-border rounded-lg p-5 space-y-3">
              <label className="text-[11px] font-mono uppercase tracking-widest text-sage/70 block">
                Rounds
              </label>
              <div className="flex items-center justify-center gap-4">
                <button
                  className="w-12 h-12 rounded-lg border-2 border-panel-border bg-felt-dark text-sage text-xl font-bold
                    hover:border-sage/40 hover:text-cream transition-all disabled:opacity-20 disabled:pointer-events-none"
                  disabled={roundsChoice <= 1}
                  onClick={() => setRoundsChoice((r) => Math.max(1, r - 1))}
                >
                  −
                </button>
                <span className="text-3xl font-bold text-cream w-12 text-center tabular-nums">
                  {roundsChoice}
                </span>
                <button
                  className="w-12 h-12 rounded-lg border-2 border-panel-border bg-felt-dark text-sage text-xl font-bold
                    hover:border-sage/40 hover:text-cream transition-all disabled:opacity-20 disabled:pointer-events-none"
                  disabled={roundsChoice >= 15}
                  onClick={() => setRoundsChoice((r) => Math.min(15, r + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <button
              className="w-full py-4 rounded-lg bg-cream-dark text-[#1a1a0a] font-bold text-sm tracking-wide
                min-h-[56px] hover:bg-cream hover:-translate-y-0.5 transition-all
                disabled:opacity-20 disabled:pointer-events-none"
              style={{ boxShadow: "0 4px 16px rgba(232,213,160,0.2)" }}
              disabled={!canStart}
              onClick={startGame}
            >
              Deal the Cards
            </button>
          </div>
        </div>
      )}

      {/* ═══════ PASS ═══════ */}
      {g.screen === "pass" && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 animate-fade-in px-5">
          <div className="text-center space-y-3">
            <p className="text-[11px] font-mono uppercase tracking-widest text-sage/60">
              Pass the device to
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-cream">
              {g.passTarget}
            </h2>
            <p className="text-sm text-sage">
              {g.passRole === "pitcher"
                ? "Your turn to pitch"
                : "Time to judge the pitches"}
            </p>
          </div>
          <button
            className="px-10 py-4 rounded-lg bg-cream-dark text-[#1a1a0a] font-bold tracking-wide
              min-h-[56px] w-full max-w-[280px] hover:bg-cream hover:-translate-y-0.5 transition-all"
            style={{ boxShadow: "0 4px 16px rgba(232,213,160,0.2)" }}
            onClick={g.passRole === "judge" ? showJudge : onReady}
          >
            I&apos;m Ready
          </button>
        </div>
      )}

      {/* ═══════ ROUND ANNOUNCE ═══════ */}
      {g.screen === "round" && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 animate-fade-in px-5">
          <div className="text-center space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-widest text-sage/60">
              Round
            </p>
            <p className="text-6xl font-bold tracking-tight text-cream">
              {g.currentRound}
              <span className="text-sage/40">/{g.totalRounds}</span>
            </p>
          </div>
          <div
            className="px-6 py-4 rounded-lg border-2 border-gold/40 text-center space-y-1"
            style={{
              background: "rgba(201,160,57,0.08)",
              boxShadow: "0 0 20px rgba(201,160,57,0.1)",
            }}
          >
            <p className="text-[10px] font-mono uppercase tracking-widest text-gold/60">
              VC Judge
            </p>
            <p className="text-xl font-bold text-gold-light">
              {g.players[g.judgeIndex]}
            </p>
          </div>
          <button
            className="px-10 py-4 rounded-lg bg-cream-dark text-[#1a1a0a] font-bold tracking-wide
              min-h-[56px] hover:bg-cream hover:-translate-y-0.5 transition-all"
            style={{ boxShadow: "0 4px 16px rgba(232,213,160,0.2)" }}
            onClick={startPitching}
          >
            Start Pitching
          </button>
        </div>
      )}

      {/* ═══════ PLAY ═══════ */}
      {g.screen === "play" && (
        <div className="fixed inset-0 flex flex-col animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-felt-dark/60 border-b border-panel-border/50 shrink-0">
            <span className="text-sm font-bold tracking-tight text-cream/80">
              PITCH DECK
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-sage/50">
                Rd {g.currentRound}/{g.totalRounds}
              </span>
              <button
                className="text-[11px] font-mono text-sage/50 hover:text-cream transition-colors"
                onClick={() => setShowScores(true)}
              >
                Scores
              </button>
            </div>
          </div>

          {/* Score Chips */}
          <div className="flex flex-wrap gap-1.5 px-4 py-2 shrink-0">
            {g.players.map((p, i) => {
              const isJudge = i === g.judgeIndex;
              const isCurrent = p === currentPitcher;
              const chip = isJudge
                ? JUDGE_CHIP
                : CHIP_STYLES[i % CHIP_STYLES.length];
              return (
                <div
                  key={p}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold border whitespace-nowrap
                    ${chip}
                    ${isCurrent && !isJudge ? "ring-1 ring-cream/40" : ""}`}
                >
                  {isJudge ? "⚖ " : ""}
                  {p} {!isJudge && g.scores[p] !== undefined ? g.scores[p] : ""}
                </div>
              );
            })}
          </div>

          {/* Scrollable center */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="max-w-lg mx-auto px-5 py-4 space-y-5">
              {/* Draw 2 penalty banner */}
              {drawTwoPenalty > 0 && (
                <div className="text-center text-[11px] font-mono text-[#c93939]/80 bg-[#c93939]/10 border border-[#c93939]/20 rounded-lg py-1.5 px-3">
                  −{drawTwoPenalty} point penalty active (Draw 2)
                </div>
              )}

              {/* Draw Piles */}
              <div className="flex gap-5 justify-center">
                <DrawPile
                  bg="bg-[#0a0a0a]"
                  border="border-[#333]"
                  label="PRD"
                  count={g.decks.products.length}
                />
                <DrawPile
                  bg="bg-[#f5f0e0]"
                  border="border-[#d5cba5]"
                  label="MKT"
                  count={g.decks.markets.length}
                />
                <DrawPile
                  bg="bg-[#fff8e1]"
                  border="border-[#c9a039]"
                  label="WLD"
                  count={g.decks.wildcards.length}
                />
              </div>

              {/* Pitch Builder Panel */}
              <div className="bg-panel border-2 border-panel-border rounded-lg p-4 space-y-4">
                {/* Required slots */}
                <div className="flex items-end justify-center gap-1">
                  <SlotBox
                    slot={slots[0]}
                    label="Product"
                    hint="Tap a black card"
                    onClick={() => clearSlot(0)}
                  />
                  <span className="text-sage/50 text-base font-medium mx-2 pb-16 sm:pb-20 italic">
                    for
                  </span>
                  <SlotBox
                    slot={slots[1]}
                    label="Target"
                    hint="Black or cream card"
                    onClick={() => clearSlot(1)}
                  />
                </div>

                {/* Bonus slots */}
                <div className="flex items-end justify-center gap-3">
                  <SlotBox
                    slot={slots[2]}
                    label="Double Down"
                    hint="Any card"
                    bonus
                    onClick={() => clearSlot(2)}
                  />
                  <SlotBox
                    slot={slots[3]}
                    label="Twist"
                    hint="Gold card"
                    bonus
                    onClick={() => clearSlot(3)}
                  />
                </div>
                <p className="text-[10px] font-mono text-sage/30 text-center">
                  2 cards = 1pt &middot; double down = 2pts &middot; triple
                  down = 3pts
                </p>

                {/* Pitch Preview */}
                {pitchText && (
                  <div className="text-center pt-2 space-y-1.5">
                    <p className="text-xl sm:text-2xl font-extrabold leading-snug break-words text-cream tracking-tight">
                      &ldquo;{pitchText}&rdquo;
                    </p>
                    <p className="text-sm font-bold text-gold-light">
                      {pointsLabel}
                    </p>
                  </div>
                )}

                {/* Tagline */}
                {pitchValid && (
                  <input
                    className="w-full bg-felt-dark border border-panel-border rounded-lg px-4 py-2.5 text-cream text-sm
                      focus:border-gold/40 transition-colors outline-none placeholder:text-sage/25"
                    placeholder="Add a tagline..."
                    maxLength={80}
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Card Fan — THE hand */}
          <div className="shrink-0 pt-1 pb-[max(8px,env(safe-area-inset-bottom))]">
            <p className="text-center text-[9px] font-mono uppercase tracking-widest text-sage/30 mb-1">
              {currentPitcher}&apos;s hand
            </p>
            <div className="flex justify-center items-end px-4 overflow-x-auto scrollbar-hide">
              {availableCards.map(({ card, index }, vi) => {
                const fs = fanStyle(vi, availableCards.length);
                const isNew = card.isNew && isDealing;
                let newIdx = 0;
                if (isNew) {
                  for (let j = 0; j < vi; j++) {
                    if (availableCards[j].card.isNew) newIdx++;
                  }
                }
                return (
                  <div
                    key={`${currentPitcher}-${index}`}
                    className={`fan-card shrink-0 w-[95px] sm:w-[115px] h-[135px] sm:h-[155px] rounded-lg p-[10px] flex flex-col
                      cursor-pointer select-none border-2 ${cardShadowClass(card.type)} ${cardBg(card.type)}
                      ${vi < availableCards.length - 1 ? "-mr-3.5" : ""}
                      ${isDealing && !card.isNew ? "animate-card-deal" : ""}
                      ${isNew ? "animate-card-new" : ""}`}
                    style={{
                      ...fs,
                      ...(isDealing && !card.isNew
                        ? { animationDelay: `${vi * 60}ms` }
                        : {}),
                      ...(isNew
                        ? { animationDelay: `${400 + newIdx * 120}ms`, opacity: 0 }
                        : {}),
                    }}
                    onClick={() => placeCard(index)}
                  >
                    <span
                      className={`text-[8px] uppercase tracking-widest font-medium ${labelColor(card.type)}`}
                    >
                      {card.type}
                    </span>
                    <span className="font-bold text-[14px] leading-snug mt-auto">
                      {card.text}
                    </span>
                    {isNew && (
                      <span className="text-[7px] font-mono uppercase tracking-widest text-gold/60 mt-0.5">
                        new
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sticky Action Bar */}
          <div className="shrink-0 bg-felt-dark/80 border-t border-panel-border/50 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="flex gap-3 max-w-lg mx-auto">
              {canSkip && (
                <button
                  className="flex-1 py-3 rounded-lg bg-panel border border-panel-border text-sage text-sm font-medium
                    hover:border-sage/50 hover:-translate-y-0.5 transition-all"
                  onClick={openSkipTrade}
                >
                  Skip &amp; Trade
                </button>
              )}
              <button
                className={`flex-1 py-3 rounded-lg bg-cream-dark text-[#1a1a0a] font-bold text-sm
                  hover:bg-cream hover:-translate-y-0.5 transition-all
                  ${!pitchValid ? "opacity-20 pointer-events-none" : ""}`}
                style={
                  pitchValid
                    ? { boxShadow: "0 4px 12px rgba(232,213,160,0.15)" }
                    : undefined
                }
                onClick={submitPitch}
              >
                Submit Pitch &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ JUDGE ═══════ */}
      {g.screen === "judge" && (
        <div className="fixed inset-0 flex flex-col animate-fade-in">
          <div className="text-center py-5 border-b border-panel-border/50 shrink-0 px-5">
            <h2 className="text-lg font-bold tracking-tight text-cream">
              {g.players[g.judgeIndex]}, pick the best pitch
            </h2>
            <p className="text-[11px] font-mono text-sage/50 mt-1">
              Tap to select, then fund it
            </p>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="max-w-lg mx-auto p-5 flex flex-col gap-4">
              {shuffledPitches.map((pitch, pi) => {
                const basePts = pointsForSlots(pitch.cardCount);
                const pts = Math.max(0, basePts - pitch.drawTwoPenalty);
                const selected = judgeSelection === pitch.originalIndex;
                const tilt = ["-1.5deg", "0.5deg", "-0.8deg", "1.2deg", "-0.3deg"][pi % 5];
                return (
                  <div
                    key={pitch.originalIndex}
                    className={`w-full rounded-lg p-6 cursor-pointer border-2 text-center transition-all
                      ${
                        selected
                          ? "border-gold-light bg-[#0a0a0a]"
                          : "border-[#333] bg-[#0a0a0a] hover:border-[#555]"
                      }`}
                    style={{
                      transform: `rotate(${tilt})`,
                      boxShadow: selected
                        ? "0 4px 24px rgba(232,213,160,0.2), 0 2px 8px rgba(0,0,0,0.4)"
                        : "0 2px 8px rgba(0,0,0,0.4)",
                      transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                    onClick={() => setJudgeSelection(pitch.originalIndex)}
                  >
                    <p className="text-xl font-bold leading-snug text-cream tracking-tight">
                      {pitch.text}
                    </p>
                    {pitch.tagline && (
                      <p className="text-sm text-sage italic mt-2">
                        &ldquo;{pitch.tagline}&rdquo;
                      </p>
                    )}
                    <p className="text-[10px] font-mono text-sage/40 mt-3">
                      {pitch.cardCount} cards &middot; {pts}pt{pts > 1 ? "s" : ""}
                      {pitch.drawTwoPenalty > 0 && (
                        <span className="text-[#c93939]"> (−{pitch.drawTwoPenalty} draw penalty)</span>
                      )}
                    </p>
                    {selected && (
                      <p
                        className="text-sm font-extrabold text-gold-light uppercase tracking-widest mt-3"
                        style={{ transform: "rotate(-2deg)" }}
                      >
                        💰 Funded
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {judgeSelection >= 0 && (
            <div className="shrink-0 bg-felt-dark/80 border-t border-panel-border/50 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <button
                className="w-full max-w-lg mx-auto block py-4 rounded-lg bg-cream-dark text-[#1a1a0a] font-bold tracking-wide
                  min-h-[56px] hover:bg-cream hover:-translate-y-0.5 transition-all"
                style={{ boxShadow: "0 4px 16px rgba(232,213,160,0.2)" }}
                onClick={confirmJudge}
              >
                Fund This Startup
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════ REVEAL ═══════ */}
      {g.screen === "reveal" && (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 px-5 animate-fade-in">
          <p
            className="text-sm font-extrabold uppercase tracking-widest text-funded"
            style={{ transform: "rotate(-3deg)" }}
          >
            Funded
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center leading-tight tracking-tight text-cream max-w-lg break-words">
            &ldquo;{g.revealPitch?.text}&rdquo;
          </h2>
          {g.revealPitch?.tagline && (
            <p className="text-sm text-sage italic text-center">
              &ldquo;{g.revealPitch.tagline}&rdquo;
            </p>
          )}
          <p className="text-sage">
            Pitched by{" "}
            <span className="font-bold text-cream">{g.revealPitch?.player}</span>
          </p>
          <div
            className="px-5 py-1.5 rounded-full border-2 border-gold/50 text-gold-light font-bold text-sm"
            style={{ background: "rgba(201,160,57,0.1)" }}
          >
            +{g.revealPoints} point{g.revealPoints > 1 ? "s" : ""}
          </div>
          <button
            className="mt-4 px-10 py-4 rounded-lg bg-cream-dark text-[#1a1a0a] font-bold tracking-wide
              min-h-[56px] hover:bg-cream hover:-translate-y-0.5 transition-all"
            style={{ boxShadow: "0 4px 16px rgba(232,213,160,0.2)" }}
            onClick={nextRound}
          >
            {g.currentRound >= g.totalRounds ? "See Results" : "Next Round"}
          </button>
        </div>
      )}

      {/* ═══════ GAME OVER ═══════ */}
      {g.screen === "gameover" && (
        <div className="fixed inset-0 flex flex-col items-center pt-12 px-5 overflow-y-auto animate-fade-in pb-12">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <p className="text-[11px] font-mono uppercase tracking-widest text-sage/50">
                Game Over
              </p>
              <p className="text-4xl font-extrabold tracking-tight text-cream">
                {sortedScores[0]?.name}
              </p>
              <p className="text-funded font-bold">
                {sortedScores[0]?.score} point
                {sortedScores[0]?.score !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="bg-panel border-2 border-panel-border rounded-lg overflow-hidden">
              {sortedScores.map((p, i) => (
                <div
                  key={p.name}
                  className={`flex items-center px-4 py-3 text-sm ${i > 0 ? "border-t border-panel-border/50" : ""}`}
                >
                  <span className="text-sage/40 w-6 font-mono text-xs">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium text-cream">
                    {p.name}
                  </span>
                  <span className="text-gold-light font-bold">{p.score}</span>
                </div>
              ))}
            </div>

            {g.hallOfFame.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-sage/40 text-center">
                  Best Pitches
                </p>
                <div className="space-y-2">
                  {g.hallOfFame.map((h: HallEntry, i: number) => (
                    <div
                      key={i}
                      className="bg-[#0a0a0a] border-2 border-[#333] rounded-lg px-4 py-3 card-shadow"
                    >
                      <p className="font-bold text-sm leading-snug text-cream">
                        &ldquo;{h.text}&rdquo;
                      </p>
                      <p className="text-[10px] text-sage/40 font-mono mt-1">
                        Round {h.round} &middot; {h.player}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 py-4 rounded-lg bg-panel border border-panel-border text-sage font-medium text-sm
                  min-h-[56px] hover:border-sage/50 hover:-translate-y-0.5 transition-all"
                onClick={shareToX}
              >
                Share to 𝕏
              </button>
              <button
                className="flex-1 py-4 rounded-lg bg-cream-dark text-[#1a1a0a] font-bold text-sm
                  min-h-[56px] hover:bg-cream hover:-translate-y-0.5 transition-all"
                style={{ boxShadow: "0 4px 16px rgba(232,213,160,0.2)" }}
                onClick={playAgain}
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ SCORES MODAL ═══════ */}
      {showScores && (
        <div
          className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center p-5 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowScores(false);
          }}
        >
          <div className="bg-panel border-2 border-panel-border rounded-lg p-6 w-full max-w-[360px]">
            <h3 className="font-bold text-center text-lg text-cream tracking-tight mb-4">
              Scores
            </h3>
            <div className="space-y-0">
              {sortedScores.map((p, i) => (
                <div
                  key={p.name}
                  className={`flex justify-between py-2.5 text-sm ${i > 0 ? "border-t border-panel-border/50" : ""}`}
                >
                  <span className="text-cream/80">{p.name}</span>
                  <span className="font-bold text-gold-light">{p.score}</span>
                </div>
              ))}
            </div>
            <button
              className="w-full mt-4 py-3 rounded-lg bg-felt-dark border border-panel-border text-sage text-sm font-medium
                hover:border-sage/50 transition-colors"
              onClick={() => setShowScores(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ═══════ SKIP & TRADE MODAL ═══════ */}
      {skipTradeOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[500] flex items-end sm:items-center justify-center animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSkipTradeOpen(false);
              setSkipTradePhase(null);
            }
          }}
        >
          <div className="bg-panel border-t-2 sm:border-2 border-panel-border sm:rounded-lg rounded-t-lg p-6 w-full max-w-sm">
            {skipTradePhase === "menu" && (
              <div className="space-y-3">
                <div className="text-center space-y-1 mb-4">
                  <h3 className="font-bold text-lg text-cream tracking-tight">
                    Skip &amp; Trade
                  </h3>
                  <p className="text-sm text-sage/60">
                    Skip your turn and refresh your hand
                  </p>
                </div>

                <button
                  className="w-full py-4 rounded-lg bg-felt-dark border border-panel-border text-left px-5
                    hover:border-sage/50 transition-colors"
                  onClick={() => setSkipTradePhase("swap")}
                >
                  <span className="font-bold text-sm text-cream">
                    Swap Cards
                  </span>
                  <span className="block text-[11px] text-sage/50 mt-0.5">
                    Discard up to 3 cards and draw replacements
                  </span>
                </button>

                <button
                  className="w-full py-4 rounded-lg bg-felt-dark border border-panel-border text-left px-5
                    hover:border-sage/50 transition-colors"
                  onClick={handleDrawTwo}
                >
                  <span className="font-bold text-sm text-cream">Draw 2</span>
                  <span className="block text-[11px] text-sage/50 mt-0.5">
                    Draw 2 extra cards, but −1 point if you win
                  </span>
                </button>

                <button
                  className="w-full py-2.5 text-sage/40 text-sm font-medium
                    hover:text-sage transition-colors"
                  onClick={() => {
                    setSkipTradeOpen(false);
                    setSkipTradePhase(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {skipTradePhase === "swap" && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="font-bold text-lg text-cream tracking-tight">
                    Swap Cards
                  </h3>
                  <p className="text-sm text-sage/60">
                    Select up to 3 ({swapSelection.length}/3)
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  {currentHand.map((card, i) => {
                    const isSel = swapSelection.includes(i);
                    return (
                      <div
                        key={i}
                        className={`w-[75px] h-[105px] rounded-lg p-2 flex flex-col cursor-pointer border-2 text-[10px]
                          ${cardBg(card.type)} ${cardShadowClass(card.type)}
                          ${isSel ? "border-gold-light opacity-60 scale-95" : "hover:scale-105"}`}
                        style={{ transition: "all 0.15s ease" }}
                        onClick={() => {
                          if (isSel)
                            setSwapSelection((p) => p.filter((x) => x !== i));
                          else if (swapSelection.length < 3)
                            setSwapSelection((p) => [...p, i]);
                        }}
                      >
                        <span
                          className={`text-[7px] uppercase tracking-widest font-medium ${labelColor(card.type)}`}
                        >
                          {card.type}
                        </span>
                        <span className="font-bold text-[10px] leading-tight mt-auto">
                          {card.text}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button
                  className="w-full py-3.5 rounded-lg bg-cream-dark text-[#1a1a0a] font-bold text-sm
                    disabled:opacity-20 disabled:pointer-events-none transition-all"
                  disabled={swapSelection.length === 0}
                  onClick={handleSwapCards}
                >
                  Confirm Swap
                </button>

                <button
                  className="w-full py-2.5 text-sage/40 text-sm font-medium
                    hover:text-sage transition-colors"
                  onClick={() => {
                    setSkipTradePhase("menu");
                    setSwapSelection([]);
                  }}
                >
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
