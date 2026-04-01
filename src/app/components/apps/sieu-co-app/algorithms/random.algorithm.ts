import { Board } from '../models/board.model';
import { PieceColor } from '../models/piece.model';
import { Move } from '../models/move.model';
import { AlgorithmConfig, AlgorithmMetadata } from '../interfaces/ai-algorithm.interface';
import { BaseAlgorithm } from './base.algorithm';
import { generateAllMoves } from '../utils/move-validator.utils';

/**
 * Thuật toán Random
 *
 * Đơn giản chọn ngẫu nhiên một nước đi hợp lệ.
 * Dùng cho mục đích test hoặc độ khó dễ nhất.
 */
export class RandomAlgorithm extends BaseAlgorithm {
  readonly name = 'Ngẫu nhiên';
  readonly description = 'Chọn ngẫu nhiên một nước đi hợp lệ. Phù hợp cho người mới học.';
  readonly defaultDepth = 1;

  constructor(config?: AlgorithmConfig) {
    super(config);
  }

  findBestMove(board: Board, color: PieceColor, _depth: number): Move | null {
    const moves = generateAllMoves(board, color);
    if (moves.length === 0) return null;

    // Ưu tiên nước ăn quân (50% cơ hội)
    const captureMoves = moves.filter(m => m.capturedPiece);
    if (captureMoves.length > 0 && Math.random() < 0.5) {
      return captureMoves[Math.floor(Math.random() * captureMoves.length)];
    }

    return moves[Math.floor(Math.random() * moves.length)];
  }
}

/**
 * Metadata của thuật toán
 */
export const RANDOM_METADATA: AlgorithmMetadata = {
  id: 'random',
  name: 'Ngẫu nhiên',
  description: 'Chọn nước đi ngẫu nhiên trong các nước hợp lệ',
  author: 'System',
  version: '1.0.0',
  complexity: 'O(n)'
};
