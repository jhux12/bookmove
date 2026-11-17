export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

export type BoardThemeId =
  | 'tournament-green'
  | 'walnut-wood'
  | 'tournament-slate'
  | 'ocean-glass'
  | 'espresso-mahogany'
  | 'midnight-charcoal'
  | 'marble-onyx'
  | 'royal-burgundy';

export type PieceSetId = 'staunton' | 'modern' | 'royal' | 'bold' | 'glass';

export type CoordinateStyle = 'inside' | 'outside' | 'hidden';
export type AnimationSpeed = 'instant' | 'snappy' | 'smooth';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  lightSquare: string;
  darkSquare: string;
  highlightLight: string;
  highlightDark: string;
  frameColor: string;
  coordOnLight: string;
  coordOnDark: string;
}

export interface PieceSetMeta {
  id: PieceSetId;
  name: string;
  description: string;
}

export interface UserPreferences {
  boardTheme: BoardThemeId;
  pieceSet: PieceSetId;
  coordinates: CoordinateStyle;
  showLegalMoves: boolean;
  soundEnabled: boolean;
  animationSpeed: AnimationSpeed;
  showEvalBar: boolean;
}

export type BotTier = 'Beginner' | 'Intermediate' | 'Advanced' | 'Master';

export interface BotProfile {
  id: string;
  name: string;
  elo: number;
  tier: BotTier;
  tagline: string;
  playstyle: string;
  avatarUrl: string;
  accentColor: string;
  searchDepth: number;
  blunderRate: number;
  noiseCp: number;
  aggression: number;
  thinkTimeMs: [number, number];
  dialogues: {
    greeting: string[];
    capture: string[];
    check: string[];
    blunder: string[];
    goodMove: string[];
    win: string[];
    lose: string[];
    draw: string[];
  };
}

export type PlaySideChoice = 'w' | 'b' | 'random';
export type AssistMode = 'challenge' | 'friendly' | 'coach';

export interface TimeControl {
  id: string;
  label: string;
  initialSeconds: number;
  incrementSeconds: number;
}

export interface MoveRecord {
  san: string;
  from: string;
  to: string;
  fen: string;
  color: PieceColor;
  captured?: PieceType;
  promotion?: PieceType;
  evalCp?: number;
}

export interface ArchivedGame {
  id: string;
  playedAt: string;
  botId: string;
  botName: string;
  botElo: number;
  playerColor: PieceColor;
  result: 'win' | 'loss' | 'draw';
  termination: string;
  openingName: string;
  moveCount: number;
  moves: MoveRecord[];
  pgn: string;
  assistMode: AssistMode;
  timeControlLabel: string;
}

export interface BoardArrow {
  from: string;
  to: string;
  color: string;
}

export interface TacticalPuzzle {
  id: string;
  title: string;
  theme: string;
  rating: number;
  fen: string;
  solution: string[];
  hintText: string;
}

export interface EndgameDrill {
  id: string;
  title: string;
  difficulty: 'Fundamental' | 'Intermediate' | 'Master';
  description: string;
  fen: string;
  playerColor: PieceColor;
  goal: string;
}

export interface OpeningTrainer {
  id: string;
  name: string;
  eco: string;
  playerColor: PieceColor;
  description: string;
  steps: {
    san: string;
    note: string;
  }[];
}

// ---------------- OPENING LEARNING & SUBSCRIPTION PLATFORM TYPES ----------------

export type SubscriptionTier = 'free' | 'pro';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'canceled';

export interface OpeningStep {
  san: string;
  note: string;
  keyIdea?: string;
}

export interface OpeningVariation {
  source?: string;
  id: string;
  courseId: string;
  name: string;
  eco: string;
  difficulty: 'Foundational' | 'Club' | 'Master';
  summary: string;
  steps: OpeningStep[];
}

export interface OpeningCourse {
  id: string;
  title: string;
  ecoRange: string;
  playerColor: PieceColor;
  tierRequired: SubscriptionTier;
  styleTag: string;
  tagline: string;
  description: string;
  variations: OpeningVariation[];
}

export interface LineProgress {
  userId: string;
  courseId: string;
  lineId: string;
  attempts: number;
  mistakes: number;
  streak: number;
  masteryPct: number;
  nextReviewMs: number;
  lastPracticedAt: string;
  weakPlies?: Record<number, number>;
}

export interface CustomOpeningLine {
  id: string;
  userId: string;
  name: string;
  playerColor: PieceColor;
  moves: string[];
  notes: string;
  createdAt: string;
}

export interface SparringSeed {
  name: string;
  moves: string[];
  playerColor: PieceColor;
  summary?: string;
}

export interface CustomLineSeed {
  name: string;
  moves: string[];
  playerColor: PieceColor;
  notes?: string;
}

export interface UserAccountProfile {
  uid: string;
  displayName: string;
  email: string;
  subscriptionTier: SubscriptionTier;
  billingCycle: BillingCycle;
  subscriptionStatus: SubscriptionStatus;
}

export type ActiveTab = 'courses' | 'training' | 'practice' | 'play' | 'customize' | 'membership';

