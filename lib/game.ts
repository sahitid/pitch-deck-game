import type { GameCard, CardType, CardsData, Decks, SlotData } from "./types";

const TYPE_TO_DECK: Record<CardType, keyof Decks> = {
  product: "products",
  market: "markets",
  wildcard: "wildcards",
};

const HAND_TARGETS: Record<CardType, number> = {
  product: 3,
  market: 3,
  wildcard: 1,
};

const HAND_SIZE = 7;

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function drawFromDeck(
  decks: Decks,
  discards: Decks,
  cardsData: CardsData,
  type: keyof Decks,
  count: number
): { drawn: GameCard[]; decks: Decks; discards: Decks } {
  const newDecks = { ...decks, [type]: [...decks[type]] };
  const newDiscards = { ...discards, [type]: [...discards[type]] };
  const drawn: GameCard[] = [];
  const cardType: CardType =
    type === "products" ? "product" : type === "markets" ? "market" : "wildcard";

  for (let i = 0; i < count; i++) {
    if (newDecks[type].length === 0) {
      if (newDiscards[type].length === 0) {
        newDecks[type] = shuffle([...cardsData[type]]);
      } else {
        newDecks[type] = shuffle(newDiscards[type]);
        newDiscards[type] = [];
      }
    }
    if (newDecks[type].length > 0) {
      drawn.push({ type: cardType, text: newDecks[type].pop()! });
    }
  }

  return { drawn, decks: newDecks, discards: newDiscards };
}

export function dealHand(
  decks: Decks,
  discards: Decks,
  cardsData: CardsData
): { hand: GameCard[]; decks: Decks; discards: Decks } {
  let d = decks;
  let disc = discards;
  let hand: GameCard[] = [];

  for (const [deckKey, count] of [
    ["products", HAND_TARGETS.product],
    ["markets", HAND_TARGETS.market],
    ["wildcards", HAND_TARGETS.wildcard],
  ] as [keyof Decks, number][]) {
    const result = drawFromDeck(d, disc, cardsData, deckKey, count);
    hand = [...hand, ...result.drawn];
    d = result.decks;
    disc = result.discards;
  }

  return { hand: shuffle(hand), decks: d, discards: disc };
}

export function refillHand(
  hand: GameCard[],
  decks: Decks,
  discards: Decks,
  cardsData: CardsData
): { hand: GameCard[]; decks: Decks; discards: Decks } {
  const counts: Record<CardType, number> = { product: 0, market: 0, wildcard: 0 };
  hand.forEach((c) => counts[c.type]++);

  const needs: [keyof Decks, number][] = [
    ["products", Math.max(0, HAND_TARGETS.product - counts.product)],
    ["markets", Math.max(0, HAND_TARGETS.market - counts.market)],
    ["wildcards", Math.max(0, HAND_TARGETS.wildcard - counts.wildcard)],
  ];

  let d = decks;
  let disc = discards;
  let newCards: GameCard[] = [];
  const maxDraw = Math.max(0, HAND_SIZE - hand.length);

  for (const [type, count] of needs) {
    const drawCount = Math.min(count, Math.max(0, maxDraw - newCards.length));
    if (drawCount > 0) {
      const result = drawFromDeck(d, disc, cardsData, type, drawCount);
      newCards = [...newCards, ...result.drawn];
      d = result.decks;
      disc = result.discards;
    }
  }

  const kept = hand.map((c) => ({ ...c, isNew: false }));
  const fresh = newCards.map((c) => ({ ...c, isNew: true }));
  return { hand: [...kept, ...shuffle(fresh)], decks: d, discards: disc };
}

// ─── Slot System ───

// Slot order: 0=Product, 1=Target, 2=Double Down (any), 3=Twist (wildcard)
export function findSlotForCard(
  cardType: CardType,
  slots: SlotData[]
): number | null {
  if (cardType === "product") {
    if (!slots[0].card) return 0;
    if (!slots[1].card) return 1;
    if (!slots[2].card) return 2;
  } else if (cardType === "market") {
    if (!slots[1].card) return 1;
    if (!slots[2].card) return 2;
  } else if (cardType === "wildcard") {
    if (!slots[3].card) return 3;
    if (!slots[2].card) return 2;
  }
  return null;
}

export function buildSlotPitchText(slots: SlotData[]): string {
  const cards = slots.map((s) => s.card);
  if (!cards[0]) return "";
  let text = cards[0].text;
  if (cards[1]) {
    text +=
      cards[1].type === "product"
        ? " for " + cards[1].text
        : " " + cards[1].text;
  }
  if (cards[2]) {
    text +=
      cards[2].type === "product"
        ? " for " + cards[2].text
        : " " + cards[2].text;
  }
  if (cards[3]) {
    text += " " + cards[3].text;
  }
  return text;
}

export function filledSlotCount(slots: SlotData[]): number {
  return slots.filter((s) => s.card !== null).length;
}

export function isPitchValid(slots: SlotData[]): boolean {
  return slots[0].card !== null && slots[1].card !== null;
}

export function pointsForSlots(count: number): number {
  if (count <= 2) return 1;
  if (count === 3) return 2;
  return 3;
}

// ─── Skip & Trade ───

export function swapCards(
  hand: GameCard[],
  swapIndices: number[],
  decks: Decks,
  discards: Decks,
  cardsData: CardsData
): { hand: GameCard[]; decks: Decks; discards: Decks } {
  const swapped = swapIndices.map((i) => hand[i]);
  const remaining = hand.filter((_, i) => !swapIndices.includes(i));

  let d = { ...decks, products: [...decks.products], markets: [...decks.markets], wildcards: [...decks.wildcards] };
  let disc = discards;
  let drawn: GameCard[] = [];

  for (const card of swapped) {
    const key = TYPE_TO_DECK[card.type];
    const result = drawFromDeck(d, disc, cardsData, key, 1);
    drawn = [...drawn, ...result.drawn];
    d = result.decks;
    disc = result.discards;
  }

  for (const card of swapped) {
    const key = TYPE_TO_DECK[card.type];
    d = { ...d, [key]: [card.text, ...d[key]] };
  }

  return { hand: shuffle([...remaining, ...drawn]), decks: d, discards: disc };
}

export function drawTwoCards(
  hand: GameCard[],
  decks: Decks,
  discards: Decks,
  cardsData: CardsData
): { hand: GameCard[]; decks: Decks; discards: Decks } {
  const deckTypes: (keyof Decks)[] = ["products", "markets", "wildcards"];
  let d = decks;
  let disc = discards;
  let drawn: GameCard[] = [];

  for (let i = 0; i < 2; i++) {
    const type = deckTypes[Math.floor(Math.random() * deckTypes.length)];
    const result = drawFromDeck(d, disc, cardsData, type, 1);
    drawn = [...drawn, ...result.drawn];
    d = result.decks;
    disc = result.discards;
  }

  return { hand: [...hand, ...drawn], decks: d, discards: disc };
}
