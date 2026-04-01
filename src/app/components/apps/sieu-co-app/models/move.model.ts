import { Position } from './board.model';
import { Piece } from './piece.model';

/**
 * Nước đi trong game
 */
export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  capturedPiece?: Piece | null;
  notation?: string;        // Ký hiệu kỳ phổ
  isCheck?: boolean;        // Có chiếu không
  isCheckmate?: boolean;    // Có chiếu bí không
  score?: number;           // Điểm đánh giá (cho AI)
}

/**
 * Lịch sử nước đi
 */
export interface MoveHistory {
  move: Move;
  boardSnapshot: string;    // FEN của bàn cờ trước khi đi
  timestamp: number;
}

/**
 * Hướng di chuyển
 */
export enum MoveDirection {
  ADVANCE = '.',   // Tấn (tiến)
  RETREAT = '/',   // Thoái (lùi)
  HORIZONTAL = '-' // Bình (ngang)
}

/**
 * Tạo move object
 */
export function createMove(
  from: Position,
  to: Position,
  piece: Piece,
  capturedPiece?: Piece | null
): Move {
  return {
    from: { ...from },
    to: { ...to },
    piece: { ...piece },
    capturedPiece: capturedPiece ? { ...capturedPiece } : null
  };
}

/**
 * So sánh 2 nước đi
 */
export function movesEqual(m1: Move, m2: Move): boolean {
  return (
    m1.from.row === m2.from.row &&
    m1.from.col === m2.from.col &&
    m1.to.row === m2.to.row &&
    m1.to.col === m2.to.col
  );
}

/**
 * Chuyển move sang string đơn giản
 */
export function moveToString(move: Move): string {
  return `${move.from.row}${move.from.col}-${move.to.row}${move.to.col}`;
}
