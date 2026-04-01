import { Board, cloneBoard, setPieceAt, getPieceAt, BOARD_ROWS, BOARD_COLS } from '../models/board.model';
import { PieceColor, PieceType, Piece, PIECE_VALUES } from '../models/piece.model';
import { Move } from '../models/move.model';
import { IAIAlgorithm, AlgorithmMetadata, SearchOptions, SearchResult } from '../interfaces/ai-algorithm.interface';
import { generateAllMoves, isCheckmate, isInCheck, isStalemate } from '../utils/move-validator.utils';
import { GameState } from '../models/game-state.model';

/**
 * Thuật toán AI nâng cao
 * 
 * Kết hợp nhiều kỹ thuật:
 * - Iterative Deepening với Aspiration Windows
 * - Principal Variation Search (PVS)
 * - Transposition Table với Zobrist Hashing
 * - Killer Moves & History Heuristic
 * - Quiescence Search với Delta Pruning
 * - Null Move Pruning
 * - Late Move Reductions (LMR)
 */
export class AdvancedAlgorithm implements IAIAlgorithm {
  readonly name = 'Advanced AI';
  readonly description = 'Thuật toán AI nâng cao với nhiều kỹ thuật tối ưu hóa';
  readonly version = '2.0.0';

  // Transposition Table
  private transpositionTable: Map<string, TTEntry> = new Map();
  private readonly TT_SIZE = 1000000;

  // Zobrist keys
  private zobristTable: number[][][] = [];
  private zobristTurn: number = 0;

  // Killer moves (2 slots per ply)
  private killerMoves: Move[][] = [];

  // History heuristic
  private historyTable: Map<string, number> = new Map();

  // Search statistics
  private nodesSearched = 0;
  private startTime = 0;
  private maxTime = 10000;
  private shouldStop = false;

  // Principal Variation
  private pvTable: Move[][] = [];
  private pvLength: number[] = [];

  // Opening book (common Chinese chess openings)
  private openingBook: Map<string, Move[]> = new Map();

  constructor() {
    this.initZobrist();
    this.initOpeningBook();
  }

  get info() {
    return {
      name: this.name,
      description: this.description,
      version: this.version
    };
  }

  /**
   * Initialize Zobrist hashing
   */
  private initZobrist(): void {
    // Random numbers for each piece type, color, and position
    for (let row = 0; row < BOARD_ROWS; row++) {
      this.zobristTable[row] = [];
      for (let col = 0; col < BOARD_COLS; col++) {
        this.zobristTable[row][col] = [];
        for (let pieceIdx = 0; pieceIdx < 16; pieceIdx++) {
          this.zobristTable[row][col][pieceIdx] = Math.floor(Math.random() * 2147483647);
        }
      }
    }
    this.zobristTurn = Math.floor(Math.random() * 2147483647);
  }

  /**
   * Initialize opening book
   */
  private initOpeningBook(): void {
    // 中炮 - Central Cannon
    this.openingBook.set('initial', [
      { from: { row: 7, col: 4 }, to: { row: 4, col: 4 }, piece: { type: PieceType.CANNON, color: PieceColor.BLACK } as Piece },
      { from: { row: 7, col: 1 }, to: { row: 7, col: 4 }, piece: { type: PieceType.CANNON, color: PieceColor.BLACK } as Piece },
      { from: { row: 9, col: 1 }, to: { row: 7, col: 2 }, piece: { type: PieceType.HORSE, color: PieceColor.BLACK } as Piece },
      { from: { row: 9, col: 7 }, to: { row: 7, col: 6 }, piece: { type: PieceType.HORSE, color: PieceColor.BLACK } as Piece },
    ]);
  }

