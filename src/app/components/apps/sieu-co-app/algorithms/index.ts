import { AlgorithmRegistry, IAIAlgorithm, AlgorithmConfig } from '../interfaces';
import { MinimaxAlgorithm, MINIMAX_METADATA } from './minimax.algorithm';
import { RandomAlgorithm, RANDOM_METADATA } from './random.algorithm';
import { GreedyAlgorithm, GREEDY_METADATA } from './greedy.algorithm';

export * from './base.algorithm';
export * from './minimax.algorithm';
export * from './random.algorithm';
export * from './greedy.algorithm';

/**
 * Registry các thuật toán AI có sẵn
 * Người dùng có thể đăng ký thêm thuật toán của riêng họ
 */
export const ALGORITHM_REGISTRY: AlgorithmRegistry = {
  'minimax': {
    metadata: MINIMAX_METADATA,
    factory: (config?: AlgorithmConfig) => new MinimaxAlgorithm(config)
  },
  'random': {
    metadata: RANDOM_METADATA,
    factory: (config?: AlgorithmConfig) => new RandomAlgorithm(config)
  },
  'greedy': {
    metadata: GREEDY_METADATA,
    factory: (config?: AlgorithmConfig) => new GreedyAlgorithm(config)
  }
};

/**
 * Lấy thuật toán theo ID
 */
export function getAlgorithm(id: string, config?: AlgorithmConfig): IAIAlgorithm | null {
  const entry = ALGORITHM_REGISTRY[id];
  if (!entry) return null;
  return entry.factory(config);
}

/**
 * Lấy danh sách metadata của tất cả thuật toán
 */
export function getAvailableAlgorithms() {
  return Object.entries(ALGORITHM_REGISTRY).map(([id, entry]) => ({
    ...entry.metadata,
    id  // Override with the key
  }));
}

/**
 * Đăng ký thuật toán mới
 * Cho phép người dùng tự implement và thêm thuật toán của riêng họ
 *
 * @example
 * ```typescript
 * import { registerAlgorithm, BaseAlgorithm } from './algorithms';
 *
 * class MyCustomAlgorithm extends BaseAlgorithm {
 *   readonly name = 'My Algorithm';
 *   readonly description = 'My custom implementation';
 *   readonly defaultDepth = 5;
 *
 *   findBestMove(board, color, depth) {
 *     // Your implementation here
 *   }
 * }
 *
 * registerAlgorithm('my-algo', {
 *   id: 'my-algo',
 *   name: 'My Algorithm',
 *   description: 'Custom implementation',
 *   author: 'Your Name'
 * }, (config) => new MyCustomAlgorithm(config));
 * ```
 */
export function registerAlgorithm(
  id: string,
  metadata: { id: string; name: string; description: string; author?: string; version?: string },
  factory: (config?: AlgorithmConfig) => IAIAlgorithm
): void {
  ALGORITHM_REGISTRY[id] = { metadata, factory };
}
