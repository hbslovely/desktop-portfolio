import { Injectable } from '@angular/core';
import { Board, Position, isValidPosition, cloneBoard, isInPalace, isOnOwnSide, hasCrossedRiver } from '../models/board.model';
import { Move, MoveResult, ORTHOGONAL_DIRECTIONS, DIAGONAL_DIRECTIONS, HORSE_MOVES, ELEPHANT_MOVES } from '../models/move.model';
import { Piece, PieceColor, PieceType } from '../models/piece.model';
import { findKingPosition, getPieceAt } from '../utils/board.utils';

@Injectable({
  providedIn: 'root'
})
export class MoveValidatorService {
  
  /**
   * Validate a move
   */
  validateMove(board: Board, from: Position, to: Position): MoveResult {
    const piece = getPieceAt(board, from);
    
    if (!piece) {
      return { valid: false, reason: 'Không có quân cờ tại vị trí này' };
    }
    
    if (!isValidPosition(to)) {
      return { valid: false, reason: 'Vị trí đích không hợp lệ' };
    }
    
    const target = getPieceAt(board, to);
    if (target && target.color === piece.color) {
      return { valid: false, reason: 'Không thể ăn quân cùng màu' };
    }
    
    // Check piece-specific movement
    if (!this.isValidPieceMove(board, from, to, piece)) {
      return { valid: false, reason: 'Nước đi không hợp lệ cho quân này' };
    }
    
    // Check if move leaves king in check
    const testBoard = cloneBoard(board);
    testBoard[to.row][to.col] = testBoard[from.row][from.col];
    testBoard[from.row][from.col] = null;
    
    if (this.isInCheck(testBoard, piece.color)) {
      return { valid: false, reason: 'Nước đi này để Tướng bị chiếu' };
    }
    
    return {
      valid: true,
      move: {
        from,
        to,
        piece,
        captured: target || undefined,
        isCheck: this.isInCheck(testBoard, piece.color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED)
      }
    };
  }
  
  /**
   * Check if piece-specific move is valid
   */
  isValidPieceMove(board: Board, from: Position, to: Position, piece: Piece): boolean {
    const isRed = piece.color === PieceColor.RED;
    
    switch (piece.type) {
      case PieceType.KING:
        return this.isValidKingMove(board, from, to, isRed);
      case PieceType.ADVISOR:
        return this.isValidAdvisorMove(from, to, isRed);
      case PieceType.ELEPHANT:
        return this.isValidElephantMove(board, from, to, isRed);
      case PieceType.HORSE:
        return this.isValidHorseMove(board, from, to);
      case PieceType.ROOK:
        return this.isValidRookMove(board, from, to);
      case PieceType.CANNON:
        return this.isValidCannonMove(board, from, to);
      case PieceType.PAWN:
        return this.isValidPawnMove(from, to, isRed);
      default:
        return false;
    }
  }
  
  /**
   * King movement validation
   */
  private isValidKingMove(board: Board, from: Position, to: Position, isRed: boolean): boolean {
    // Must stay in palace
    if (!isInPalace(to, isRed)) return false;
    
    // Can only move one step orthogonally
    const dRow = Math.abs(to.row - from.row);
    const dCol = Math.abs(to.col - from.col);
    
    if ((dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1)) {
      return true;
    }
    
    // Flying general - can capture opposing king if in same column with no pieces between
    const target = getPieceAt(board, to);
    if (target && target.type === PieceType.KING) {
      if (from.col !== to.col) return false;
      
      const minRow = Math.min(from.row, to.row);
      const maxRow = Math.max(from.row, to.row);
      
      for (let r = minRow + 1; r < maxRow; r++) {
        if (board[r][from.col]) return false;
      }
      return true;
    }
    
    return false;
  }
  
  /**
   * Advisor movement validation
   */
  private isValidAdvisorMove(from: Position, to: Position, isRed: boolean): boolean {
    // Must stay in palace
    if (!isInPalace(to, isRed)) return false;
    
    // Can only move one step diagonally
    const dRow = Math.abs(to.row - from.row);
    const dCol = Math.abs(to.col - from.col);
    
    return dRow === 1 && dCol === 1;
  }
  
