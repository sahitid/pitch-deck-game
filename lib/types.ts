export type CardType = "product" | "market" | "wildcard";

export interface GameCard {
  type: CardType;
  text: string;
  isNew?: boolean;
}

export interface SlotData {
  card: GameCard | null;
  handIndex: number | null;
}

export interface Pitch {
  player: string;
  cards: GameCard[];
  text: string;
  tagline: string;
  cardCount: number;
  drawTwoPenalty: number;
}

export interface HallEntry {
  text: string;
  player: string;
  round: number;
}

export type Screen =
  | "setup"
  | "round"
  | "pass"
  | "play"
  | "judge"
  | "reveal"
  | "gameover";

export interface CardsData {
  products: string[];
  markets: string[];
  wildcards: string[];
}

export interface Decks {
  products: string[];
  markets: string[];
  wildcards: string[];
}

export interface GameState {
  screen: Screen;
  players: string[];
  totalRounds: number;
  currentRound: number;
  judgeIndex: number;
  currentPitcherIndex: number;
  pitchers: string[];
  pitches: Pitch[];
  hands: Record<string, GameCard[]>;
  scores: Record<string, number>;
  decks: Decks;
  discards: Decks;
  hallOfFame: HallEntry[];
  passTarget: string;
  passRole: "pitcher" | "judge";
  revealPitch: Pitch | null;
  revealPoints: number;
  drawTwoBuff: Record<string, number>;
}
