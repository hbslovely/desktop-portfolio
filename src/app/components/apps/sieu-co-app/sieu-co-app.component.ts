import { Component, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GameService, PuzzleService, AudioService } from './services';
import { GameState, GameStatus, GameMode, AIDifficulty, BOARD_THEMES, BoardTheme } from './models/game-state.model';
import { PieceColor, PieceType, PIECE_CHARS, Piece, PieceState } from './models/piece.model';
import { Board, BOARD_ROWS, BOARD_COLS, getPieceAt, Position } from './models/board.model';
import { Move } from './models/move.model';
import { getAvailableAlgorithms } from './algorithms';
import { PuzzleInfo } from './models';

// Pre-computed board indices
const BOARD_ROWS_ARRAY = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const BOARD_COLS_ARRAY = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// Hidden chess board indices (4 rows x 8 cols)
const HIDDEN_ROWS_ARRAY = [0, 1, 2, 3];
const HIDDEN_COLS_ARRAY = [0, 1, 2, 3, 4, 5, 6, 7];
const DIFFICULTY_LEVELS = [AIDifficulty.BEGINNER, AIDifficulty.AMATEUR, AIDifficulty.EXPERT, AIDifficulty.MASTER];
const STAR_RATINGS = [1, 2, 3, 4, 5];

// Difficulty name mapping
const DIFFICULTY_NAMES: Record<AIDifficulty, string> = {
  [AIDifficulty.BEGINNER]: 'Tập sự',
  [AIDifficulty.AMATEUR]: 'Nghiệp dư',
  [AIDifficulty.EXPERT]: 'Kỳ thủ',
  [AIDifficulty.MASTER]: 'Đại sư'
};

