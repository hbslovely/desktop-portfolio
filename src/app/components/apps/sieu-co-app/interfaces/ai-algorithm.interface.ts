import { Board, Position } from '../models/board.model';
import { Move } from '../models/move.model';
import { PieceColor } from '../models/piece.model';

/**
 * Interface cho các thuật toán AI
 * Cho phép người dùng tự implement thuật toán của riêng họ
 */
export interface IAIAlgorithm {
  /**
   * Tên thuật toán
   */
  readonly name: string;

  /**
   * Mô tả thuật toán
   */
  readonly description: string;

  /**
   * Độ sâu tìm kiếm mặc định
   */
  readonly defaultDepth: number;

  /**
   * Tìm nước đi tốt nhất cho màu quân chỉ định
   * @param board Bàn cờ hiện tại
   * @param color Màu quân cần tìm nước đi
   * @param depth Độ sâu tìm kiếm
   * @returns Nước đi tốt nhất hoặc null nếu không có
   */
  findBestMove(board: Board, color: PieceColor, depth: number): Move | null;

  /**
   * Đánh giá điểm của bàn cờ
   * @param board Bàn cờ cần đánh giá
   * @returns Điểm đánh giá (dương = lợi thế Đen, âm = lợi thế Đỏ)
   */
  evaluate(board: Board): number;

  /**
   * Lấy gợi ý nước đi cho người chơi
   * @param board Bàn cờ hiện tại
   * @param color Màu quân cần gợi ý
   * @returns Nước đi gợi ý hoặc null
   */
  getHint(board: Board, color: PieceColor): Move | null;
}

/**
 * Metadata của thuật toán
 */
export interface AlgorithmMetadata {
  id: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  complexity?: 'O(n)' | 'O(n²)' | 'O(n³)' | 'O(b^d)' | string;
}

/**
 * Kết quả tìm kiếm của thuật toán
 */
export interface SearchResult {
  bestMove: Move | null;
  score: number;
  nodesSearched: number;
  timeMs: number;
  depth: number;
  principalVariation?: Move[];  // Dãy nước đi tốt nhất
}

/**
 * Cấu hình cho thuật toán
 */
export interface AlgorithmConfig {
  maxDepth: number;
  maxTimeMs?: number;
  useOpeningBook?: boolean;
  useQuiescence?: boolean;      // Tìm kiếm yên tĩnh
  useIterativeDeepening?: boolean;
  useTranspositionTable?: boolean;
}

/**
 * Factory để tạo AI algorithm
 */
export type AIAlgorithmFactory = (config?: AlgorithmConfig) => IAIAlgorithm;

/**
 * Registry các thuật toán đã đăng ký
 */
export interface AlgorithmRegistry {
  [id: string]: {
    metadata: AlgorithmMetadata;
    factory: AIAlgorithmFactory;
  };
}
