import {
  Board,
  Position,
  BOARD_ROWS,
  BOARD_COLS,
  getPieceAt,
  isValidPosition,
  isInPalace,
  isOnOwnSide,
  findKing,
  cloneBoard,
  setPieceAt
} from '../models/board.model';
import { PieceType, PieceColor, Piece } from '../models/piece.model';
import { Move, createMove } from '../models/move.model';

/**
 * Tạo tất cả nước đi hợp lệ cho một quân cờ
 */
export function generatePieceMoves(
  board: Board,
  pos: Position,
  checkSafety: boolean = true
): Move[] {
  const piece = getPieceAt(board, pos);
  if (!piece || piece.color === PieceColor.NONE) return [];

  let moves: Move[] = [];

  switch (piece.type) {
    case PieceType.KING:
      moves = generateKingMoves(board, pos, piece);
      break;
    case PieceType.ADVISOR:
      moves = generateAdvisorMoves(board, pos, piece);
      break;
    case PieceType.ELEPHANT:
      moves = generateElephantMoves(board, pos, piece);
      break;
    case PieceType.HORSE:
      moves = generateHorseMoves(board, pos, piece);
      break;
    case PieceType.ROOK:
      moves = generateRookMoves(board, pos, piece);
      break;
    case PieceType.CANNON:
      moves = generateCannonMoves(board, pos, piece);
      break;
    case PieceType.PAWN:
      moves = generatePawnMoves(board, pos, piece);
      break;
  }

  if (checkSafety) {
    // Lọc các nước đi không an toàn (để Tướng bị chiếu)
    moves = moves.filter(move => !wouldBeInCheck(board, move, piece.color));
  }

  return moves;
}

/**
 * Nước đi của Tướng
 */
function generateKingMoves(board: Board, pos: Position, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of directions) {
    const newPos = { row: pos.row + dr, col: pos.col + dc };
    if (isInPalace(newPos, piece.color) && canMoveTo(board, newPos, piece.color)) {
      moves.push(createMove(pos, newPos, piece, getPieceAt(board, newPos)));
    }
  }

  return moves;
}

/**
 * Nước đi của Sĩ
 */
function generateAdvisorMoves(board: Board, pos: Position, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  for (const [dr, dc] of directions) {
    const newPos = { row: pos.row + dr, col: pos.col + dc };
    if (isInPalace(newPos, piece.color) && canMoveTo(board, newPos, piece.color)) {
      moves.push(createMove(pos, newPos, piece, getPieceAt(board, newPos)));
    }
  }

  return moves;
}

/**
 * Nước đi của Tượng
 */
function generateElephantMoves(board: Board, pos: Position, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
  const blocking = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  for (let i = 0; i < 4; i++) {
    const blockPos = { row: pos.row + blocking[i][0], col: pos.col + blocking[i][1] };
    const newPos = { row: pos.row + directions[i][0], col: pos.col + directions[i][1] };

    // Kiểm tra chặn mắt tượng
    if (!getPieceAt(board, blockPos)) {
      // Tượng không qua sông
      if (isOnOwnSide(newPos, piece.color) && canMoveTo(board, newPos, piece.color)) {
        moves.push(createMove(pos, newPos, piece, getPieceAt(board, newPos)));
      }
    }
  }

  return moves;
}

/**
 * Nước đi của Mã
 */
function generateHorseMoves(board: Board, pos: Position, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  const blocking = [
    [-1, 0], [-1, 0], [0, -1], [0, 1],
    [0, -1], [0, 1], [1, 0], [1, 0]
  ];

  for (let i = 0; i < 8; i++) {
    const blockPos = { row: pos.row + blocking[i][0], col: pos.col + blocking[i][1] };
    const newPos = { row: pos.row + directions[i][0], col: pos.col + directions[i][1] };

    // Kiểm tra cản mã
    if (!getPieceAt(board, blockPos) && canMoveTo(board, newPos, piece.color)) {
      moves.push(createMove(pos, newPos, piece, getPieceAt(board, newPos)));
    }
  }

  return moves;
}

/**
 * Nước đi của Xe
 */
function generateRookMoves(board: Board, pos: Position, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of directions) {
    let newRow = pos.row + dr;
    let newCol = pos.col + dc;

    while (isValidPosition({ row: newRow, col: newCol })) {
      const targetPiece = getPieceAt(board, { row: newRow, col: newCol });

      if (!targetPiece) {
        moves.push(createMove(pos, { row: newRow, col: newCol }, piece, null));
      } else {
        if (targetPiece.color !== piece.color) {
          moves.push(createMove(pos, { row: newRow, col: newCol }, piece, targetPiece));
        }
        break;
      }

      newRow += dr;
      newCol += dc;
    }
  }

  return moves;
}

/**
 * Nước đi của Pháo
 */