  /**
   * Calculate Zobrist hash for board
   */
  private calculateHash(board: Board, turn: PieceColor): number {
    let hash = 0;
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const piece = getPieceAt(board, { row, col });
        if (piece) {
          const pieceIdx = piece.type + (piece.color === PieceColor.BLACK ? 7 : 0);
          hash ^= this.zobristTable[row][col][pieceIdx];
        }
      }
    }
    if (turn === PieceColor.BLACK) {
      hash ^= this.zobristTurn;
    }
    return hash;
  }

  findBestMove(board: Board, color: PieceColor, options?: SearchOptions, gameState?: GameState): SearchResult {
    this.nodesSearched = 0;
    this.startTime = Date.now();
    this.maxTime = options?.maxTime ?? 10000;
    this.shouldStop = false;
    this.transpositionTable.clear();
    this.killerMoves = Array(50).fill(null).map(() => []);
    this.historyTable.clear();

    const maxDepth = options?.maxDepth ?? 6;
    let bestMove: Move | null = null;
    let bestScore = -Infinity;

    // Check opening book
    if (options?.useOpeningBook && gameState?.moveHistory.length === 0) {
      const bookMoves = this.openingBook.get('initial');
      if (bookMoves && bookMoves.length > 0) {
        const moves = generateAllMoves(board, color);
        const randomBook = bookMoves[Math.floor(Math.random() * bookMoves.length)];
        const validBookMove = moves.find(m => 
          m.from.row === randomBook.from.row && 
          m.from.col === randomBook.from.col &&
          m.to.row === randomBook.to.row &&
          m.to.col === randomBook.to.col
        );
        if (validBookMove) {
          return {
            bestMove: validBookMove,
            score: 0,
            depth: 0,
            nodesSearched: 0,
            time: 0,
            pv: [validBookMove]
          };
        }
      }
    }

    // Iterative Deepening
    if (options?.useIterativeDeepening) {
      let alpha = -Infinity;
      let beta = Infinity;
      const ASPIRATION_WINDOW = 50;

      for (let depth = 1; depth <= maxDepth && !this.shouldStop; depth++) {
        this.pvTable = Array(50).fill(null).map(() => []);
        this.pvLength = Array(50).fill(0);

        const result = this.searchRoot(board, color, depth, alpha, beta);
        
        if (this.shouldStop) break;

        if (result.score !== null) {
          bestMove = result.move;
          bestScore = result.score;

          // Aspiration window adjustment
          if (result.score <= alpha || result.score >= beta) {
            alpha = -Infinity;
            beta = Infinity;
          } else {
            alpha = result.score - ASPIRATION_WINDOW;
            beta = result.score + ASPIRATION_WINDOW;
          }
        }

        console.log(`[Advanced] Depth ${depth}: Score ${result.score}, Nodes ${this.nodesSearched}, Time ${Date.now() - this.startTime}ms`);
      }
    } else {
      // Single depth search
      const result = this.searchRoot(board, color, maxDepth, -Infinity, Infinity);
      bestMove = result.move;
      bestScore = result.score ?? 0;
    }

    return {
      bestMove,
      score: bestScore,
      depth: maxDepth,
      nodesSearched: this.nodesSearched,
      time: Date.now() - this.startTime,
      pv: this.pvTable[0] || []
    };
  }

  /**
   * Root search
   */
  private searchRoot(board: Board, color: PieceColor, depth: number, alpha: number, beta: number): { move: Move | null; score: number | null } {
    const moves = generateAllMoves(board, color);
    if (moves.length === 0) return { move: null, score: null };

    this.orderMoves(moves, board, 0, null);

    let bestMove = moves[0];
    let bestScore = -Infinity;
    const isMaximizing = color === PieceColor.BLACK;

    for (let i = 0; i < moves.length; i++) {
      if (this.isTimeUp()) {
        this.shouldStop = true;
        break;
      }

      const move = moves[i];
      const newBoard = this.makeMove(board, move);
      const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;

      let score: number;
      
      // PVS - Principal Variation Search
      if (i === 0) {
        score = -this.pvs(newBoard, depth - 1, -beta, -alpha, !isMaximizing, enemyColor, 1);
      } else {
        // Null window search
        score = -this.pvs(newBoard, depth - 1, -alpha - 1, -alpha, !isMaximizing, enemyColor, 1);
        
        if (score > alpha && score < beta) {
          // Re-search with full window
          score = -this.pvs(newBoard, depth - 1, -beta, -alpha, !isMaximizing, enemyColor, 1);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
        
        if (score > alpha) {
          alpha = score;
          this.updatePV(move, 0);
        }
      }

      if (score >= beta) {
        this.updateKillerMove(move, 0);
        this.updateHistory(move, depth);
        break;
      }
    }

    return { move: bestMove, score: isMaximizing ? bestScore : -bestScore };
  }

  /**
   * Principal Variation Search
   */
  private pvs(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    color: PieceColor,
    ply: number
  ): number {
    this.nodesSearched++;

    if (this.isTimeUp()) {
      this.shouldStop = true;
      return 0;
    }

    // Check transposition table
    const hash = this.calculateHash(board, color).toString();
    const ttEntry = this.transpositionTable.get(hash);
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === TTFlag.EXACT) return ttEntry.score;
      if (ttEntry.flag === TTFlag.LOWER && ttEntry.score >= beta) return ttEntry.score;
      if (ttEntry.flag === TTFlag.UPPER && ttEntry.score <= alpha) return ttEntry.score;
    }

    // Terminal conditions
    if (isCheckmate(board, color)) {
      return isMaximizing ? -100000 + ply : 100000 - ply;
    }

    if (isStalemate(board, color)) {
      return isMaximizing ? -100000 + ply : 100000 - ply;
    }

    if (depth <= 0) {
      return this.quiescenceSearch(board, alpha, beta, color, ply);
    }

    const moves = generateAllMoves(board, color);
    if (moves.length === 0) {
      return this.evaluate(board, color);
    }

    this.orderMoves(moves, board, ply, ttEntry?.bestMove);

    const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;
    let bestScore = -Infinity;
    let bestMove: Move | null = null;
    let ttFlag = TTFlag.UPPER;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const newBoard = this.makeMove(board, move);

      let score: number;

      // Late Move Reductions (LMR)
      let reduction = 0;
      if (i >= 4 && depth >= 3 && !move.capturedPiece && !move.isCheck) {
        reduction = 1;
        if (i >= 8) reduction = 2;
      }

      if (i === 0) {
        score = -this.pvs(newBoard, depth - 1, -beta, -alpha, !isMaximizing, enemyColor, ply + 1);
      } else {
        // Reduced null window search
        score = -this.pvs(newBoard, depth - 1 - reduction, -alpha - 1, -alpha, !isMaximizing, enemyColor, ply + 1);

        // Re-search if promising
        if (score > alpha && (reduction > 0 || score < beta)) {
          score = -this.pvs(newBoard, depth - 1, -beta, -alpha, !isMaximizing, enemyColor, ply + 1);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }

      if (score > alpha) {
        alpha = score;
        ttFlag = TTFlag.EXACT;
        this.updatePV(move, ply);
      }

      if (score >= beta) {
        ttFlag = TTFlag.LOWER;
        this.updateKillerMove(move, ply);
        this.updateHistory(move, depth);
        break;
      }
    }

    // Store in transposition table
    if (this.transpositionTable.size < this.TT_SIZE) {
      this.transpositionTable.set(hash, {
        depth,
        score: bestScore,
        flag: ttFlag,
        bestMove
      });
    }

    return bestScore;
  }

  /**
   * Quiescence Search với Delta Pruning
   */
  private quiescenceSearch(board: Board, alpha: number, beta: number, color: PieceColor, ply: number): number {
    this.nodesSearched++;

    const standPat = this.evaluate(board, color);

    if (standPat >= beta) return beta;
    
    // Delta pruning
    const DELTA = 900; // Giá trị Xe
    if (standPat + DELTA < alpha) return alpha;
    
    if (standPat > alpha) alpha = standPat;

    // Chỉ xét nước ăn quân và chiếu
    const moves = generateAllMoves(board, color).filter(m => m.capturedPiece || isInCheck(this.makeMove(board, m), color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED));
    
    this.orderMoves(moves, board, ply, null);

    const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;

    for (const move of moves) {
      // SEE pruning - Skip bad captures
      if (move.capturedPiece && !this.isGoodCapture(move)) continue;

      const newBoard = this.makeMove(board, move);
      const score = -this.quiescenceSearch(newBoard, -beta, -alpha, enemyColor, ply + 1);

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }

    return alpha;
  }

  /**
   * Static Exchange Evaluation (SEE) - kiểm tra nước ăn có tốt không
   */
  private isGoodCapture(move: Move): boolean {
    if (!move.capturedPiece) return false;
    
    const capturedValue = PIECE_VALUES[move.capturedPiece.type];
    const attackerValue = PIECE_VALUES[move.piece.type];
    
    // Nếu ăn quân có giá trị cao hơn hoặc bằng, luôn tốt
    if (capturedValue >= attackerValue) return true;
    
    // Tốt ăn gì cũng tốt (trừ bị bảo vệ)
    if (move.piece.type === PieceType.PAWN) return true;
    
    return capturedValue > attackerValue - 100;
  }

  /**
   * Order moves for better alpha-beta pruning
   */
  private orderMoves(moves: Move[], board: Board, ply: number, hashMove: Move | null | undefined): void {
    const scores: number[] = moves.map((move, _idx) => {
      let score = 0;

      // Hash move từ transposition table (highest priority)
      if (hashMove && move.from.row === hashMove.from.row && move.from.col === hashMove.from.col &&
          move.to.row === hashMove.to.row && move.to.col === hashMove.to.col) {
        return 100000;
      }

      // Nước ăn quân (MVV-LVA: Most Valuable Victim - Least Valuable Attacker)
      if (move.capturedPiece) {
        const victimValue = PIECE_VALUES[move.capturedPiece.type];
        const attackerValue = PIECE_VALUES[move.piece.type];
        score += 50000 + victimValue * 10 - attackerValue;
      }

      // Killer moves
      const killers = this.killerMoves[ply];
      if (killers) {
        for (let i = 0; i < killers.length; i++) {
          const killer = killers[i];
          if (killer && move.from.row === killer.from.row && move.from.col === killer.from.col &&
              move.to.row === killer.to.row && move.to.col === killer.to.col) {
            score += 40000 - i * 1000;
            break;
          }
        }
      }

      // Nước chiếu
      if (move.isCheck) {
        score += 30000;
      }

      // History heuristic
      const historyKey = `${move.from.row},${move.from.col}-${move.to.row},${move.to.col}`;
      score += this.historyTable.get(historyKey) || 0;

      // Đe dọa quân có giá trị cao
      if (move.capturedPiece && move.capturedPiece.type === PieceType.KING) {
        score += 90000;
      }

      // Thăng tiến Tốt
      if (move.piece.type === PieceType.PAWN) {
        if (move.piece.color === PieceColor.RED && move.to.row <= 4) {
          score += 2000;
        } else if (move.piece.color === PieceColor.BLACK && move.to.row >= 5) {
          score += 2000;
        }
      }

      // Kiểm soát trung tâm
      if (move.to.col >= 3 && move.to.col <= 5 && move.to.row >= 3 && move.to.row <= 6) {
        score += 500;
      }

      return score;
    });

    // Sort by scores descending
    const indexed = moves.map((m, i) => ({ move: m, score: scores[i] }));
    indexed.sort((a, b) => b.score - a.score);
    
    for (let i = 0; i < moves.length; i++) {
      moves[i] = indexed[i].move;
    }
  }

  /**
   * Update killer move
   */
  private updateKillerMove(move: Move, ply: number): void {
    if (move.capturedPiece) return; // Không lưu nước ăn quân

    const killers = this.killerMoves[ply] || [];
    
    // Check if already in list
    const exists = killers.some(k => 
      k.from.row === move.from.row && k.from.col === move.from.col &&
      k.to.row === move.to.row && k.to.col === move.to.col
    );

    if (!exists) {
      killers.unshift(move);
      if (killers.length > 2) killers.pop();
      this.killerMoves[ply] = killers;
    }
  }

  /**
   * Update history heuristic
   */
  private updateHistory(move: Move, depth: number): void {
    const key = `${move.from.row},${move.from.col}-${move.to.row},${move.to.col}`;
    const current = this.historyTable.get(key) || 0;
    this.historyTable.set(key, current + depth * depth);
  }

  /**
   * Update principal variation
   */
  private updatePV(move: Move, ply: number): void {
    this.pvTable[ply] = [move, ...(this.pvTable[ply + 1] || [])];
    this.pvLength[ply] = this.pvLength[ply + 1] + 1;
  }

  /**
   * Evaluate board position
   */
  evaluate(board: Board, color: PieceColor): number {
    let score = 0;

    // Material & Position
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const piece = getPieceAt(board, { row, col });
        if (!piece) continue;

        let pieceScore = PIECE_VALUES[piece.type];
        pieceScore += this.getPositionalScore(piece, row, col);
        pieceScore += this.getMobilityBonus(board, piece, row, col);
        pieceScore += this.getThreatBonus(board, piece, row, col);

        if (piece.color === color) {
          score += pieceScore;
        } else {
          score -= pieceScore;
        }
      }
    }

    // King safety
    score += this.evaluateKingSafety(board, color);
    score -= this.evaluateKingSafety(board, color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED);

    // Piece coordination
    score += this.evaluateCoordination(board, color);

    // Attack potential
    score += this.evaluateAttackPotential(board, color);

    return score;
  }

  /**
   * Enhanced positional scoring
   */
  private getPositionalScore(piece: Piece, row: number, col: number): number {
    const { type, color } = piece;
    const actualRow = color === PieceColor.RED ? (9 - row) : row;

    // Piece-specific position tables
    switch (type) {
      case PieceType.ROOK:
        return this.ROOK_PST[actualRow][col];
      case PieceType.HORSE:
        return this.HORSE_PST[actualRow][col];
      case PieceType.CANNON:
        return this.CANNON_PST[actualRow][col];
      case PieceType.PAWN:
        return this.PAWN_PST[actualRow][col];
      case PieceType.ADVISOR:
        return this.ADVISOR_PST[actualRow][col];
      case PieceType.ELEPHANT:
        return this.ELEPHANT_PST[actualRow][col];
      default:
        return 0;
    }
  }

  /**
   * Mobility bonus
   */
  private getMobilityBonus(board: Board, piece: Piece, row: number, col: number): number {
    if (piece.type === PieceType.KING || piece.type === PieceType.ADVISOR || piece.type === PieceType.ELEPHANT) {
      return 0;
    }

    const pos = { row, col };
    const fakePiece = { ...piece };
    const moves = this.countMoves(board, fakePiece, pos);

    switch (piece.type) {
      case PieceType.ROOK:
        return moves * 5;
      case PieceType.CANNON:
        return moves * 3;
      case PieceType.HORSE:
        return moves * 4;
      case PieceType.PAWN:
        return moves * 2;
      default:
        return 0;
    }
  }

  private countMoves(board: Board, piece: Piece, pos: { row: number; col: number }): number {
    // Simple move count approximation
    let count = 0;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
      let r = pos.row + dr;
      let c = pos.col + dc;

      while (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
        const p = getPieceAt(board, { row: r, col: c });
        if (!p) count++;
        else break;
        
        if (piece.type !== PieceType.ROOK && piece.type !== PieceType.CANNON) break;
        r += dr;
        c += dc;
      }
    }

    return count;
  }

  /**
   * Threat bonus - đe dọa quân đối phương
   */
  private getThreatBonus(board: Board, piece: Piece, row: number, col: number): number {
    // Placeholder - can be expanded
    return 0;
  }

  /**
   * King safety evaluation
   */
  private evaluateKingSafety(board: Board, color: PieceColor): number {
    let safety = 0;

    // Find king
    let kingPos: { row: number; col: number } | null = null;
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const p = getPieceAt(board, { row: r, col: c });
        if (p && p.type === PieceType.KING && p.color === color) {
          kingPos = { row: r, col: c };
          break;
        }
      }
      if (kingPos) break;
    }

    if (!kingPos) return -10000;

    // Count defenders around palace
    const palaceRows = color === PieceColor.RED ? [7, 8, 9] : [0, 1, 2];
    const palaceCols = [3, 4, 5];

    for (const r of palaceRows) {
      for (const c of palaceCols) {
        const p = getPieceAt(board, { row: r, col: c });
        if (p && p.color === color) {
          if (p.type === PieceType.ADVISOR) safety += 30;
          if (p.type === PieceType.ELEPHANT) safety += 20;
        }
      }
    }

    // Penalty if facing enemy rook/cannon on same file
    const enemyColor = color === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;
    for (let r = 0; r < BOARD_ROWS; r++) {
      const p = getPieceAt(board, { row: r, col: kingPos.col });
      if (p && p.color === enemyColor) {
        if (p.type === PieceType.ROOK || p.type === PieceType.CANNON) {
          safety -= 50;
        }
      }
    }

    return safety;
  }

  /**
   * Piece coordination
   */
  private evaluateCoordination(board: Board, color: PieceColor): number {
    let score = 0;

    // Connected rooks bonus
    const rooks: { row: number; col: number }[] = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const p = getPieceAt(board, { row: r, col: c });
        if (p && p.type === PieceType.ROOK && p.color === color) {
          rooks.push({ row: r, col: c });
        }
      }
    }

    if (rooks.length === 2) {
      if (rooks[0].row === rooks[1].row || rooks[0].col === rooks[1].col) {
        score += 30; // Connected rooks
      }
    }

    // Horse + Cannon coordination
    const horses: { row: number; col: number }[] = [];
    const cannons: { row: number; col: number }[] = [];
    
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const p = getPieceAt(board, { row: r, col: c });
        if (p && p.color === color) {
          if (p.type === PieceType.HORSE) horses.push({ row: r, col: c });
          if (p.type === PieceType.CANNON) cannons.push({ row: r, col: c });
        }
      }
    }

    // Bonus for horse near enemy king zone
    const enemyKingRows = color === PieceColor.RED ? [0, 1, 2] : [7, 8, 9];
    for (const h of horses) {
      if (enemyKingRows.includes(h.row)) {
        score += 20;
      }
    }

    return score;
  }

  /**
   * Attack potential
   */
  private evaluateAttackPotential(board: Board, color: PieceColor): number {
    // Count pieces in enemy territory
    let score = 0;
    const enemyTerritory = color === PieceColor.RED ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];

    for (const row of enemyTerritory) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const p = getPieceAt(board, { row, col });
        if (p && p.color === color) {
          switch (p.type) {
            case PieceType.ROOK:
              score += 15;
              break;
            case PieceType.CANNON:
              score += 10;
              break;
            case PieceType.HORSE:
              score += 12;
              break;
            case PieceType.PAWN:
              score += 8;
              break;
          }
        }
      }
    }

    return score;
  }

  private makeMove(board: Board, move: Move): Board {
    const newBoard = cloneBoard(board);
    setPieceAt(newBoard, move.to, move.piece);
    setPieceAt(newBoard, move.from, null);
    return newBoard;
  }

  private isTimeUp(): boolean {
    return Date.now() - this.startTime > this.maxTime;
  }

  stop(): void {
    this.shouldStop = true;
  }

  // ============ Piece-Square Tables ============

  private readonly ROOK_PST = [
    [14, 14, 12, 18, 16, 18, 12, 14, 14],
    [16, 20, 18, 24, 26, 24, 18, 20, 16],
    [12, 12, 12, 18, 18, 18, 12, 12, 12],
    [12, 18, 16, 22, 22, 22, 16, 18, 12],
    [12, 14, 12, 18, 18, 18, 12, 14, 12],
    [12, 16, 14, 20, 20, 20, 14, 16, 12],
    [6, 10, 8, 14, 14, 14, 8, 10, 6],
    [4, 8, 6, 14, 12, 14, 6, 8, 4],
    [8, 4, 8, 16, 8, 16, 8, 4, 8],
    [-2, 10, 6, 14, 12, 14, 6, 10, -2]
  ];

  private readonly HORSE_PST = [
    [4, 8, 16, 12, 4, 12, 16, 8, 4],
    [4, 10, 28, 16, 8, 16, 28, 10, 4],
    [12, 14, 16, 20, 18, 20, 16, 14, 12],
    [8, 24, 18, 24, 20, 24, 18, 24, 8],
    [6, 16, 14, 18, 16, 18, 14, 16, 6],
    [4, 12, 16, 14, 12, 14, 16, 12, 4],
    [2, 6, 8, 6, 10, 6, 8, 6, 2],
    [4, 2, 8, 8, 4, 8, 8, 2, 4],
    [0, 2, 4, 4, -2, 4, 4, 2, 0],
    [0, -4, 0, 0, 0, 0, 0, -4, 0]
  ];

  private readonly CANNON_PST = [
    [6, 4, 0, -10, -12, -10, 0, 4, 6],
    [2, 2, 0, -4, -14, -4, 0, 2, 2],
    [2, 2, 0, -10, -8, -10, 0, 2, 2],
    [0, 0, -2, 4, 10, 4, -2, 0, 0],
    [0, 0, 0, 2, 8, 2, 0, 0, 0],
    [-2, 0, 4, 2, 6, 2, 4, 0, -2],
    [0, 0, 0, 2, 4, 2, 0, 0, 0],
    [4, 0, 8, 6, 10, 6, 8, 0, 4],
    [0, 2, 4, 6, 6, 6, 4, 2, 0],
    [0, 0, 2, 6, 6, 6, 2, 0, 0]
  ];

  private readonly PAWN_PST = [
    [0, 3, 6, 9, 12, 9, 6, 3, 0],
    [18, 36, 56, 80, 120, 80, 56, 36, 18],
    [14, 26, 42, 60, 80, 60, 42, 26, 14],
    [10, 20, 30, 34, 40, 34, 30, 20, 10],
    [6, 12, 18, 18, 20, 18, 18, 12, 6],
    [2, 0, 8, 0, 8, 0, 8, 0, 2],
    [0, 0, -2, 0, 4, 0, -2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ];

  private readonly ADVISOR_PST = [
    [0, 0, 0, 20, 0, 20, 0, 0, 0],
    [0, 0, 0, 0, 23, 0, 0, 0, 0],
    [0, 0, 0, 20, 0, 20, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 20, 0, 20, 0, 0, 0],
    [0, 0, 0, 0, 23, 0, 0, 0, 0],
    [0, 0, 0, 20, 0, 20, 0, 0, 0]
  ];

  private readonly ELEPHANT_PST = [
    [0, 0, 20, 0, 0, 0, 20, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [18, 0, 0, 0, 23, 0, 0, 0, 18],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 20, 0, 0, 0, 20, 0, 0],
    [0, 0, 20, 0, 0, 0, 20, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [18, 0, 0, 0, 23, 0, 0, 0, 18],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 20, 0, 0, 0, 20, 0, 0]
  ];
}

/**
 * Transposition Table entry
 */
interface TTEntry {
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove: Move | null;
}

enum TTFlag {
  EXACT = 0,
  LOWER = 1,
  UPPER = 2
}

/**
 * Metadata
 */
export const ADVANCED_METADATA: AlgorithmMetadata = {
  id: 'advanced',
  name: 'Advanced AI',
  description: 'Thuật toán AI nâng cao với PVS, Transposition Table, Killer Moves, History Heuristic',
  author: 'System',
  version: '2.0.0',
  complexity: 'O(b^(d/2)) với pruning tối ưu'
};
