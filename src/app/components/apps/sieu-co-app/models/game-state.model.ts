import { Board } from './board.model';
import { PieceColor, Piece } from './piece.model';
import { MoveHistory } from './move.model';

/**
 * Chế độ chơi
 */
export enum GameMode {
  XIANGQI = 'xiangqi',     // Cờ Tướng chuẩn
  HIDDEN = 'hidden',       // Cờ Úp
  PUZZLE = 'puzzle'        // Cờ Thế
}

/**
 * Trạng thái game
 */
export enum GameStatus {
  NOT_STARTED = 'not_started',
  PLAYING = 'playing',
  PAUSED = 'paused',
  RED_WIN = 'red_win',
  BLACK_WIN = 'black_win',
  DRAW = 'draw'
}

/**
 * Độ khó AI
 */
export enum AIDifficulty {
  BEGINNER = 2,    // Tập sự
  AMATEUR = 3,     // Nghiệp dư
  EXPERT = 4,      // Kỳ thủ
  MASTER = 5       // Đại sư
}

/**
 * Theme giao diện
 */
export interface BoardTheme {
  id: string;
  name: string;
  boardLight: string;
  boardDark: string;
  lineColor: string;
  redColor: string;
  blackColor: string;
  highlightColor: string;
  selectedColor: string;
}

/**
 * Các theme có sẵn
 */
export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'wood',
    name: 'Gỗ Mộc',
    boardLight: '#e0c39a',
    boardDark: '#d4b484',
    lineColor: '#5d4037',
    redColor: '#c0392b',
    blackColor: '#2d3436',
    highlightColor: 'rgba(46, 204, 113, 0.5)',
    selectedColor: 'rgba(52, 152, 219, 0.5)'
  },
  {
    id: 'jade',
    name: 'Ngọc Bích',
    boardLight: '#a3d2ca',
    boardDark: '#5eaaa8',
    lineColor: '#056674',
    redColor: '#d63031',
    blackColor: '#2d3436',
    highlightColor: 'rgba(255, 234, 167, 0.5)',
    selectedColor: 'rgba(52, 152, 219, 0.5)'
  },
  {
    id: 'ink',
    name: 'Thủy Mặc',
    boardLight: '#ecf0f1',
    boardDark: '#bdc3c7',
    lineColor: '#2c3e50',
    redColor: '#e74c3c',
    blackColor: '#000000',
    highlightColor: 'rgba(52, 152, 219, 0.5)',
    selectedColor: 'rgba(46, 204, 113, 0.5)'
  }
];

/**
 * Cấu hình game
 */
export interface GameConfig {
  mode: GameMode;
  playerColor: PieceColor;
  aiDifficulty: AIDifficulty;
  theme: BoardTheme;
  soundEnabled: boolean;
  showHints: boolean;
}

/**
 * Trạng thái đầy đủ của game
 */
export interface GameState {
  board: Board;
  currentTurn: PieceColor;
  status: GameStatus;
  config: GameConfig;
  moveHistory: MoveHistory[];
  capturedPieces: {
    byRed: Piece[];    // Quân Đen bị Đỏ ăn
    byBlack: Piece[];  // Quân Đỏ bị Đen ăn
  };
  isCheck: boolean;
  checkingColor?: PieceColor;
  selectedPosition: { row: number; col: number } | null;
  possibleMoves: { row: number; col: number }[];
  lastMove: { from: { row: number; col: number }; to: { row: number; col: number } } | null;
  puzzleInfo?: PuzzleInfo;
}

/**
 * Thông tin puzzle
 */
export interface PuzzleInfo {
  id: number;
  name: string;
  description: string;
  difficulty: number;  // 1-5
  solution?: string[]; // Danh sách nước đi đúng
}

/**
 * Tạo game state mặc định
 */
export function createDefaultGameConfig(): GameConfig {
  return {
    mode: GameMode.XIANGQI,
    playerColor: PieceColor.RED,
    aiDifficulty: AIDifficulty.EXPERT,
    theme: BOARD_THEMES[0],
    soundEnabled: true,
    showHints: true
  };
}