function generateCannonMoves(board: Board, pos: Position, piece: Piece): Move[] {
  const moves: Move[] = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of directions) {
    let newRow = pos.row + dr;
    let newCol = pos.col + dc;
    let jumped = false;

    while (isValidPosition({ row: newRow, col: newCol })) {
      const targetPiece = getPieceAt(board, { row: newRow, col: newCol });

      if (!jumped) {
        if (!targetPiece) {
          // Di chuyển bình thường
          moves.push(createMove(pos, { row: newRow, col: newCol }, piece, null));
        } else {
          // Gặp quân đầu tiên - đánh dấu đã nhảy
          jumped = true;
        }
      } else {
        // Sau khi nhảy
        if (targetPiece) {
          if (targetPiece.color !== piece.color) {
            // Ăn quân sau khi nhảy
            moves.push(createMove(pos, { row: newRow, col: newCol }, piece, targetPiece));
          }
          break;
        }
      }

      newRow += dr;
      newCol += dc;
    }
  }

  return moves;
}

/**
 * Nước đi của Tốt/Binh
 */
function generatePawnMoves(board: Board, pos: Position, piece: Piece): Move[] {
  const moves: Move[] = [];
  const forward = piece.color === PieceColor.RED ? -1 : 1;

  // Tiến 1 ô
  const forwardPos = { row: pos.row + forward, col: pos.col };
  if (canMoveTo(board, forwardPos, piece.color)) {
    moves.push(createMove(pos, forwardPos, piece, getPieceAt(board, forwardPos)));
  }

  // Đã qua sông - có thể đi ngang
  const hasCrossedRiver = piece.color === PieceColor.RED ? pos.row <= 4 : pos.row >= 5;
  if (hasCrossedRiver) {
    const leftPos = { row: pos.row, col: pos.col - 1 };
    const rightPos = { row: pos.row, col: pos.col + 1 };

    if (canMoveTo(board, leftPos, piece.color)) {
      moves.push(createMove(pos, leftPos, piece, getPieceAt(board, leftPos)));
    }
    if (canMoveTo(board, rightPos, piece.color)) {
      moves.push(createMove(pos, rightPos, piece, getPieceAt(board, rightPos)));
    }
  }

  return moves;
}

/**
 * Kiểm tra có thể di chuyển đến vị trí
 */
function canMoveTo(board: Board, pos: Position, color: PieceColor): boolean {
  if (!isValidPosition(pos)) return false;
  const piece = getPieceAt(board, pos);
  return !piece || piece.color !== color;
}

/**
 * Kiểm tra nước đi có làm Tướng bị chiếu không
 */
function wouldBeInCheck(board: Board, move: Move, color: PieceColor): boolean {
  const testBoard = cloneBoard(board);

  // Thực hiện nước đi
  setPieceAt(testBoard, move.to, move.piece);
  setPieceAt(testBoard, move.from, null);

  // Kiểm tra đối mặt Tướng
  if (areKingsFacing(testBoard)) return true;

  // Kiểm tra có bị chiếu không
  return isInCheck(testBoard, color);
}

/**
 * Kiểm tra hai Tướng đối mặt
 */
export function areKingsFacing(board: Board): boolean {
  const redKing = findKing(board, PieceColor.RED);
  const blackKing = findKing(board, PieceColor.BLACK);

  if (!redKing || !blackKing) return false;
  if (redKing.col !== blackKing.col) return false;

  // Kiểm tra có quân nào ở giữa
  const minRow = Math.min(redKing.row, blackKing.row);
  const maxRow = Math.max(redKing.row, blackKing.row);

  for (let row = minRow + 1; row < maxRow; row++) {
    if (getPieceAt(board, { row, col: redKing.col })) {
      return false;
    }
  }

  return true;
}

/**
 * Kiểm tra màu quân có đang bị chiếu không
 */
export function isInCheck(board: Board, color: PieceColor): boolean {
  const kingPos = findKing(board, color);
  if (!kingPos) return true; // Không có Tướng = thua

  const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;

  // Kiểm tra tất cả quân địch
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = getPieceAt(board, { row, col });
      if (piece && piece.color === enemyColor) {
        const moves = generatePieceMoves(board, { row, col }, false);
        for (const move of moves) {
          if (move.to.row === kingPos.row && move.to.col === kingPos.col) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Tạo tất cả nước đi hợp lệ cho một màu
 */
export function generateAllMoves(board: Board, color: PieceColor): Move[] {
  const moves: Move[] = [];

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const piece = getPieceAt(board, { row, col });
      if (piece && piece.color === color) {
        const pieceMoves = generatePieceMoves(board, { row, col }, true);
        moves.push(...pieceMoves);
      }
    }
  }

  return moves;
}

/**
 * Kiểm tra chiếu bí
 */
export function isCheckmate(board: Board, color: PieceColor): boolean {
  if (!isInCheck(board, color)) return false;
  return generateAllMoves(board, color).length === 0;
}

/**
 * Kiểm tra hòa (không có nước đi hợp lệ nhưng không bị chiếu)
 */
export function isStalemate(board: Board, color: PieceColor): boolean {
  if (isInCheck(board, color)) return false;
  return generateAllMoves(board, color).length === 0;
}
