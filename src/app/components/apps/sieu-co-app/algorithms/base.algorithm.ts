import { Board, cloneBoard, setPieceAt, getPieceAt } from '../models/board.model';
import { PieceColor } from '../models/piece.model';
import { Move } from '../models/move.model';
import { IAIAlgorithm, AlgorithmConfig, SearchResult } from '../interfaces/ai-algorithm.interface';
import { evaluateBoard } from '../utils/evaluation.utils';
import { generateAllMoves, isCheckmate, isInCheck } from '../utils/move-validator.utils';

/**
 * Base class cho các thuật toán AI
 * Cung cấp các phương thức chung
 */
export abstract class BaseAlgorithm implements IAIAlgorithm {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly defaultDepth: number;

  protected config: AlgorithmConfig;
  protected nodesSearched = 0;
  protected startTime = 0;

  constructor(config?: AlgorithmConfig) {
    this.config = {
      maxDepth: config?.maxDepth ?? 4,
      maxTimeMs: config?.maxTimeMs ?? 5000,
      useOpeningBook: config?.useOpeningBook ?? false,
      useQuiescence: config?.useQuiescence ?? true,
      useIterativeDeepening: config?.useIterativeDeepening ?? false,
      useTranspositionTable: config?.useTranspositionTable ?? false
    };
  }

  abstract findBestMove(board: Board, color: PieceColor, depth: number): Move | null;

  evaluate(board: Board): number {
    return evaluateBoard(board);
  }

  getHint(board: Board, color: PieceColor): Move | null {
    return this.findBestMove(board, color, this.defaultDepth);
  }

  /**
   * Thực hiện nước đi trên board và trả về board mới
   */
  protected makeMove(board: Board, move: Move): Board {
    const newBoard = cloneBoard(board);
    setPieceAt(newBoard, move.to, move.piece);
    setPieceAt(newBoard, move.from, null);
    return newBoard;
  }

  /**
   * Sắp xếp nước đi theo độ ưu tiên (nước ăn quân trước)
   */
  protected sortMoves(moves: Move[], maximizing: boolean): Move[] {
    return moves.sort((a, b) => {
      // Ưu tiên nước ăn quân
      const captureA = a.capturedPiece ? 1 : 0;
      const captureB = b.capturedPiece ? 1 : 0;

      // Ưu tiên quân có giá trị cao hơn
      if (captureA && captureB && a.capturedPiece && b.capturedPiece) {
        return b.capturedPiece.type - a.capturedPiece.type;
      }

      return captureB - captureA;
    });
  }

  /**
   * Kiểm tra đã hết thời gian chưa
   */
  protected isTimeUp(): boolean {
    if (!this.config.maxTimeMs) return false;
    return Date.now() - this.startTime > this.config.maxTimeMs;
  }

  /**
   * Tìm kiếm yên tĩnh (quiescence search)
   * Chỉ xét các nước ăn quân để tránh horizon effect
   */
  protected quiescenceSearch(
    board: Board,
    alpha: number,
    beta: number,
    color: PieceColor
  ): number {
    this.nodesSearched++;

    const standPat = this.evaluate(board);
    const isMaximizing = color === PieceColor.BLACK;

    if (isMaximizing) {
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;
    } else {
      if (standPat <= alpha) return alpha;
      if (standPat < beta) beta = standPat;
    }

    // Chỉ xét nước ăn quân
    const moves = generateAllMoves(board, color).filter(m => m.capturedPiece);
    this.sortMoves(moves, isMaximizing);

    const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;

    for (const move of moves) {
      const newBoard = this.makeMove(board, move);
      const score = this.quiescenceSearch(newBoard, alpha, beta, enemyColor);

      if (isMaximizing) {
        if (score > alpha) alpha = score;
        if (alpha >= beta) break;
      } else {
        if (score < beta) beta = score;
        if (beta <= alpha) break;
      }
    }

    return isMaximizing ? alpha : beta;
  }
}
