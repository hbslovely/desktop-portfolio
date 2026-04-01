/**
 * Các loại quân cờ trong Cờ Tướng
 */
export enum PieceType {
  NONE = 0,
  KING = 1,      // Tướng/Soái
  ADVISOR = 2,   // Sĩ
  ELEPHANT = 3,  // Tượng/Tịnh
  HORSE = 4,     // Mã
  ROOK = 5,      // Xe
  CANNON = 6,    // Pháo
  PAWN = 7       // Tốt/Binh
}

/**
 * Màu quân cờ
 */
export enum PieceColor {
  NONE = 0,
  RED = 8,       // Đỏ (đi trước)
  BLACK = 16     // Đen
}

/**
 * Trạng thái đặc biệt của quân cờ
 */
export enum PieceState {
  NORMAL = 0,
  HIDDEN = 32    // Quân úp (cho chế độ Cờ Úp)
}

/**
 * Thông tin đầy đủ của một quân cờ
 */
export interface Piece {
  type: PieceType;
  color: PieceColor;
  state: PieceState;
  trueType?: PieceType;  // Loại thật (khi bị úp)
}

/**
 * Tên tiếng Việt của quân cờ
 */
export const PIECE_NAMES_VI: Record<PieceType, { red: string; black: string }> = {
  [PieceType.NONE]: { red: '', black: '' },
  [PieceType.KING]: { red: 'Tướng', black: 'Soái' },
  [PieceType.ADVISOR]: { red: 'Sĩ', black: 'Sĩ' },
  [PieceType.ELEPHANT]: { red: 'Tượng', black: 'Tịnh' },
  [PieceType.HORSE]: { red: 'Mã', black: 'Mã' },
  [PieceType.ROOK]: { red: 'Xe', black: 'Xe' },
  [PieceType.CANNON]: { red: 'Pháo', black: 'Pháo' },
  [PieceType.PAWN]: { red: 'Tốt', black: 'Binh' }
};

/**
 * Ký tự Hán tự của quân cờ
 */
export const PIECE_CHARS: Record<PieceType, { red: string; black: string }> = {
  [PieceType.NONE]: { red: '', black: '' },
  [PieceType.KING]: { red: '帥', black: '將' },
  [PieceType.ADVISOR]: { red: '仕', black: '士' },
  [PieceType.ELEPHANT]: { red: '相', black: '象' },
  [PieceType.HORSE]: { red: '傌', black: '馬' },
  [PieceType.ROOK]: { red: '俥', black: '車' },
  [PieceType.CANNON]: { red: '炮', black: '砲' },
  [PieceType.PAWN]: { red: '兵', black: '卒' }
};

/**
 * Giá trị cơ bản của quân cờ (dùng cho AI đánh giá)
 */
export const PIECE_VALUES: Record<PieceType, number> = {
  [PieceType.NONE]: 0,
  [PieceType.KING]: 10000,
  [PieceType.ADVISOR]: 120,
  [PieceType.ELEPHANT]: 120,
  [PieceType.HORSE]: 400,
  [PieceType.ROOK]: 900,
  [PieceType.CANNON]: 450,
  [PieceType.PAWN]: 100
};

/**
 * Ký hiệu viết tắt cho kỳ phổ
 */
export const PIECE_NOTATION: Record<PieceType, string> = {
  [PieceType.NONE]: '',
  [PieceType.KING]: 'Tg',
  [PieceType.ADVISOR]: 'S',
  [PieceType.ELEPHANT]: 'T',
  [PieceType.HORSE]: 'M',
  [PieceType.ROOK]: 'X',
  [PieceType.CANNON]: 'P',
  [PieceType.PAWN]: 'B'
};
