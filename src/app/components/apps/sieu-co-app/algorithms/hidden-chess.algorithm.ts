/**
 * Hidden Chess (Cờ Úp) AI Algorithm
 */

import { Board, cloneBoard, setPieceAt, getPieceAt } from '../models/board.model';
import { PieceColor, PieceState } from '../models/piece.model';
import { Move } from '../models/move.model';
import { IAIAlgorithm, AlgorithmMetadata } from '../interfaces/ai-algorithm.interface';
import {
  generateAllHiddenMoves,
  getFlippablePositions,
  evaluateHiddenPosition,
  flipPiece
} from '../utils/hidden-chess.utils';

export interface HiddenMove {
  type: 'flip' | 'move';
  position?: { row: number; col: number };
  move?: Move;
}

export const HIDDEN_CHESS_METADATA: AlgorithmMetadata = {
  id: 'hidden-chess',
  name: 'Hidden Chess AI',
  description: 'AI cho cờ úp sử dụng Minimax với Alpha-Beta',
  version: '1.0.0'
};

export class HiddenChessAlgorithm implements IAIAlgorithm {
  readonly name = 'Hidden Chess AI';
  readonly description = 'AI cho cờ úp sử dụng Minimax với Alpha-Beta';
  readonly defaultDepth = 4;

  private nodesEvaluated = 0;

  findBestMove(board: Board, color: PieceColor, depth: number): Move | null {
    this.nodesEvaluated = 0;
    const result = this.findBestHiddenMove(board, color, depth);
    return result?.move?.move || null;
  }

  private findBestHiddenMove(
    board: Board,
    color: PieceColor,
    maxDepth: number
  ): { move: HiddenMove | null; score: number } {
    const allMoves = this.getAllHiddenMoves(board, color);

    if (allMoves.length === 0) {
      return { move: null, score: -10000 };
    }

    let bestMove: HiddenMove | null = null;
    let bestScore = -Infinity;

    for (const hiddenMove of allMoves) {
      const newBoard = this.applyHiddenMove(board, hiddenMove);
      const score = this.minimax(
        newBoard,
        maxDepth - 1,
        -Infinity,
        Infinity,
        false,
        color
      );

      if (score > bestScore) {
        bestScore = score;
        bestMove = hiddenMove;
      }
    }

    return { move: bestMove, score: bestScore };
  }

  private minimax(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    aiColor: PieceColor
  ): number {
    this.nodesEvaluated++;

    if (depth === 0) {
      return evaluateHiddenPosition(board, aiColor);
    }

    const currentColor = isMaximizing ? aiColor : (aiColor === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED);
    const moves = this.getAllHiddenMoves(board, currentColor);

    if (moves.length === 0) {
      return isMaximizing ? -10000 : 10000;
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const newBoard = this.applyHiddenMove(board, move);
        const evalScore = this.minimax(newBoard, depth - 1, alpha, beta, false, aiColor);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const newBoard = this.applyHiddenMove(board, move);
        const evalScore = this.minimax(newBoard, depth - 1, alpha, beta, true, aiColor);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  private getAllHiddenMoves(board: Board, color: PieceColor): HiddenMove[] {
    const moves: HiddenMove[] = [];

    // Add flip moves
    const flippable = getFlippablePositions(board);
    for (const pos of flippable) {
      moves.push({ type: 'flip', position: pos });
    }

    // Add regular moves
    const regularMoves = generateAllHiddenMoves(board, color);
    for (const move of regularMoves) {
      moves.push({ type: 'move', move });
    }

    return moves;
  }

  private applyHiddenMove(board: Board, hiddenMove: HiddenMove): Board {
    const newBoard = cloneBoard(board);

    if (hiddenMove.type === 'flip' && hiddenMove.position) {
      flipPiece(newBoard, hiddenMove.position);
    } else if (hiddenMove.type === 'move' && hiddenMove.move) {
      const move = hiddenMove.move;
      const piece = getPieceAt(newBoard, move.from);
      if (piece) {
        setPieceAt(newBoard, move.to, piece);
        setPieceAt(newBoard, move.from, null);
      }
    }

    return newBoard;
  }

  evaluate(board: Board): number {
    // Default to evaluating for RED
    return evaluateHiddenPosition(board, PieceColor.RED);
  }

  getHint(board: Board, color: PieceColor): Move | null {
    return this.findBestMove(board, color, 3);
  }
}

// Export singleton instance
export const hiddenChessAlgorithm = new HiddenChessAlgorithm();