  /**
   * Elephant movement validation
   */
  private isValidElephantMove(board: Board, from: Position, to: Position, isRed: boolean): boolean {
    // Must stay on own side
    if (!isOnOwnSide(to, isRed)) return false;
    
    // Must move exactly 2 steps diagonally
    const dRow = to.row - from.row;
    const dCol = to.col - from.col;
    
    if (Math.abs(dRow) !== 2 || Math.abs(dCol) !== 2) return false;
    
    // Check elephant's eye is not blocked
    const eyeRow = from.row + dRow / 2;
    const eyeCol = from.col + dCol / 2;
    
    return !board[eyeRow][eyeCol];
  }
  
  /**
   * Horse movement validation
   */
  private isValidHorseMove(board: Board, from: Position, to: Position): boolean {
    const dRow = to.row - from.row;
    const dCol = to.col - from.col;
    
    // Check valid horse move pattern and leg is not blocked
    for (const move of HORSE_MOVES) {
      if (dRow === move.dest.dRow && dCol === move.dest.dCol) {
        const legPos = { row: from.row + move.leg.dRow, col: from.col + move.leg.dCol };
        return !board[legPos.row][legPos.col];
      }
    }
    
    return false;
  }
  
  /**
   * Rook movement validation
   */
  private isValidRookMove(board: Board, from: Position, to: Position): boolean {
    // Must move in straight line
    if (from.row !== to.row && from.col !== to.col) return false;
    
    // Check path is clear
    const dRow = Math.sign(to.row - from.row);
    const dCol = Math.sign(to.col - from.col);
    
    let r = from.row + dRow;
    let c = from.col + dCol;
    
    while (r !== to.row || c !== to.col) {
      if (board[r][c]) return false;
      r += dRow;
      c += dCol;
    }
    
    return true;
  }
  
  /**
   * Cannon movement validation
   */
  private isValidCannonMove(board: Board, from: Position, to: Position): boolean {
    // Must move in straight line
    if (from.row !== to.row && from.col !== to.col) return false;
    
    const target = board[to.row][to.col];
    const dRow = Math.sign(to.row - from.row);
    const dCol = Math.sign(to.col - from.col);
    
    let pieces = 0;
    let r = from.row + dRow;
    let c = from.col + dCol;
    
    while (r !== to.row || c !== to.col) {
      if (board[r][c]) pieces++;
      r += dRow;
      c += dCol;
    }
    
    // Move without capture: path must be clear
    if (!target) return pieces === 0;
    
    // Capture: exactly one piece in between (cannon mount)
    return pieces === 1;
  }
  
