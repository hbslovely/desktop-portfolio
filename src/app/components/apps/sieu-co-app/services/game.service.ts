import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Board,
  createStandardBoard,
  cloneBoard,
  setPieceAt,
  getPieceAt,
  boardToFEN
} from '../models/board.model';
import { PieceColor, PieceType, PieceState } from '../models/piece.model';
import { Move, MoveHistory, createMove } from '../models/move.model';
import {
  GameState,
  GameStatus,
  GameMode,
  GameConfig,
  createDefaultGameConfig
} from '../models/game-state.model';
import {
  generatePieceMoves,
  generateAllMoves,
  isInCheck,
  isCheckmate,
  isStalemate
} from '../utils/move-validator.utils';
import { createMoveNotation } from '../utils/notation.utils';
import { getAlgorithm } from '../algorithms';
import {
  createHiddenBoard,
  generateHiddenPieceMoves,
  flipPiece,
  isHiddenGameOver,
  isValidHiddenPosition
} from '../utils/hidden-chess.utils';

@Injectable()
export class GameService {
  private gameStateSubject: BehaviorSubject<GameState>;
  public gameState$: Observable<GameState>;

  private isAIThinkingSubject = new BehaviorSubject<boolean>(false);
  public isAIThinking$ = this.isAIThinkingSubject.asObservable();

  constructor() {
    const initialState = this.createInitialState();
    this.gameStateSubject = new BehaviorSubject<GameState>(initialState);
    this.gameState$ = this.gameStateSubject.asObservable();
  }

  get isAIThinking(): boolean {
    return this.isAIThinkingSubject.value;
  }

  private createInitialState(): GameState {
    return {
      board: createStandardBoard(),
      currentTurn: PieceColor.RED,
      status: GameStatus.NOT_STARTED,
      config: createDefaultGameConfig(),
      moveHistory: [],
      capturedPieces: { byRed: [], byBlack: [] },
      isCheck: false,
      selectedPosition: null,
      possibleMoves: [],
      lastMove: null
    };
  }

  get state(): GameState {
    return this.gameStateSubject.value;
  }

  /**
   * Bắt đầu ván mới
   */
  newGame(config?: Partial<GameConfig>): void {
    const newState = this.createInitialState();
    if (config) {
      newState.config = { ...newState.config, ...config };
    }

    // Setup board based on game mode
    if (newState.config.mode === GameMode.HIDDEN) {
      newState.board = createHiddenBoard();
      // In hidden chess, colors are determined by first flip
      // Start with RED turn by convention
      newState.currentTurn = PieceColor.RED;
    }

    newState.status = GameStatus.PLAYING;
    this.gameStateSubject.next(newState);

    // Nếu AI đi trước (only for standard chess)
    if (newState.config.mode !== GameMode.HIDDEN && newState.config.playerColor === PieceColor.BLACK) {
      this.makeAIMove();
    }
  }

  /**
   * Chọn ô trên bàn cờ
   */
  selectCell(row: number, col: number): void {
    const state = this.state;

    // Hidden Chess mode - separate logic
    if (state.config.mode === GameMode.HIDDEN) {
      this.selectCellHidden(row, col);
      return;
    }

    // Standard Chess logic
    // Cho phép xem nước đi khi chưa start (preview mode)
    const isPreviewMode = state.status === GameStatus.NOT_STARTED;
    const isPlayingAndMyTurn = state.status === GameStatus.PLAYING &&
                               state.currentTurn === state.config.playerColor;

    // Không cho phép khi game over hoặc đang lượt AI
    if (!isPreviewMode && !isPlayingAndMyTurn) return;

    const piece = getPieceAt(state.board, { row, col });

    // Nếu đang có quân được chọn và click vào ô có thể đi
    if (state.selectedPosition) {
      const possibleMove = state.possibleMoves.find(m => m.row === row && m.col === col);
      
      if (possibleMove) {
        if (isPlayingAndMyTurn) {
          // Đang chơi - thực hiện nước đi
          this.makeMove(state.selectedPosition, { row, col });
          return;
        } else {
          // Preview mode - không cho đi, giữ nguyên selection
          return;
        }
      }
    }

    // Chọn quân của mình (hoặc quân đỏ khi preview)
    const canSelectPiece = isPreviewMode
      ? piece && piece.color === PieceColor.RED  // Preview: chỉ xem quân Đỏ
      : piece && piece.color === state.config.playerColor;

    if (canSelectPiece) {
      const moves = generatePieceMoves(state.board, { row, col });
      this.updateState({
        selectedPosition: { row, col },
        possibleMoves: moves.map(m => m.to)
      });
    } else {
      // Bỏ chọn
      this.updateState({
        selectedPosition: null,
        possibleMoves: []
      });
    }
  }

