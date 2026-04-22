import { Piece, PieceType, PieceColor, PieceState } from './piece.model';

/**
 * Kích thước bàn cờ
 */
export const BOARD_COLS = 9;
export const BOARD_ROWS = 10;

/**
 * Vị trí trên bàn cờ
 */
export interface Position {
  row: number;
  col: number;
}

/**
 * Cell trên bàn cờ
 */
export interface Cell {
  position: Position;
  piece: Piece | null;
}

/**
 * Bàn cờ - mảng 2 chiều các Cell
 */
export type Board = Cell[][];

/**
 * Tạo quân cờ
 */
export function createPiece(
  type: PieceType,
  color: PieceColor,
  state: PieceState = PieceState.NORMAL,
  trueType?: PieceType
): Piece {
  return { type, color, state, trueType };
}

/**
 * Tạo bàn cờ trống
 */
export function createEmptyBoard(): Board {
  const board: Board = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    board[row] = [];
    for (let col = 0; col < BOARD_COLS; col++) {
      board[row][col] = {
        position: { row, col },
        piece: null
      };
    }
  }
  return board;
}

/**
 * Tạo bàn cờ với thế khai cuộc chuẩn
 */
export function createStandardBoard(): Board {
  const board = createEmptyBoard();
  const R = PieceColor.RED;
  const B = PieceColor.BLACK;

  // Hàng đầu Đen (row 0)
  board[0][0].piece = createPiece(PieceType.ROOK, B);
  board[0][1].piece = createPiece(PieceType.HORSE, B);
  board[0][2].piece = createPiece(PieceType.ELEPHANT, B);
  board[0][3].piece = createPiece(PieceType.ADVISOR, B);
  board[0][4].piece = createPiece(PieceType.KING, B);
  board[0][5].piece = createPiece(PieceType.ADVISOR, B);
  board[0][6].piece = createPiece(PieceType.ELEPHANT, B);
  board[0][7].piece = createPiece(PieceType.HORSE, B);
  board[0][8].piece = createPiece(PieceType.ROOK, B);

  // Pháo Đen
  board[2][1].piece = createPiece(PieceType.CANNON, B);
  board[2][7].piece = createPiece(PieceType.CANNON, B);

  // Tốt Đen
  board[3][0].piece = createPiece(PieceType.PAWN, B);
  board[3][2].piece = createPiece(PieceType.PAWN, B);
  board[3][4].piece = createPiece(PieceType.PAWN, B);
  board[3][6].piece = createPiece(PieceType.PAWN, B);
  board[3][8].piece = createPiece(PieceType.PAWN, B);

  // Hàng đầu Đỏ (row 9)
  board[9][0].piece = createPiece(PieceType.ROOK, R);
  board[9][1].piece = createPiece(PieceType.HORSE, R);
  board[9][2].piece = createPiece(PieceType.ELEPHANT, R);
  board[9][3].piece = createPiece(PieceType.ADVISOR, R);
  board[9][4].piece = createPiece(PieceType.KING, R);
  board[9][5].piece = createPiece(PieceType.ADVISOR, R);
  board[9][6].piece = createPiece(PieceType.ELEPHANT, R);
  board[9][7].piece = createPiece(PieceType.HORSE, R);
  board[9][8].piece = createPiece(PieceType.ROOK, R);

  // Pháo Đỏ
  board[7][1].piece = createPiece(PieceType.CANNON, R);
  board[7][7].piece = createPiece(PieceType.CANNON, R);

  // Binh Đỏ
  board[6][0].piece = createPiece(PieceType.PAWN, R);
  board[6][2].piece = createPiece(PieceType.PAWN, R);
  board[6][4].piece = createPiece(PieceType.PAWN, R);
  board[6][6].piece = createPiece(PieceType.PAWN, R);
  board[6][8].piece = createPiece(PieceType.PAWN, R);

  return board;
}

/**
 * Clone bàn cờ (deep copy)
 */
export function cloneBoard(board: Board): Board {
  return board.map(row =>
    row.map(cell => ({
      position: { ...cell.position },
      piece: cell.piece ? { ...cell.piece } : null
    }))
  );
}

/**
 * Lấy quân cờ tại vị trí
 */
export function getPieceAt(board: Board, pos: Position): Piece | null {
  if (!isValidPosition(pos)) return null;
  return board[pos.row][pos.col].piece;
}

/**
 * Đặt quân cờ tại vị trí
 */
export function setPieceAt(board: Board, pos: Position, piece: Piece | null): void {
  if (isValidPosition(pos)) {
    board[pos.row][pos.col].piece = piece;
  }
}

/**
 * Kiểm tra vị trí hợp lệ
 */
export function isValidPosition(pos: Position): boolean {
  return pos.row >= 0 && pos.row < BOARD_ROWS && pos.col >= 0 && pos.col < BOARD_COLS;
}

/**
 * Kiểm tra vị trí trong cung (palace)
 */
export function isInPalace(pos: Position, color: PieceColor): boolean {
  const validCols = pos.col >= 3 && pos.col <= 5;
  if (color === PieceColor.RED) {
    return validCols && pos.row >= 7 && pos.row <= 9;
  } else {
    return validCols && pos.row >= 0 && pos.row <= 2;
  }
}

/**
 * Kiểm tra vị trí bên phía quân
 */
export function isOnOwnSide(pos: Position, color: PieceColor): boolean {
  if (color === PieceColor.RED) {
    return pos.row >= 5;
  } else {
    return pos.row <= 4;
  }
}

/**
 * Tìm vị trí của Tướng
 */
export function findKing(board: Board, color: PieceColor): Position | null {
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = board[row][col].piece;
      if (piece && piece.type === PieceType.KING && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

/**
 * Tạo FEN string từ bàn cờ
 */
export function boardToFEN(board: Board): string {
  let fen = '';
  for (let row = 0; row < BOARD_ROWS; row++) {
    let empty = 0;
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = board[row][col].piece;
      if (!piece) {
        empty++;
      } else {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        const chars = 'KAEHRCP';
        const char = chars[piece.type - 1];
        fen += piece.color === PieceColor.RED ? char.toUpperCase() : char.toLowerCase();
      }
    }
    if (empty > 0) fen += empty;
    if (row < BOARD_ROWS - 1) fen += '/';
  }
  return fen;
}