@Component({
  selector: 'app-sieu-co-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sieu-co-app.component.html',
  styleUrls: ['./sieu-co-app.component.scss'],
  providers: [GameService, PuzzleService, AudioService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SieuCoAppComponent implements OnInit, OnDestroy {
  // ============ Signals ============
  gameState = signal<GameState | null>(null);
  currentTab = signal<'game' | 'settings' | 'puzzles' | 'notation'>('game');
  showNewGameDialog = signal(false);
  isAIThinking = signal(false);

  // Settings signals
  selectedMode = signal<GameMode>(GameMode.XIANGQI);
  selectedDifficulty = signal<AIDifficulty>(AIDifficulty.EXPERT);
  selectedTheme = signal<BoardTheme>(BOARD_THEMES[0]);
  selectedPlayerColor = signal<PieceColor>(PieceColor.RED);
  soundEnabled = signal(true);

  // ============ Computed Signals ============

  // Status text computed
  statusText = computed(() => {
    const state = this.gameState();
    if (!state) return '';

    switch (state.status) {
      case GameStatus.NOT_STARTED:
        return 'Chọn "Ván mới" để bắt đầu';
      case GameStatus.PLAYING:
        const turn = state.currentTurn === PieceColor.RED ? 'Đỏ' : 'Đen';
        const check = state.isCheck ? ' - CHIẾU!' : '';
        return `Lượt: ${turn}${check}`;
      case GameStatus.RED_WIN:
        return '🏆 ĐỎ THẮNG!';
      case GameStatus.BLACK_WIN:
        return '🏆 ĐEN THẮNG!';
      case GameStatus.DRAW:
        return '🤝 HÒA CỜ';
      default:
        return '';
    }
  });

  // Board pieces computed - returns a 2D array of pieces
  boardPieces = computed(() => {
    const state = this.gameState();
    if (!state) return this.createEmptyPiecesArray();

    const pieces: (Piece | null)[][] = [];
    for (let row = 0; row < BOARD_ROWS; row++) {
      pieces[row] = [];
      for (let col = 0; col < BOARD_COLS; col++) {
        pieces[row][col] = getPieceAt(state.board, { row, col });
      }
    }
    return pieces;
  });

  // Selected position computed
  selectedPosition = computed(() => this.gameState()?.selectedPosition ?? null);

  // Possible moves as a Set for O(1) lookup
  possibleMovesSet = computed(() => {
    const state = this.gameState();
    if (!state) return new Set<string>();
    return new Set(state.possibleMoves.map(m => `${m.row},${m.col}`));
  });

  // Last move positions
  lastMovePositions = computed(() => {
    const state = this.gameState();
    if (!state?.lastMove) return new Set<string>();
    const lm = state.lastMove;
    return new Set([`${lm.from.row},${lm.from.col}`, `${lm.to.row},${lm.to.col}`]);
  });

  // Pre-computed cell states for each cell (2D array of cell info)
  cellStates = computed(() => {
    const state = this.gameState();
    const possibleMoves = this.possibleMovesSet();
    const selected = this.selectedPosition();
    const lastMove = state?.lastMove;

    const cells: Array<Array<{
      isSelected: boolean;
      isPossibleMove: boolean;
      isLastMoveFrom: boolean;
      isLastMoveTo: boolean;
    }>> = [];

    for (let row = 0; row < BOARD_ROWS; row++) {
      cells[row] = [];
      for (let col = 0; col < BOARD_COLS; col++) {
        const key = `${row},${col}`;
        cells[row][col] = {
          isSelected: selected !== null && selected.row === row && selected.col === col,
          isPossibleMove: possibleMoves.has(key),
          isLastMoveFrom: lastMove ? (lastMove.from.row === row && lastMove.from.col === col) : false,
          isLastMoveTo: lastMove ? (lastMove.to.row === row && lastMove.to.col === col) : false
        };
      }
    }
    return cells;
  });

  // Check if game not started
  isNotStarted = computed(() => {
    const state = this.gameState();
    return !state || state.status === GameStatus.NOT_STARTED;
  });

  // Move history
  moveHistory = computed(() => this.gameState()?.moveHistory ?? []);

  // Move numbers for notation tab
  moveNumbers = computed(() => {
    const history = this.moveHistory();
    if (!history.length) return [];
    const numPairs = Math.ceil(history.length / 2);
    return Array.from({ length: numPairs }, (_, i) => i);
  });

  // Move notations pre-computed
  moveNotations = computed(() => {
    const history = this.moveHistory();
    return history.map(h => h.move.notation || '');
  });

  // Captured pieces
  capturedByRed = computed(() => this.gameState()?.capturedPieces?.byRed ?? []);
  capturedByBlack = computed(() => this.gameState()?.capturedPieces?.byBlack ?? []);

  // Game status checks
  isCheck = computed(() => this.gameState()?.isCheck ?? false);
  isGameOver = computed(() => {
    const status = this.gameState()?.status;
    return status !== GameStatus.PLAYING && status !== GameStatus.NOT_STARTED;
  });
  isPlaying = computed(() => this.gameState()?.status === GameStatus.PLAYING);
  hasHistory = computed(() => (this.moveHistory()?.length ?? 0) > 0);

  // ============ Static Data ============
  readonly availableAlgorithms = getAvailableAlgorithms();
  readonly themes = BOARD_THEMES;
  readonly puzzles = signal<PuzzleInfo[]>([]);

  // Constants for template
  readonly boardRows = BOARD_ROWS_ARRAY;
  readonly boardCols = BOARD_COLS_ARRAY;
  readonly hiddenRows = HIDDEN_ROWS_ARRAY;
  readonly hiddenCols = HIDDEN_COLS_ARRAY;
  readonly difficultyLevels = DIFFICULTY_LEVELS;
  readonly difficultyNames = DIFFICULTY_NAMES;
  readonly starRatings = STAR_RATINGS;
  readonly GameMode = GameMode;
  readonly GameStatus = GameStatus;
  readonly PieceColor = PieceColor;
  readonly PieceState = PieceState;
  readonly AIDifficulty = AIDifficulty;

  private destroy$ = new Subject<void>();

  constructor(
    private gameService: GameService,
    private puzzleService: PuzzleService,
    private audioService: AudioService
  ) {}

  ngOnInit(): void {
    // Subscribe to game state
    this.gameService.gameState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.gameState.set(state);
        this.selectedTheme.set(state.config.theme);
      });

    // Subscribe to AI thinking state
    this.gameService.isAIThinking$
      .pipe(takeUntil(this.destroy$))
      .subscribe(thinking => {
        this.isAIThinking.set(thinking);
      });

    // Load puzzles
    this.puzzles.set(this.puzzleService.getPuzzleList());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ Helper Methods (Pure, no side effects) ============

  private createEmptyPiecesArray(): (Piece | null)[][] {
    return Array.from({ length: BOARD_ROWS }, () =>
      Array.from({ length: BOARD_COLS }, () => null)
    );
  }

  /**
   * Get piece character for display
   */
  getPieceChar(piece: Piece): string {
    // Hidden piece shows "?"
    if (piece.state === PieceState.HIDDEN) {
      return '?';
    }
    const chars = PIECE_CHARS[piece.type];
    return piece.color === PieceColor.RED ? chars.red : chars.black;
  }

  /**
   * Check if current game is hidden chess
   */
  isHiddenChessMode = computed(() => {
    return this.gameState()?.config.mode === GameMode.HIDDEN;
  });


  // ============ Game Actions ============

  startNewGame(): void {
    this.gameService.newGame({
      mode: this.selectedMode(),
      playerColor: this.selectedPlayerColor(),
      aiDifficulty: this.selectedDifficulty(),
      theme: this.selectedTheme(),
      soundEnabled: this.soundEnabled()
    });
    this.showNewGameDialog.set(false);
    this.currentTab.set('game');
    this.audioService.setEnabled(this.soundEnabled());
  }

  onCellClick(row: number, col: number): void {
    const state = this.gameState();
    if (!state) return;

    const prevSelected = state.selectedPosition;
    this.gameService.selectCell(row, col);

    // Play sound after state update
    const newState = this.gameState();
    if (newState && newState.selectedPosition !== prevSelected) {
      if (newState.lastMove?.to.row === row && newState.lastMove?.to.col === col) {
        if (newState.moveHistory.length > 0) {
          const lastMove = newState.moveHistory[newState.moveHistory.length - 1].move;
          if (lastMove.capturedPiece) {
            this.audioService.playCapture();
          } else {
            this.audioService.playMove();
          }
          if (newState.isCheck) {
            this.audioService.playCheck();
          }
        }
      }
    }

    // Check game over
    if (newState && newState.status !== GameStatus.PLAYING && newState.status !== GameStatus.NOT_STARTED) {
      this.audioService.playCheckmate();
    }
  }

  onGetHint(): void {
    const hint = this.gameService.getHint();
    if (hint) {
      console.log('Gợi ý:', hint.from, '->', hint.to);
    }
  }

  onUndoMove(): void {
    this.gameService.undoMove();
  }

  // ============ Puzzle ============

  onStartPuzzle(puzzleId: number): void {
    const puzzle = this.puzzleService.getPuzzle(puzzleId);
    if (!puzzle) return;

    const board = this.puzzleService.createPuzzleBoard(puzzle);
    // TODO: Implement puzzle mode in game service
    this.currentTab.set('game');
  }

  // ============ Settings Actions ============

  onToggleSound(): void {
    const newValue = !this.soundEnabled();
    this.soundEnabled.set(newValue);
    this.audioService.setEnabled(newValue);
    this.gameService.updateConfig({ soundEnabled: newValue });
  }

  onSetTheme(theme: BoardTheme): void {
    this.selectedTheme.set(theme);
    this.gameService.updateConfig({ theme });
  }

  onSetMode(mode: GameMode): void {
    this.selectedMode.set(mode);
  }

  onSetPlayerColor(color: PieceColor): void {
    this.selectedPlayerColor.set(color);
  }

  onSetDifficulty(diff: AIDifficulty): void {
    this.selectedDifficulty.set(diff);
  }

  onSetTab(tab: 'game' | 'settings' | 'puzzles' | 'notation'): void {
    this.currentTab.set(tab);
  }

  onOpenNewGameDialog(): void {
    this.showNewGameDialog.set(true);
  }

  onCloseNewGameDialog(): void {
    this.showNewGameDialog.set(false);
  }

  // ============ Track Functions ============
  trackByIndex(index: number): number {
    return index;
  }

  trackByPuzzle(index: number, puzzle: PuzzleInfo): number {
    return puzzle.id;
  }
}
