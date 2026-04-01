import { Board } from '../models/board.model';
import { PieceColor, PIECE_VALUES } from '../models/piece.model';
import { Move } from '../models/move.model';
import { AlgorithmConfig, AlgorithmMetadata } from '../interfaces/ai-algorithm.interface';
import { BaseAlgorithm } from './base.algorithm';
import { generateAllMoves } from '../utils/move-validator.utils';
import { evaluateBoard } from '../utils/evaluation.utils';

/**
 * Thuật toán Greedy
 *
 * Đánh giá tất cả nước đi có thể và chọn nước có lợi nhất ngay lập tức.
 * Không nhìn xa (depth = 1), nhưng nhanh.
 */
export class GreedyAlgorithm extends BaseAlgorithm {
  readonly name = 'Tham lam (Greedy)';
  readonly description = 'Chọn nước đi tốt nhất ngay lập tức. Nhanh nhưng không nhìn xa.';
  readonly defaultDepth = 1;

  constructor(config?: AlgorithmConfig) {
    super(config);
  }

  findBestMove(board: Board, color: PieceColor, _depth: number): Move | null {
    const moves = generateAllMoves(board, color);
    if (moves.length === 0) return null;

    const isMaximizing = color === PieceColor.BLACK;
    let bestMove: Move | null = null;
    let bestScore = isMaximizing ? -Infinity : Infinity;

    for (const move of moves) {
      const newBoard = this.makeMove(board, move);

      // Đánh giá ngay lập tức
      let score = evaluateBoard(newBoard);

      // Thưởng thêm cho việc ăn quân
      if (move.capturedPiece) {
        score += (isMaximizing ? 1 : -1) * PIECE_VALUES[move.capturedPiece.type] * 0.5;
      }

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

    return bestMove;
  }
}

/**
 * Metadata của thuật toán
 */
export const GREEDY_METADATA: AlgorithmMetadata = {
  id: 'greedy',
  name: 'Tham lam (Greedy)',
  description: 'Chọn nước đi tốt nhất ngay lập tức, không tính toán sâu',
  author: 'System',
  version: '1.0.0',
  complexity: 'O(n)'
};