  /**
   * Xử lý click cho Cờ Úp
   */
  private selectCellHidden(row: number, col: number): void {
    const state = this.state;
    if (state.status !== GameStatus.PLAYING) return;

    // Check valid position for hidden chess (4x8 area: rows 3-6)
    if (!isValidHiddenPosition({ row, col })) return;

    const piece = getPieceAt(state.board, { row, col });

    // If clicking on a hidden piece - flip it
    if (piece && piece.state === PieceState.HIDDEN) {
      this.flipHiddenPiece(row, col);
      return;
    }

    // If already selected and clicking on possible move
    if (state.selectedPosition) {
      const possibleMove = state.possibleMoves.find(m => m.row === row && m.col === col);
      if (possibleMove) {
        this.makeHiddenMove(state.selectedPosition, { row, col });
        return;
      }
    }

    // Select own revealed piece
    if (piece && piece.state === PieceState.NORMAL && piece.color === state.currentTurn) {
      const moves = generateHiddenPieceMoves(state.board, { row, col });
      this.updateState({
        selectedPosition: { row, col },
        possibleMoves: moves.map(m => m.to)
      });
    } else {
      // Deselect
      this.updateState({
        selectedPosition: null,
        possibleMoves: []
      });
    }
  }

  /**
   * Lật quân úp
   */
  private flipHiddenPiece(row: number, col: number): void {
    const state = this.state;
    const newBoard = cloneBoard(state.board);
    
    const revealedPiece = flipPiece(newBoard, { row, col });
    if (!revealedPiece) return;

    // Switch turn
    const nextTurn = state.currentTurn === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;

    // Check game over
    const winner = isHiddenGameOver(newBoard);
    const newStatus = winner 
      ? (winner === PieceColor.RED ? GameStatus.RED_WIN : GameStatus.BLACK_WIN)
      : GameStatus.PLAYING;

    this.updateState({
      board: newBoard,
      currentTurn: nextTurn,
      status: newStatus,
      selectedPosition: null,
      possibleMoves: [],
      lastMove: { from: { row, col }, to: { row, col } }
    });

    // AI turn
    if (newStatus === GameStatus.PLAYING && nextTurn !== state.config.playerColor) {
      setTimeout(() => this.makeHiddenAIMove(), 500);
    }
  }

  /**
   * Thực hiện nước đi Cờ Úp
   */
  private makeHiddenMove(from: { row: number; col: number }, to: { row: number; col: number }): void {
    const state = this.state;
    const piece = getPieceAt(state.board, from);
    if (!piece) return;

    const newBoard = cloneBoard(state.board);
    const capturedPiece = getPieceAt(newBoard, to);

    // Move piece
    setPieceAt(newBoard, to, piece);
    setPieceAt(newBoard, from, null);

    // Update captured pieces
    const capturedPieces = { ...state.capturedPieces };
    if (capturedPiece) {
      if (piece.color === PieceColor.RED) {
        capturedPieces.byRed = [...capturedPieces.byRed, capturedPiece];
      } else {
        capturedPieces.byBlack = [...capturedPieces.byBlack, capturedPiece];
      }
    }

    // Switch turn
    const nextTurn = state.currentTurn === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;

    // Check game over
    const winner = isHiddenGameOver(newBoard);
    const newStatus = winner 
      ? (winner === PieceColor.RED ? GameStatus.RED_WIN : GameStatus.BLACK_WIN)
      : GameStatus.PLAYING;

    this.updateState({
      board: newBoard,
      currentTurn: nextTurn,
      status: newStatus,
      capturedPieces,
      selectedPosition: null,
      possibleMoves: [],
      lastMove: { from, to }
    });

    // AI turn
    if (newStatus === GameStatus.PLAYING && nextTurn !== state.config.playerColor) {
      setTimeout(() => this.makeHiddenAIMove(), 500);
    }
  }

