import { Move, MoveDirection } from '../models/move.model';
import { PieceColor, PieceType, PIECE_NOTATION } from '../models/piece.model';

/**
 * Tạo ký hiệu kỳ phổ Việt Nam cho nước đi
 * Tham khảo: https://zigavn.com/cotuong/doc-hieu-ban-ghi-co-tuong
 *
 * Format: [Quân][Cột xuất phát][Hướng][Đích]
 * Ví dụ: P2.5 = Pháo cột 2 tấn đến cột 5
 *        X8-3 = Xe cột 8 bình 3 bước
 *        M3/1 = Mã cột 3 thoái đến cột 1
 */
export function createMoveNotation(move: Move): string {
  const piece = move.piece;
  const color = piece.color;

  // Ký hiệu quân
  const pieceChar = PIECE_NOTATION[piece.type];

  // Cột xuất phát (Đỏ đếm phải-trái 9-1, Đen đếm trái-phải 1-9)
  const fromCol = color === PieceColor.RED ? (9 - move.from.col) : (move.from.col + 1);

  // Xác định hướng di chuyển
  let direction: MoveDirection;
  const isVertical = move.from.col === move.to.col;
  const isHorizontal = move.from.row === move.to.row;

  if (isHorizontal) {
    direction = MoveDirection.HORIZONTAL;
  } else {
    // Đỏ: tiến = row giảm, lùi = row tăng
    // Đen: tiến = row tăng, lùi = row giảm
    if (color === PieceColor.RED) {
      direction = move.to.row < move.from.row ? MoveDirection.ADVANCE : MoveDirection.RETREAT;
    } else {
      direction = move.to.row > move.from.row ? MoveDirection.ADVANCE : MoveDirection.RETREAT;
    }
  }

  // Đích: cột đến (cho ngang/chéo) hoặc số bước (cho thẳng)
  let destination: number;
  const isStraightMover = [PieceType.ROOK, PieceType.CANNON, PieceType.PAWN, PieceType.KING].includes(piece.type);

  if (isVertical && isStraightMover) {
    // Quân đi thẳng dọc: ghi số bước
    destination = Math.abs(move.to.row - move.from.row);
  } else {
    // Quân đi chéo hoặc ngang: ghi cột đích
    destination = color === PieceColor.RED ? (9 - move.to.col) : (move.to.col + 1);
  }

  return `${pieceChar}${fromCol}${direction}${destination}`;
}

/**
 * Tạo kỳ phổ đầy đủ từ lịch sử nước đi
 */
export function createGameRecord(moves: { notation: string; color: PieceColor }[]): string {
  let record = '=== SIÊU CỜ - KỲ PHỔ CỜ TƯỚNG ===\n';
  record += 'Ký hiệu: Tg=Tướng, S=Sĩ, T=Tượng, X=Xe, P=Pháo, M=Mã, B=Binh\n';
  record += 'Hướng: .=Tấn, /=Thoái, -=Bình\n\n';

  for (let i = 0; i < moves.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const redMove = moves[i];
    const blackMove = moves[i + 1];

    record += `${moveNum}. Đỏ: ${redMove.notation}`;
    if (blackMove) {
      record += `  |  Đen: ${blackMove.notation}`;
    }
    record += '\n';
  }

  return record;
}

/**
 * Format kết quả ván đấu
 */
export function formatGameResult(
  result: 'red_win' | 'black_win' | 'draw',
  reason?: string
): string {
  const resultText = {
    'red_win': 'Đỏ Thắng',
    'black_win': 'Đen Thắng',
    'draw': 'Hòa'
  };

  let text = `\n=== KẾT QUẢ: ${resultText[result]} ===`;
  if (reason) {
    text += `\nLý do: ${reason}`;
  }

  return text;
}
