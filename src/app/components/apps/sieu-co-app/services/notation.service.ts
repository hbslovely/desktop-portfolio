import { Injectable } from '@angular/core';
import { Board, Position, BOARD_COLS } from '../models/board.model';
import { Move } from '../models/move.model';
import { Piece, PieceColor, PieceType, PIECE_NOTATION, PIECE_NAMES } from '../models/piece.model';

/**
 * Notation types
 */
export enum NotationType {
  VIETNAMESE = 'vietnamese',
  CHINESE = 'chinese',
  ALGEBRAIC = 'algebraic'
}

@Injectable({
  providedIn: 'root'
})
export class NotationService {
  private notationType: NotationType = NotationType.VIETNAMESE;
  
  setNotationType(type: NotationType): void {
    this.notationType = type;
  }
  
  /**
   * Convert move to notation string
   */
  moveToNotation(move: Move, board: Board): string {
    switch (this.notationType) {
      case NotationType.VIETNAMESE:
        return this.toVietnameseNotation(move, board);
      case NotationType.CHINESE:
        return this.toChineseNotation(move, board);
      case NotationType.ALGEBRAIC:
        return this.toAlgebraicNotation(move);
      default:
        return this.toVietnameseNotation(move, board);
    }
  }
  
  /**
   * Vietnamese notation (e.g., "X2-7" - Xe hàng 2 đi ngang 7)
   * Format: [Piece][Column][Direction][Destination]
   */
  private toVietnameseNotation(move: Move, board: Board): string {
    const piece = move.piece;
    const pieceName = PIECE_NOTATION[piece.type];
    const isRed = piece.color === PieceColor.RED;
    
    // Column numbers: 1-9 from right for Red, 1-9 from left for Black
    const fromCol = isRed ? (BOARD_COLS - move.from.col) : (move.from.col + 1);
    const toCol = isRed ? (BOARD_COLS - move.to.col) : (move.to.col + 1);
    
    // Check for duplicate pieces in same column
    const duplicateSuffix = this.getDuplicateSuffix(board, move.from, piece);
    
    // Direction
    let direction: string;
    let destination: string | number;
    
    if (move.from.col === move.to.col) {
      // Vertical move
      const distance = Math.abs(move.to.row - move.from.row);
      if ((isRed && move.to.row < move.from.row) || (!isRed && move.to.row > move.from.row)) {
        direction = '.'; // Tiến
      } else {
        direction = '/'; // Lui
      }
      destination = distance;
    } else if (move.from.row === move.to.row) {
      // Horizontal move
      direction = '-'; // Bình
      destination = toCol;
    } else {
      // Diagonal move (Horse, Elephant, Advisor)
      if ((isRed && move.to.row < move.from.row) || (!isRed && move.to.row > move.from.row)) {
        direction = '.'; // Tiến
      } else {
        direction = '/'; // Lui
      }
      destination = toCol;
    }
    
    return `${pieceName}${duplicateSuffix}${fromCol}${direction}${destination}`;
  }
  
  /**
   * Get suffix for duplicate pieces in same column
   */
  private getDuplicateSuffix(board: Board, from: Position, piece: Piece): string {
    let sameTypePieces: Position[] = [];
    
    // Find all pieces of same type and color in same column
    for (let row = 0; row < 10; row++) {
      const p = board[row][from.col];
      if (p && p.type === piece.type && p.color === piece.color) {
        sameTypePieces.push({ row, col: from.col });
      }
    }
    
    if (sameTypePieces.length <= 1) return '';
    
    // Sort by row (front to back for the color)
    const isRed = piece.color === PieceColor.RED;
    sameTypePieces.sort((a, b) => isRed ? a.row - b.row : b.row - a.row);
    
    const index = sameTypePieces.findIndex(p => p.row === from.row && p.col === from.col);
    
    if (sameTypePieces.length === 2) {
      return index === 0 ? 't' : 's'; // Trước/Sau
    }
    
    // For 3+ pieces (rare, mainly pawns)
    return `${index + 1}`;
  }
  
  /**
   * Chinese notation
   */
  private toChineseNotation(move: Move, board: Board): string {
    const piece = move.piece;
    const pieceName = PIECE_NAMES[piece.color][piece.type];
    const isRed = piece.color === PieceColor.RED;
    
    // Column numbers (1-9)
    const fromCol = isRed ? (BOARD_COLS - move.from.col) : (move.from.col + 1);
    const toCol = isRed ? (BOARD_COLS - move.to.col) : (move.to.col + 1);
    
    // Chinese numbers
    const chineseNums = isRed 
      ? ['一', '二', '三', '四', '五', '六', '七', '八', '九']
      : ['１', '２', '３', '４', '５', '６', '７', '８', '９'];
    
    const fromColCn = chineseNums[fromCol - 1];
    const toColCn = chineseNums[toCol - 1];
    
    // Direction
    let direction: string;
    let destination: string;
    
    if (move.from.col === move.to.col) {
      const distance = Math.abs(move.to.row - move.from.row);
      if ((isRed && move.to.row < move.from.row) || (!isRed && move.to.row > move.from.row)) {
        direction = '進';
      } else {
        direction = '退';
      }
      destination = chineseNums[distance - 1];
    } else if (move.from.row === move.to.row) {
      direction = '平';
      destination = toColCn;
    } else {
      if ((isRed && move.to.row < move.from.row) || (!isRed && move.to.row > move.from.row)) {
        direction = '進';
      } else {
        direction = '退';
      }
      destination = toColCn;
    }
    
    return `${pieceName}${fromColCn}${direction}${destination}`;
  }
  
  /**
   * Algebraic notation (e.g., "Ra1-a5")
   */
  private toAlgebraicNotation(move: Move): string {
    const pieceChar = this.getPieceChar(move.piece.type);
    const fromSquare = this.posToAlgebraic(move.from);
    const toSquare = this.posToAlgebraic(move.to);
    const capture = move.captured ? 'x' : '-';
    const check = move.isCheck ? '+' : '';
    
    return `${pieceChar}${fromSquare}${capture}${toSquare}${check}`;
  }
  
  private getPieceChar(type: PieceType): string {
    const chars: Record<PieceType, string> = {
      [PieceType.KING]: 'K',
      [PieceType.ADVISOR]: 'A',
      [PieceType.ELEPHANT]: 'E',
      [PieceType.HORSE]: 'H',
      [PieceType.ROOK]: 'R',
      [PieceType.CANNON]: 'C',
      [PieceType.PAWN]: 'P'
    };
    return chars[type];
  }
  
  private posToAlgebraic(pos: Position): string {
    const col = String.fromCharCode(97 + pos.col); // a-i
    const row = 10 - pos.row; // 1-10
    return `${col}${row}`;
  }
  
  /**
   * Format move history for display
   */
  formatMoveHistory(moves: Move[], board: Board): string[] {
    const notations: string[] = [];
    let currentBoard = board;
    
    // This would need to track board state, simplified version
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const moveNum = Math.floor(i / 2) + 1;
      const isRed = i % 2 === 0;
      
      const notation = this.moveToNotation(move, currentBoard);
      
      if (isRed) {
        notations.push(`${moveNum}. ${notation}`);
      } else {
        notations[notations.length - 1] += ` ${notation}`;
      }
    }
    
    return notations;
  }
  
  /**
   * Parse notation to move (for puzzle input)
   */
  parseNotation(notation: string, board: Board, color: PieceColor): Move | null {
    // TODO: Implement notation parsing for puzzle editing
    return null;
  }
}