  /**
   * AI đi cho Cờ Úp
   */
  private async makeHiddenAIMove(): Promise<void> {
    const state = this.state;
    if (state.status !== GameStatus.PLAYING) return;
    if (state.currentTurn === state.config.playerColor) return;

    this.isAIThinkingSubject.next(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    const algorithm = getAlgorithm('hidden-chess');
    if (!algorithm) {
      // Fallback: random flip or move
      this.makeRandomHiddenMove();
      this.isAIThinkingSubject.next(false);
      return;
    }

    const result = algorithm.findBestMove(state.board, state.currentTurn, state.config.aiDifficulty);
    this.isAIThinkingSubject.next(false);

    // Handle both return types (Move | SearchResult)
    let bestMove: Move | null = null;
    if (result && typeof result === 'object' && 'bestMove' in result) {
      bestMove = (result as { bestMove: Move | null }).bestMove;
    } else {
      bestMove = result as Move | null;
    }

    if (bestMove) {
      this.makeHiddenMove(bestMove.from, bestMove.to);
    } else {
      // Try to flip a random piece
      this.makeRandomHiddenMove();
    }
  }

  /**
   * Nước đi ngẫu nhiên cho AI Cờ Úp (fallback)
   */
  private makeRandomHiddenMove(): void {
    const state = this.state;
    
    // Try to find a hidden piece to flip
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = getPieceAt(state.board, { row, col });
        if (piece && piece.state === PieceState.HIDDEN) {
          this.flipHiddenPiece(row, col);
          return;
        }
      }
    }
  }

  /**
   * Thực hiện nước đi
   */
  makeMove(from: { row: number; col: number }, to: { row: number; col: number }): boolean {
    const state = this.state;
    const piece = getPieceAt(state.board, from);
    if (!piece) return false;

    // Validate nước đi
    const validMoves = generatePieceMoves(state.board, from);
    const isValid = validMoves.some(m => m.to.row === to.row && m.to.col === to.col);
    if (!isValid) return false;

    const capturedPiece = getPieceAt(state.board, to);
    const move = createMove(from, to, piece, capturedPiece);
    move.notation = createMoveNotation(move);

    // Cập nhật board
    const newBoard = cloneBoard(state.board);
    setPieceAt(newBoard, to, piece);
    setPieceAt(newBoard, from, null);

    // Lưu lịch sử
    const history: MoveHistory = {
      move,
      boardSnapshot: boardToFEN(state.board),
      timestamp: Date.now()
    };

    // Cập nhật quân bị ăn
    const capturedPieces = { ...state.capturedPieces };
    if (capturedPiece) {
      if (piece.color === PieceColor.RED) {
        capturedPieces.byRed = [...capturedPieces.byRed, capturedPiece];
      } else {
        capturedPieces.byBlack = [...capturedPieces.byBlack, capturedPiece];
      }
    }

    // Đổi lượt
    const nextTurn = state.currentTurn === PieceColor.RED ? PieceColor.BLACK : PieceColor.RED;

    // Kiểm tra kết thúc game
    let status = state.status;
    let checkingColor: PieceColor | undefined;

    if (isCheckmate(newBoard, nextTurn)) {
      // Chiếu bí - người bị chiếu thua
      status = state.currentTurn === PieceColor.RED ? GameStatus.RED_WIN : GameStatus.BLACK_WIN;
    } else if (isStalemate(newBoard, nextTurn)) {
      // Cờ tướng: Không có nước đi = thua (困毙)
      // Người không đi được thua
      status = nextTurn === PieceColor.RED ? GameStatus.BLACK_WIN : GameStatus.RED_WIN;
    } else if (isInCheck(newBoard, nextTurn)) {
      move.isCheck = true;
      checkingColor = state.currentTurn;
    }

    this.updateState({
      board: newBoard,
      currentTurn: nextTurn,
      status,
      moveHistory: [...state.moveHistory, history],
      capturedPieces,
      isCheck: isInCheck(newBoard, nextTurn),
      checkingColor,
      selectedPosition: null,
      possibleMoves: [],
      lastMove: { from, to }
    });

    // AI đi sau
    if (status === GameStatus.PLAYING && nextTurn !== state.config.playerColor) {
      setTimeout(() => this.makeAIMove(), 300);
    }

    return true;
  }

  /**
   * AI thực hiện nước đi
   */
  async makeAIMove(): Promise<void> {
    const state = this.state;
    if (state.status !== GameStatus.PLAYING) return;
    if (state.currentTurn === state.config.playerColor) return;

    // Set thinking state
    this.isAIThinkingSubject.next(true);

    // Add delay to show thinking state
    await new Promise(resolve => setTimeout(resolve, 100));

    const algorithm = getAlgorithm('minimax', {
      maxDepth: state.config.aiDifficulty,
      useQuiescence: true
    });

    if (!algorithm) {
      this.isAIThinkingSubject.next(false);
      return;
    }

    const result = algorithm.findBestMove(
      state.board,
      state.currentTurn,
      state.config.aiDifficulty
    );

    // Clear thinking state
    this.isAIThinkingSubject.next(false);

    // Handle both return types (Move | SearchResult)
    let bestMove: Move | null = null;
    if (result && typeof result === 'object' && 'bestMove' in result) {
      bestMove = (result as { bestMove: Move | null }).bestMove;
    } else {
      bestMove = result as Move | null;
    }

    if (bestMove) {
      this.makeMove(bestMove.from, bestMove.to);
    }
  }

  /**
   * Lấy gợi ý nước đi
   */
  getHint(): Move | null {
    const state = this.state;
    const algorithm = getAlgorithm('minimax', { maxDepth: 3 });
    if (!algorithm) return null;
    
    const result = algorithm.getHint?.(state.board, state.currentTurn);
    if (!result) return null;
    
    // Handle both return types
    if (typeof result === 'object' && 'bestMove' in result) {
      return (result as { bestMove: Move | null }).bestMove;
    }
    return result as Move | null;
  }

  /**
   * Hoàn tác nước đi
   */
  undoMove(): void {
    const state = this.state;
    if (state.moveHistory.length < 2) return; // Cần undo 2 nước (player + AI)

    const newHistory = [...state.moveHistory];
    newHistory.pop(); // AI move
    newHistory.pop(); // Player move

    // Khôi phục từ lịch sử - để đơn giản, reset game
    this.newGame(state.config);
    // Replay các nước đi từ đầu
    // (Trong thực tế, có thể lưu board snapshot và restore)
  }

  /**
   * Cập nhật cấu hình game
   */
  updateConfig(config: Partial<GameConfig>): void {
    this.updateState({
      config: { ...this.state.config, ...config }
    });
  }

  private updateState(partial: Partial<GameState>): void {
    this.gameStateSubject.next({
      ...this.state,
      ...partial
    });
  }
}
