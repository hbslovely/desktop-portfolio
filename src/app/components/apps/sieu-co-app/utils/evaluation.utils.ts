import { Board, BOARD_ROWS, BOARD_COLS, findKing, getPieceAt } from '../models/board.model';
import { PieceType, PieceColor, PIECE_VALUES, PieceState } from '../models/piece.model';

/**
 * Bảng điểm vị trí cho Mã (Horse)
 * Giá trị cao ở trung tâm và gần cung đối phương
 */
const HORSE_PST: number[][] = [
  [0, -3, 5, 4, 2, 4, 5, -3, 0],
  [-3, 2, 4, 6, 10, 6, 4, 2, -3],
  [4, 6, 12, 14, 14, 14, 12, 6, 4],
  [2, 10, 12, 16, 14, 16, 12, 10, 2],
  [0, 12, 10, 14, 18, 14, 10, 12, 0],
  [0, 12, 10, 14, 18, 14, 10, 12, 0],
  [2, 10, 12, 16, 14, 16, 12, 10, 2],
  [4, 6, 12, 14, 14, 14, 12, 6, 4],
  [-3, 2, 4, 6, 10, 6, 4, 2, -3],
  [0, -3, 5, 4, 2, 4, 5, -3, 0]
];

/**
 * Bảng điểm vị trí cho Pháo (Cannon)
 */
const CANNON_PST: number[][] = [
  [0, 0, 1, 0, -1, 0, 1, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 1, 0],
  [1, 2, 4, 3, 3, 3, 4, 2, 1],
  [2, 4, 6, 5, 4, 5, 6, 4, 2],
  [2, 5, 6, 5, 4, 5, 6, 5, 2],
  [2, 5, 6, 5, 4, 5, 6, 5, 2],
  [2, 4, 6, 5, 4, 5, 6, 4, 2],
  [1, 2, 4, 3, 3, 3, 4, 2, 1],
  [0, 1, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 1, 0, -1, 0, 1, 0, 0]
];

/**
 * Bảng điểm vị trí cho Xe (Rook)
 */
const ROOK_PST: number[][] = [
  [0, 0, 0, 2, 4, 2, 0, 0, 0],
  [0, 0, 0, 1, 2, 1, 0, 0, 0],
  [0, 0, 0, 3, 4, 3, 0, 0, 0],
  [2, 3, 3, 4, 6, 4, 3, 3, 2],
  [4, 6, 5, 6, 8, 6, 5, 6, 4],
  [4, 6, 5, 6, 8, 6, 5, 6, 4],
  [2, 3, 3, 4, 6, 4, 3, 3, 2],
  [0, 0, 0, 3, 4, 3, 0, 0, 0],
  [0, 0, 0, 1, 2, 1, 0, 0, 0],
  [0, 0, 0, 2, 4, 2, 0, 0, 0]
];

/**
 * Bảng điểm vị trí cho Tốt/Binh (Pawn)
 */
const PAWN_PST: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 2, 0, 3, 0, 2, 0, 1],
  [2, 2, 4, 5, 6, 5, 4, 2, 2],
  [3, 6, 9, 10, 12, 10, 9, 6, 3],
  [4, 8, 12, 14, 16, 14, 12, 8, 4],
  [10, 18, 22, 28, 32, 28, 22, 18, 10],
  [15, 25, 30, 40, 50, 40, 30, 25, 15],
  [20, 30, 40, 50, 60, 50, 40, 30, 20]
];

/**
 * Map các bảng điểm vị trí
 */
const PST_MAP: { [key: number]: number[][] } = {
  [PieceType.HORSE]: HORSE_PST,
  [PieceType.CANNON]: CANNON_PST,
  [PieceType.ROOK]: ROOK_PST,
  [PieceType.PAWN]: PAWN_PST
};

/**
 * Lấy điểm vị trí cho quân cờ
 */
export function getPositionalBonus(
  type: PieceType,
  row: number,
  col: number,
  color: PieceColor
): number {
  const pst = PST_MAP[type];
  if (!pst) return 0;

  // Đảo hàng cho quân Đỏ
  const actualRow = color === PieceColor.RED ? (9 - row) : row;
  return pst[actualRow][col] * 3;
}

/**
 * Đánh giá an toàn của Tướng
 */
export function evaluateKingSafety(board: Board, color: PieceColor): number {
  const kingPos = findKing(board, color);
  if (!kingPos) return -10000;

  let safety = 0;
  const advisorPositions = color === PieceColor.RED
    ? [[8, 3], [8, 5], [9, 4]]
    : [[1, 3], [1, 5], [0, 4]];

  // Kiểm tra Sĩ bảo vệ
  for (const [r, c] of advisorPositions) {
    const piece = getPieceAt(board, { row: r, col: c });
    if (piece && piece.type === PieceType.ADVISOR && piece.color === color) {
      safety += 30;
    }
  }

  // Kiểm tra Tượng bảo vệ
  const elephantPositions = color === PieceColor.RED
    ? [[7, 2], [7, 6], [9, 0], [9, 4], [9, 8]]
    : [[2, 2], [2, 6], [0, 0], [0, 4], [0, 8]];

  for (const [r, c] of elephantPositions) {
    const piece = getPieceAt(board, { row: r, col: c });
    if (piece && piece.type === PieceType.ELEPHANT && piece.color === color) {
      safety += 20;
    }
  }

  return safety;
}

/**
 * Đánh giá mobility (khả năng di chuyển)
 */
export function evaluateMobility(moveCount: number): number {
  return moveCount * 2;
}

/**
 * Đánh giá kiểm soát trung tâm
 */
export function evaluateCenterControl(board: Board, color: PieceColor): number {
  let control = 0;
  const centerCols = [3, 4, 5];
  const centerRows = [4, 5];

  for (const row of centerRows) {
    for (const col of centerCols) {
      const piece = getPieceAt(board, { row, col });
      if (piece && piece.color === color) {
        control += 5;
      }
    }
  }

  return control;
}

/**
 * Đánh giá tổng hợp bàn cờ
 * Trả về điểm: dương = lợi thế Đen, âm = lợi thế Đỏ
 */
export function evaluateBoard(board: Board): number {
  let score = 0;

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = getPieceAt(board, { row, col });
      if (!piece) continue;

      // Giá trị cơ bản
      let pieceValue = PIECE_VALUES[piece.type];

      // Quân úp có giá trị không chắc chắn
      if (piece.state === PieceState.HIDDEN) {
        pieceValue = 50;
      } else {
        // Cộng điểm vị trí
        pieceValue += getPositionalBonus(piece.type, row, col, piece.color);
      }

      // Cộng/trừ theo màu
      if (piece.color === PieceColor.BLACK) {
        score += pieceValue;
      } else {
        score -= pieceValue;
      }
    }
  }

  // Đánh giá an toàn Tướng
  score += evaluateKingSafety(board, PieceColor.BLACK);
  score -= evaluateKingSafety(board, PieceColor.RED);

  return score;
}
