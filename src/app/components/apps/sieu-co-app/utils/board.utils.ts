import { Board, BOARD_COLS, BOARD_ROWS, Position, createEmptyBoard } from '../models/board.model';
import { Piece, PieceColor, PieceType } from '../models/piece.model';

/**
 * Board utility functions
 */

/**
 * Get piece at position
 */
export function getPieceAt(board: Board, pos: Position): Piece | null {
  if (pos.row < 0 || pos.row >= BOARD_ROWS || pos.col < 0 || pos.col >= BOARD_COLS) {
    return null;
  }
  return board[pos.row][pos.col];
}

/**
 * Set piece at position
 */
export function setPieceAt(board: Board, pos: Position, piece: Piece | null): void {
  if (pos.row >= 0 && pos.row < BOARD_ROWS && pos.col >= 0 && pos.col < BOARD_COLS) {
    board[pos.row][pos.col] = piece;
  }
}

/**
 * Find king position for a color
 */
export function findKingPosition(board: Board, color: PieceColor): Position | null {
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PieceType.KING && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

/**
 * Check if two kings are facing each other (飞将)
 */
export function areKingsFacing(board: Board): boolean {
  const redKing = findKingPosition(board, PieceColor.RED);
  const blackKing = findKingPosition(board, PieceColor.BLACK);
  
  if (!redKing || !blackKing) return false;
  if (redKing.col !== blackKing.col) return false;
  
  // Check if any piece between the kings
  const minRow = Math.min(redKing.row, blackKing.row);
  const maxRow = Math.max(redKing.row, blackKing.row);
  
  for (let row = minRow + 1; row < maxRow; row++) {
    if (board[row][redKing.col] !== null) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all pieces of a color
 */
export function getPiecesOfColor(board: Board, color: PieceColor): { piece: Piece; pos: Position }[] {
  const pieces: { piece: Piece; pos: Position }[] = [];
  
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        pieces.push({ piece, pos: { row, col } });
      }
    }
  }
  
  return pieces;
}

/**
 * Generate a hash string for the board position
 */
export function getBoardHash(board: Board, turn: PieceColor): string {
  let hash = turn + ':';
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = board[row][col];
      if (piece) {
        hash += `${row}${col}${piece.color[0]}${piece.type}|`;
      }
    }
  }
  return hash;
}

/**
 * Setup standard starting position
 */
export function setupStandardBoard(): Board {
  const board = createEmptyBoard();
  
  // Black pieces (top)
  board[0][0] = { type: PieceType.ROOK, color: PieceColor.BLACK };
  board[0][1] = { type: PieceType.HORSE, color: PieceColor.BLACK };
  board[0][2] = { type: PieceType.ELEPHANT, color: PieceColor.BLACK };
  board[0][3] = { type: PieceType.ADVISOR, color: PieceColor.BLACK };
  board[0][4] = { type: PieceType.KING, color: PieceColor.BLACK };
  board[0][5] = { type: PieceType.ADVISOR, color: PieceColor.BLACK };
  board[0][6] = { type: PieceType.ELEPHANT, color: PieceColor.BLACK };
  board[0][7] = { type: PieceType.HORSE, color: PieceColor.BLACK };
  board[0][8] = { type: PieceType.ROOK, color: PieceColor.BLACK };
  
  board[2][1] = { type: PieceType.CANNON, color: PieceColor.BLACK };
  board[2][7] = { type: PieceType.CANNON, color: PieceColor.BLACK };
  
  board[3][0] = { type: PieceType.PAWN, color: PieceColor.BLACK };
  board[3][2] = { type: PieceType.PAWN, color: PieceColor.BLACK };
  board[3][4] = { type: PieceType.PAWN, color: PieceColor.BLACK };
  board[3][6] = { type: PieceType.PAWN, color: PieceColor.BLACK };
  board[3][8] = { type: PieceType.PAWN, color: PieceColor.BLACK };
  
  // Red pieces (bottom)
  board[9][0] = { type: PieceType.ROOK, color: PieceColor.RED };
  board[9][1] = { type: PieceType.HORSE, color: PieceColor.RED };
  board[9][2] = { type: PieceType.ELEPHANT, color: PieceColor.RED };
  board[9][3] = { type: PieceType.ADVISOR, color: PieceColor.RED };
  board[9][4] = { type: PieceType.KING, color: PieceColor.RED };
  board[9][5] = { type: PieceType.ADVISOR, color: PieceColor.RED };
  board[9][6] = { type: PieceType.ELEPHANT, color: PieceColor.RED };
  board[9][7] = { type: PieceType.HORSE, color: PieceColor.RED };
  board[9][8] = { type: PieceType.ROOK, color: PieceColor.RED };
  
  board[7][1] = { type: PieceType.CANNON, color: PieceColor.RED };
  board[7][7] = { type: PieceType.CANNON, color: PieceColor.RED };
  
  board[6][0] = { type: PieceType.PAWN, color: PieceColor.RED };
  board[6][2] = { type: PieceType.PAWN, color: PieceColor.RED };
  board[6][4] = { type: PieceType.PAWN, color: PieceColor.RED };
  board[6][6] = { type: PieceType.PAWN, color: PieceColor.RED };
  board[6][8] = { type: PieceType.PAWN, color: PieceColor.RED };
  
  return board;
}

/**
 * Count pieces on the board
 */
export function countPieces(board: Board): { red: number; black: number; total: number } {
  let red = 0, black = 0;
  
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = board[row][col];
      if (piece) {
        if (piece.color === PieceColor.RED) red++;
        else black++;
      }
    }
  }
  
  return { red, black, total: red + black };
}
