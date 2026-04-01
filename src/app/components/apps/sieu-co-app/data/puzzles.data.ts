import { Board } from '../models/board.model';
import { Puzzle } from '../models/game-state.model';
import { PieceType, PieceColor } from '../models/piece.model';

/**
 * Sample chess puzzles (Cờ Thế)
 */
export const PUZZLES: Puzzle[] = [
  {
    id: 'puzzle-1',
    name: 'Chiếu Bí Căn Bản',
    description: 'Tìm nước chiếu bí trong 1 nước',
    difficulty: 1,
    setup: (board: Board) => {
      // Clear board first
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          board[r][c] = null;
        }
      }
      
      // Setup puzzle position
      // Red King at palace
      board[9][4] = { type: PieceType.KING, color: PieceColor.RED };
      // Black King at palace
      board[0][4] = { type: PieceType.KING, color: PieceColor.BLACK };
      // Red Rook ready to checkmate
      board[1][0] = { type: PieceType.ROOK, color: PieceColor.RED };
      // Black is stuck
      board[0][3] = { type: PieceType.ADVISOR, color: PieceColor.BLACK };
      board[0][5] = { type: PieceType.ADVISOR, color: PieceColor.BLACK };
    }
  },
  {
    id: 'puzzle-2',
    name: 'Song Mã Chiếu Bí',
    description: 'Dùng 2 mã để chiếu bí',
    difficulty: 2,
    setup: (board: Board) => {
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          board[r][c] = null;
        }
      }
      
      board[9][4] = { type: PieceType.KING, color: PieceColor.RED };
      board[0][4] = { type: PieceType.KING, color: PieceColor.BLACK };
      board[2][3] = { type: PieceType.HORSE, color: PieceColor.RED };
      board[2][5] = { type: PieceType.HORSE, color: PieceColor.RED };
      board[0][3] = { type: PieceType.ADVISOR, color: PieceColor.BLACK };
    }
  },
  {
    id: 'puzzle-3',
    name: 'Pháo Đâm Thuyền',
    description: 'Pháo và Xe phối hợp chiếu bí',
    difficulty: 3,
    setup: (board: Board) => {
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          board[r][c] = null;
        }
      }
      
      board[9][4] = { type: PieceType.KING, color: PieceColor.RED };
      board[0][4] = { type: PieceType.KING, color: PieceColor.BLACK };
      board[5][4] = { type: PieceType.CANNON, color: PieceColor.RED };
      board[3][4] = { type: PieceType.ROOK, color: PieceColor.RED };
      board[1][4] = { type: PieceType.PAWN, color: PieceColor.BLACK };
    }
  },
  {
    id: 'puzzle-4',
    name: 'Mã Hậu Pháo',
    description: 'Mã tấn công, Pháo chiếu bí',
    difficulty: 3,
    setup: (board: Board) => {
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          board[r][c] = null;
        }
      }
      
      board[9][4] = { type: PieceType.KING, color: PieceColor.RED };
      board[0][4] = { type: PieceType.KING, color: PieceColor.BLACK };
      board[4][2] = { type: PieceType.HORSE, color: PieceColor.RED };
      board[4][6] = { type: PieceType.CANNON, color: PieceColor.RED };
      board[1][3] = { type: PieceType.ADVISOR, color: PieceColor.BLACK };
      board[1][5] = { type: PieceType.ADVISOR, color: PieceColor.BLACK };
    }
  },
  {
    id: 'puzzle-5',
    name: 'Thiên La Địa Võng',
    description: 'Bẫy hoàn hảo cho Tướng đen',
    difficulty: 4,
    setup: (board: Board) => {
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          board[r][c] = null;
        }
      }
      
      board[9][4] = { type: PieceType.KING, color: PieceColor.RED };
      board[0][4] = { type: PieceType.KING, color: PieceColor.BLACK };
      board[2][4] = { type: PieceType.ROOK, color: PieceColor.RED };
      board[0][0] = { type: PieceType.ROOK, color: PieceColor.RED };
      board[1][3] = { type: PieceType.ADVISOR, color: PieceColor.BLACK };
      board[1][5] = { type: PieceType.ADVISOR, color: PieceColor.BLACK };
      board[2][2] = { type: PieceType.ELEPHANT, color: PieceColor.BLACK };
      board[2][6] = { type: PieceType.ELEPHANT, color: PieceColor.BLACK };
    }
  }
];

/**
 * Get puzzle by ID
 */
export function getPuzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find(p => p.id === id);
}

/**
 * Get puzzles by difficulty
 */
export function getPuzzlesByDifficulty(difficulty: number): Puzzle[] {
  return PUZZLES.filter(p => p.difficulty === difficulty);
}
