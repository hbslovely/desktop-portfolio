import { Board } from '../models/board.model';
import { PieceColor } from '../models/piece.model';
import { Move } from '../models/move.model';
import { AlgorithmConfig, AlgorithmMetadata } from '../interfaces/ai-algorithm.interface';
import { BaseAlgorithm } from './base.algorithm';
import { generateAllMoves, isCheckmate } from '../utils/move-validator.utils';

/**
 * Thuật toán Minimax với Alpha-Beta Pruning
 *
 * Đây là thuật toán tìm kiếm cây quyết định cổ điển cho game đối kháng.
 * Alpha-Beta pruning giúp cắt bỏ các nhánh không cần thiết, tăng hiệu suất.
 *
 * Độ phức tạp: O(b^(d/2)) với alpha-beta tối ưu, O(b^d) worst case
 * Trong đó: b = số nhánh trung bình (~30), d = độ sâu
 */
export class MinimaxAlgorithm extends BaseAlgorithm {
  readonly name = 'Minimax + Alpha-Beta';
  readonly description = 'Thuật toán tìm kiếm cây với cắt tỉa alpha-beta. Cân bằng giữa độ sâu và tốc độ.';
  readonly defaultDepth = 4;

  private transpositionTable: Map<string, { depth: number; score: number }> = new Map();

  constructor(config?: AlgorithmConfig) {
    super(config);
  }

  findBestMove(board: Board, color: PieceColor, depth: number): Move | null {
    this.nodesSearched = 0;
    this.startTime = Date.now();
    this.transpositionTable.clear();

    const moves = generateAllMoves(board, color);
    if (moves.length === 0) return null;

    const isMaximizing = color === PieceColor.BLACK;
    let bestMove: Move | null = null;
    let bestScore = isMaximizing ? -Infinity : Infinity;

    // Sắp xếp nước đi
    this.sortMoves(moves, isMaximizing);

    const alpha = -Infinity;
    const beta = Infinity;

    for (const move of moves) {
      const newBoard = this.makeMove(board, move);
      const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;

      const score = this.minimax(
        newBoard,
        depth - 1,
        alpha,
        beta,
        !isMaximizing,
        enemyColor
      );

      move.score = score;

      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
    }

    console.log(`[Minimax] Nodes: ${this.nodesSearched}, Time: ${Date.now() - this.startTime}ms`);
    return bestMove;
  }

  private minimax(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    color: PieceColor
  ): number {
    this.nodesSearched++;

    // Kiểm tra thời gian
    if (this.isTimeUp()) {
      return this.evaluate(board);
    }

    // Kiểm tra chiếu bí
    if (isCheckmate(board, color)) {
      return isMaximizing ? -10000 + (this.config.maxDepth - depth) : 10000 - (this.config.maxDepth - depth);
    }

    // Đạt độ sâu tối đa
    if (depth <= 0) {
      if (this.config.useQuiescence) {
        return this.quiescenceSearch(board, alpha, beta, color);
      }
      return this.evaluate(board);
    }

    const moves = generateAllMoves(board, color);
    if (moves.length === 0) {
      return this.evaluate(board);
    }

    this.sortMoves(moves, isMaximizing);
    const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;

    if (isMaximizing) {
      let maxScore = -Infinity;

      for (const move of moves) {
        const newBoard = this.makeMove(board, move);
        const score = this.minimax(newBoard, depth - 1, alpha, beta, false, enemyColor);

        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);

        if (beta <= alpha) break; // Alpha-beta cutoff
      }

      return maxScore;
    } else {
      let minScore = Infinity;

      for (const move of moves) {
        const newBoard = this.makeMove(board, move);
        const score = this.minimax(newBoard, depth - 1, alpha, beta, true, enemyColor);

        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);

        if (beta <= alpha) break; // Alpha-beta cutoff
      }

      return minScore;
    }
  }
}

/**
 * Metadata của thuật toán
 */
export const MINIMAX_METADATA: AlgorithmMetadata = {
  id: 'minimax',
  name: 'Minimax + Alpha-Beta',
  description: 'Thuật toán tìm kiếm cây quyết định với cắt tỉa alpha-beta',
  author: 'System',
  version: '1.0.0',
  complexity: 'O(b^d)'
};