  /**
   * Pawn movement validation
   */
  private isValidPawnMove(from: Position, to: Position, isRed: boolean): boolean {
    const forward = isRed ? -1 : 1;
    const crossed = hasCrossedRiver(from, isRed);
    
    // Forward move
    if (to.row === from.row + forward && to.col === from.col) {
      return true;
    }
    
    // Sideways move (after crossing river)
    if (crossed && to.row === from.row && Math.abs(to.col - from.col) === 1) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if a color is in check
   */
  isInCheck(board: Board, color: PieceColor): boolean {
    const kingPos = findKingPosition(board, color);
    if (!kingPos) return true;
    
    const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;
    
    // Check flying general
    const enemyKing = findKingPosition(board, enemyColor);
    if (enemyKing && enemyKing.col === kingPos.col) {
      let blocked = false;
      const minRow = Math.min(kingPos.row, enemyKing.row);
      const maxRow = Math.max(kingPos.row, enemyKing.row);
      for (let r = minRow + 1; r < maxRow; r++) {
        if (board[r][kingPos.col]) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return true;
    }
    
    // Check all enemy pieces
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = board[row][col];
        if (piece && piece.color === enemyColor) {
          if (this.canAttackPosition(board, { row, col }, kingPos, piece)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if piece can attack a position
   */
  private canAttackPosition(board: Board, from: Position, to: Position, piece: Piece): boolean {
    // Create a temporary board without the target for cannon check
    const tempBoard = cloneBoard(board);
    const isRed = piece.color === PieceColor.RED;
    
    switch (piece.type) {
      case PieceType.ROOK:
        return this.isValidRookMove(board, from, to);
      case PieceType.CANNON:
        // For check, cannon needs to have target there
        return this.isValidCannonMove(board, from, to);
      case PieceType.HORSE:
        return this.isValidHorseMove(board, from, to);
      case PieceType.PAWN:
        return this.isValidPawnMove(from, to, isRed);
      case PieceType.KING:
        // Flying general
        if (from.col === to.col) {
          const minRow = Math.min(from.row, to.row);
          const maxRow = Math.max(from.row, to.row);
          for (let r = minRow + 1; r < maxRow; r++) {
            if (board[r][from.col]) return false;
          }
          return true;
        }
        return false;
      default:
        return false;
    }
  }
  
  /**
   * Generate all legal moves for a color
   */
  generateLegalMoves(board: Board, color: PieceColor): Move[] {
    const moves: Move[] = [];
    
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = board[row][col];
        if (piece && piece.color === color) {
          const pieceMoves = this.generatePieceMoves(board, { row, col }, piece);
          for (const move of pieceMoves) {
            const result = this.validateMove(board, move.from, move.to);
            if (result.valid && result.move) {
              moves.push(result.move);
            }
          }
        }
      }
    }
    
    return moves;
  }
  
  /**
   * Generate all pseudo-legal moves for a piece
   */
  private generatePieceMoves(board: Board, from: Position, piece: Piece): Move[] {
    const moves: Move[] = [];
    const isRed = piece.color === PieceColor.RED;
    
    const addMove = (to: Position) => {
      if (!isValidPosition(to)) return;
      const target = board[to.row][to.col];
      if (target && target.color === piece.color) return;
      
      moves.push({
        from,
        to,
        piece,
        captured: target || undefined
      });
    };
    
    switch (piece.type) {
      case PieceType.KING:
        for (const dir of ORTHOGONAL_DIRECTIONS) {
          addMove({ row: from.row + dir.dRow, col: from.col + dir.dCol });
        }
        break;
        
      case PieceType.ADVISOR:
        for (const dir of DIAGONAL_DIRECTIONS) {
          addMove({ row: from.row + dir.dRow, col: from.col + dir.dCol });
        }
        break;
        
      case PieceType.ELEPHANT:
        for (const move of ELEPHANT_MOVES) {
          addMove({ row: from.row + move.dest.dRow, col: from.col + move.dest.dCol });
        }
        break;
        
      case PieceType.HORSE:
        for (const move of HORSE_MOVES) {
          addMove({ row: from.row + move.dest.dRow, col: from.col + move.dest.dCol });
        }
        break;
        
      case PieceType.ROOK:
      case PieceType.CANNON:
        for (const dir of ORTHOGONAL_DIRECTIONS) {
          for (let i = 1; i < 10; i++) {
            addMove({ row: from.row + dir.dRow * i, col: from.col + dir.dCol * i });
          }
        }
        break;
        
      case PieceType.PAWN:
        const forward = isRed ? -1 : 1;
        addMove({ row: from.row + forward, col: from.col });
        if (hasCrossedRiver(from, isRed)) {
          addMove({ row: from.row, col: from.col - 1 });
          addMove({ row: from.row, col: from.col + 1 });
        }
        break;
    }
    
    return moves;
  }
  
  /**
   * Check for checkmate
   */
  isCheckmate(board: Board, color: PieceColor): boolean {
    if (!this.isInCheck(board, color)) return false;
    return this.generateLegalMoves(board, color).length === 0;
  }
  
  /**
   * Check for stalemate
   */
  isStalemate(board: Board, color: PieceColor): boolean {
    if (this.isInCheck(board, color)) return false;
    return this.generateLegalMoves(board, color).length === 0;
  }
}
