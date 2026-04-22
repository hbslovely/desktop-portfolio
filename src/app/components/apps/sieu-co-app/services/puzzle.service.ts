import { Injectable } from '@angular/core';
import { Board, createEmptyBoard, setPieceAt, createPiece } from '../models/board.model';
import { PieceType, PieceColor } from '../models/piece.model';
import { PuzzleInfo } from '../models/game-state.model';

/**
 * Cờ thế (Puzzle) - Các bài toán cờ cổ điển
 */
export interface Puzzle {
  info: PuzzleInfo;
  setup: PuzzleSetup[];
  solutionMoves: string[]; // Format: "row1,col1-row2,col2"
  firstMove: PieceColor;
}

export interface PuzzleSetup {
  row: number;
  col: number;
  type: PieceType;
  color: PieceColor;
}

@Injectable()
export class PuzzleService {
  private puzzles: Puzzle[] = [
    // Cờ thế #1: Đối diện cười (Tướng đối mặt)
    {
      info: {
        id: 1,
        name: 'Đối Diện Tiếu',
        description: 'Đỏ đi trước, chiếu bí trong 3 nước',
        difficulty: 1
      },
      setup: [
        { row: 0, col: 4, type: PieceType.KING, color: PieceColor.BLACK },
        { row: 9, col: 4, type: PieceType.KING, color: PieceColor.RED },
        { row: 1, col: 4, type: PieceType.ROOK, color: PieceColor.RED }
      ],
      solutionMoves: ['1,4-0,4'],
      firstMove: PieceColor.RED
    },
    // Cờ thế #2: Song mã ẩm tuyền
    {
      info: {
        id: 2,
        name: 'Song Mã Ẩm Tuyền',
        description: 'Đỏ đi trước, chiếu bí bằng đôi Mã',
        difficulty: 2
      },
      setup: [
        { row: 0, col: 4, type: PieceType.KING, color: PieceColor.BLACK },
        { row: 9, col: 4, type: PieceType.KING, color: PieceColor.RED },
        { row: 2, col: 3, type: PieceType.HORSE, color: PieceColor.RED },
        { row: 2, col: 5, type: PieceType.HORSE, color: PieceColor.RED },
        { row: 1, col: 3, type: PieceType.ADVISOR, color: PieceColor.BLACK },
        { row: 1, col: 5, type: PieceType.ADVISOR, color: PieceColor.BLACK }
      ],
      solutionMoves: ['2,3-0,2', '0,4-1,4', '2,5-0,6'],
      firstMove: PieceColor.RED
    },
    // Cờ thế #3: Xa pháo lập công
    {
      info: {
        id: 3,
        name: 'Xa Pháo Lập Công',
        description: 'Kết hợp Xe và Pháo chiếu bí đối phương',
        difficulty: 2
      },
      setup: [
        { row: 0, col: 4, type: PieceType.KING, color: PieceColor.BLACK },
        { row: 0, col: 3, type: PieceType.ADVISOR, color: PieceColor.BLACK },
        { row: 0, col: 5, type: PieceType.ADVISOR, color: PieceColor.BLACK },
        { row: 9, col: 4, type: PieceType.KING, color: PieceColor.RED },
        { row: 1, col: 4, type: PieceType.ROOK, color: PieceColor.RED },
        { row: 3, col: 4, type: PieceType.CANNON, color: PieceColor.RED }
      ],
      solutionMoves: ['3,4-1,4'],
      firstMove: PieceColor.RED
    },
    // Cờ thế #4: Thất tinh tụ hội
    {
      info: {
        id: 4,
        name: 'Thất Tinh Tụ Hội',
        description: 'Bài cờ cổ điển nổi tiếng, Đỏ chiến thắng',
        difficulty: 3
      },
      setup: [
        { row: 0, col: 4, type: PieceType.KING, color: PieceColor.BLACK },
        { row: 1, col: 4, type: PieceType.ADVISOR, color: PieceColor.BLACK },
        { row: 2, col: 4, type: PieceType.ADVISOR, color: PieceColor.BLACK },
        { row: 0, col: 2, type: PieceType.ELEPHANT, color: PieceColor.BLACK },
        { row: 2, col: 2, type: PieceType.ELEPHANT, color: PieceColor.BLACK },
        { row: 9, col: 4, type: PieceType.KING, color: PieceColor.RED },
        { row: 5, col: 4, type: PieceType.ROOK, color: PieceColor.RED },
        { row: 3, col: 1, type: PieceType.CANNON, color: PieceColor.RED },
        { row: 3, col: 7, type: PieceType.CANNON, color: PieceColor.RED }
      ],
      solutionMoves: ['5,4-1,4', '2,4-1,5', '3,1-1,1', '0,4-1,5', '1,4-1,5'],
      firstMove: PieceColor.RED
    },
    // Cờ thế #5: Dã mã thao điền
    {
      info: {
        id: 5,
        name: 'Dã Mã Thao Điền',
        description: 'Mã phối hợp với các quân khác chiếu bí',
        difficulty: 3
      },
      setup: [
        { row: 1, col: 4, type: PieceType.KING, color: PieceColor.BLACK },
        { row: 0, col: 3, type: PieceType.ADVISOR, color: PieceColor.BLACK },
        { row: 2, col: 5, type: PieceType.ADVISOR, color: PieceColor.BLACK },
        { row: 9, col: 4, type: PieceType.KING, color: PieceColor.RED },
        { row: 3, col: 3, type: PieceType.HORSE, color: PieceColor.RED },
        { row: 4, col: 4, type: PieceType.ROOK, color: PieceColor.RED }
      ],
      solutionMoves: ['3,3-1,2', '1,4-2,4', '4,4-2,4'],
      firstMove: PieceColor.RED
    }
  ];

  /**
   * Lấy danh sách puzzle
   */
  getPuzzleList(): PuzzleInfo[] {
    return this.puzzles.map(p => p.info);
  }

  /**
   * Lấy puzzle theo ID
   */
  getPuzzle(id: number): Puzzle | null {
    return this.puzzles.find(p => p.info.id === id) || null;
  }

  /**
   * Tạo bàn cờ từ puzzle setup
   */
  createPuzzleBoard(puzzle: Puzzle): Board {
    const board = createEmptyBoard();
    for (const setup of puzzle.setup) {
      setPieceAt(
        board,
        { row: setup.row, col: setup.col },
        createPiece(setup.type, setup.color)
      );
    }
    return board;
  }

  /**
   * Kiểm tra nước đi có đúng theo giải pháp không
   */
  validateMove(puzzleId: number, moveIndex: number, moveStr: string): boolean {
    const puzzle = this.getPuzzle(puzzleId);
    if (!puzzle || moveIndex >= puzzle.solutionMoves.length) return false;
    return puzzle.solutionMoves[moveIndex] === moveStr;
  }

  /**
   * Lấy gợi ý cho puzzle
   */
  getHint(puzzleId: number, moveIndex: number): string | null {
    const puzzle = this.getPuzzle(puzzleId);
    if (!puzzle || moveIndex >= puzzle.solutionMoves.length) return null;
    return puzzle.solutionMoves[moveIndex];
  }
}
