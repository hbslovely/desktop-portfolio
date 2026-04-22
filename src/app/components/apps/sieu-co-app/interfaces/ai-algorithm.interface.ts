import { Board, Position } from '../models/board.model';
import { Move } from '../models/move.model';
import { PieceColor } from '../models/piece.model';
import { GameState } from '../models/game-state.model';

/**
 * Tùy chọn tìm kiếm cho AI
 */
export interface SearchOptions {
  maxDepth: number;
  maxTime?: number;
  useQuiescence?: boolean;
  useOpeningBook?: boolean;
  useTranspositionTable?: boolean;
  useIterativeDeepening?: boolean;
}

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
   * Độ sâu tìm kiếm mặc định (tùy chọn cho thuật toán mới)
   */
  readonly defaultDepth?: number;

  /**
   * Thông tin thuật toán (cho thuật toán mới)
   */
  readonly info?: {
    name: string;
    description: string;
    version?: string;
  };

  /**
   * Tìm nước đi tốt nhất cho màu quân chỉ định
   * Hỗ trợ cả interface cũ và mới
   */
  findBestMove(
    board: Board,
    color: PieceColor,
    depthOrOptions?: number | SearchOptions,
    gameState?: GameState
  ): Move | null | SearchResult;

  /**
   * Đánh giá điểm của bàn cờ
   * @param board Bàn cờ cần đánh giá
   * @param color Màu quân (tùy chọn)
   * @returns Điểm đánh giá (dương = lợi thế Đen, âm = lợi thế Đỏ)
   */
  evaluate?(board: Board, color?: PieceColor): number;

  /**
   * Lấy gợi ý nước đi cho người chơi
   * @param board Bàn cờ hiện tại
   * @param color Màu quân cần gợi ý
   * @returns Nước đi gợi ý hoặc null
   */
  getHint?(board: Board, color: PieceColor): Move | null;

  /**
   * Dừng tìm kiếm (tùy chọn)
   */
  stop?(): void;
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
  time?: number;      // milliseconds
  timeMs?: number;    // alias for time
  depth: number;
  pv?: Move[];        // Principal Variation
  principalVariation?: Move[];  // Alias for pv
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
