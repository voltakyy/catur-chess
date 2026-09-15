export type PieceColor = 'w' | 'b';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface PlayerInfo {
  id: string;
  name: string;
  rating: number;
  avatar?: string;
  connected: boolean;
  ready: boolean;
}

export type GameStatus = 'waiting' | 'ready' | 'playing' | 'checkmate' | 'draw' | 'stalemate' | 'resigned' | 'timeout';

export interface ChessMoveRecord {
  from: string;
  to: string;
  san: string;
  color: PieceColor;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  fenAfter: string;
  timestamp: number;
}

export interface RoomState {
  code: string;
  createdAt: number;
  updatedAt: number;
  status: GameStatus;
  fen: string;
  history: ChessMoveRecord[];
  whitePlayer: PlayerInfo | null;
  blackPlayer: PlayerInfo | null;
  hostId: string;
  turn: PieceColor;
  timeControl: {
    baseMinutes: number;
    incrementSeconds: number;
  };
  whiteTimeMs: number;
  blackTimeMs: number;
  lastMoveTime: number | null;
  winner: PieceColor | 'draw' | null;
  winReason?: string;
  drawOfferBy?: PieceColor | null;
  rematchOfferBy?: string | null;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  score: number; // Rating / ELO
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winRate: number;
  rank?: number;
  updatedAt: string;
}

export interface MoveAttempt {
  from: string;
  to: string;
  promotion?: PieceType;
}

export type BoardTheme = 'emerald' | 'wood' | 'slate' | 'midnight';
