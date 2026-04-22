/**
 * Hidden Chess (Cờ Úp) Utilities
 * 
 * Cờ Tướng với tất cả quân bị úp ban đầu
 * Luật:
 * - Bàn cờ 10x9 giống cờ tướng thường
 * - Tất cả quân đều bị úp (ẩn) ban đầu
 * - Click vào quân úp để lật mở
 * - Sau khi lật, quân di chuyển theo luật cờ tướng thông thường
 */

import { Board, Position, createEmptyBoard, createStandardBoard, setPieceAt, getPieceAt, isValidPosition, createPiece, BOARD_ROWS, BOARD_COLS } from '../models/board.model';
import { PieceType, PieceColor, PieceState, Piece } from '../models/piece.model';
import { Move, createMove } from '../models/move.model';
import { generatePieceMoves as generateStandardMoves } from './move-validator.utils';

/**
 * Create hidden chess board (standard layout with all pieces hidden)
 */
export function createHiddenBoard(): Board {
  // Start with standard board
  const board = createStandardBoard();
  
  // Hide all pieces
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = getPieceAt(board, { row, col });
      if (piece) {
        // Set piece to hidden state
        setPieceAt(board, { row, col }, {
          ...piece,
          state: PieceState.HIDDEN
        });
      }
    }
  }
  
  return board;
}

/**
 * Flip a hidden piece
 */
export function flipPiece(board: Board, pos: Position): Piece | null {
  const piece = getPieceAt(board, pos);
  if (!piece || piece.state !== PieceState.HIDDEN) return null;
  
  // Reveal the piece
  const revealedPiece: Piece = {
    ...piece,
    state: PieceState.NORMAL
  };
  
  setPieceAt(board, pos, revealedPiece);
  return revealedPiece;
}

/**
 * Check if a position is valid for hidden chess (same as standard chess)
 */
export function isValidHiddenPosition(pos: Position): boolean {
  return isValidPosition(pos);
}

/**
 * Generate moves for a hidden chess piece
 * Sử dụng luật di chuyển cờ tướng thông thường
 * Chỉ khác: không thể ăn hoặc đi vào ô có quân úp
 */
export function generateHiddenPieceMoves(board: Board, pos: Position): Move[] {
  const piece = getPieceAt(board, pos);
  if (!piece || piece.state === PieceState.HIDDEN) return [];
  
  // Generate moves using standard chess rules
  const allMoves = generateStandardMoves(board, pos, true);
  
  // Filter: không thể đi vào ô có quân úp
  return allMoves.filter(move => {
    const targetPiece = getPieceAt(board, move.to);
    // Cho phép đi nếu ô trống hoặc ô có quân đã lật (của đối phương)
    return !targetPiece || targetPiece.state !== PieceState.HIDDEN;
  });
}

/**
 * Generate all valid moves for hidden chess
 * Quân đã lật đi theo luật cờ tướng thông thường
 */
export function generateAllHiddenMoves(board: Board, color: PieceColor): Move[] {
  const moves: Move[] = [];
  
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = getPieceAt(board, { row, col });
      if (piece && piece.color === color && piece.state !== PieceState.HIDDEN) {
        moves.push(...generateHiddenPieceMoves(board, { row, col }));
      }
    }
  }
  
  return moves;
}

/**
 * Get all flippable positions
 */
export function getFlippablePositions(board: Board): Position[] {
  const positions: Position[] = [];
  
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = getPieceAt(board, { row, col });
      if (piece && piece.state === PieceState.HIDDEN) {
        positions.push({ row, col });
      }
    }
  }
  
  return positions;
}

/**
 * Count pieces for each color
 */
export function countPieces(board: Board): { red: number; black: number; hidden: number } {
  let red = 0, black = 0, hidden = 0;
  
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = getPieceAt(board, { row, col });
      if (piece) {
        if (piece.state === PieceState.HIDDEN) {
          hidden++;
        } else if (piece.color === PieceColor.RED) {
          red++;
        } else if (piece.color === PieceColor.BLACK) {
          black++;
        }
      }
    }
  }
  
  return { red, black, hidden };
}

/**
 * Check if game is over (one side has no pieces)
 */
export function isHiddenGameOver(board: Board): PieceColor | null {
  const count = countPieces(board);
  
  // Game is not over if there are still hidden pieces
  if (count.hidden > 0) return null;
  
  if (count.red === 0) return PieceColor.BLACK; // Black wins
  if (count.black === 0) return PieceColor.RED; // Red wins
  
  return null;
}

/**
 * Evaluate hidden chess position for AI
 */
export function evaluateHiddenPosition(board: Board, color: PieceColor): number {
  let score = 0;
  
  // Standard piece values
  const PIECE_VALUES: Record<PieceType, number> = {
    [PieceType.NONE]: 0,
    [PieceType.KING]: 10000,
    [PieceType.ADVISOR]: 120,
    [PieceType.ELEPHANT]: 120,
    [PieceType.HORSE]: 400,
    [PieceType.ROOK]: 900,
    [PieceType.CANNON]: 450,
    [PieceType.PAWN]: 100
  };
  
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = getPieceAt(board, { row, col });
      if (piece && piece.state !== PieceState.HIDDEN) {
        const value = PIECE_VALUES[piece.type];
        if (piece.color === color) {
          score += value;
        } else {
          score -= value;
        }
      }
    }
  }
  
  // Bonus for having more moves
  const myMoves = generateAllHiddenMoves(board, color);
  const oppColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;
  const oppMoves = generateAllHiddenMoves(board, oppColor);
  
  score += (myMoves.length - oppMoves.length) * 2;
  
  return score;
}
