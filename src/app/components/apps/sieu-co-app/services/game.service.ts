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
import { PieceColor, PieceType } from '../models/piece.model';
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

@Injectable()
export class GameService {
  private gameStateSubject: BehaviorSubject<GameState>;
  public gameState$: Observable<GameState>;

  constructor() {
    const initialState = this.createInitialState();
    this.gameStateSubject = new BehaviorSubject<GameState>(initialState);
    this.gameState$ = this.gameStateSubject.asObservable();
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
    newState.status = GameStatus.PLAYING;
    this.gameStateSubject.next(newState);

    // Nếu AI đi trước
    if (newState.config.playerColor === PieceColor.BLACK) {
      this.makeAIMove();
    }
  }

  /**
   * Chọn ô trên bàn cờ
   */
  selectCell(row: number, col: number): void {
    const state = this.state;

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
      status = state.currentTurn === PieceColor.RED ? GameStatus.RED_WIN : GameStatus.BLACK_WIN;
    } else if (isStalemate(newBoard, nextTurn)) {
      status = GameStatus.DRAW;
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

    const algorithm = getAlgorithm('minimax', {
      maxDepth: state.config.aiDifficulty,
      useQuiescence: true
    });

    if (!algorithm) return;

    const bestMove = algorithm.findBestMove(
      state.board,
      state.currentTurn,
      state.config.aiDifficulty
    );

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
    return algorithm.getHint(state.board, state.currentTurn);
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
