import { Injectable } from '@angular/core';
import { Board } from '../models/board.model';
import { Move } from '../models/move.model';
import { PieceColor } from '../models/piece.model';
import { AIDifficulty, GameState } from '../models/game-state.model';
import { IAIAlgorithm, SearchOptions, SearchResult } from '../interfaces/ai-algorithm.interface';
import { AVAILABLE_ALGORITHMS, getDefaultAlgorithm, createAlgorithm } from '../algorithms';

/**
 * AI Service - Manages AI algorithms and computation
 */
@Injectable({
  providedIn: 'root'
})
export class AIService {
  private currentAlgorithm: IAIAlgorithm;
  private isThinking = false;
  private lastResult: SearchResult | null = null;
  
  constructor() {
    this.currentAlgorithm = getDefaultAlgorithm();
  }
  
  /**
   * Get available algorithms
   */
  getAvailableAlgorithms(): IAIAlgorithm[] {
    return AVAILABLE_ALGORITHMS;
  }
  
  /**
   * Set current algorithm by ID
   */
  setAlgorithm(algorithmId: string): void {
    this.currentAlgorithm = createAlgorithm(algorithmId);
  }
  
  /**
   * Get current algorithm info
   */
  getCurrentAlgorithmInfo() {
    return this.currentAlgorithm.info;
  }
  
  /**
   * Find best move for current position
   */
  async findBestMove(
    board: Board,
    color: PieceColor,
    difficulty: AIDifficulty,
    gameState?: GameState
  ): Promise<Move | null> {
    if (this.isThinking) {
      console.warn('AI is already thinking');
      return null;
    }
    
    this.isThinking = true;
    
    try {
      const options = this.getSearchOptions(difficulty);
      
      // Run in next tick to allow UI update
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = this.currentAlgorithm.findBestMove(board, color, options, gameState);
          this.lastResult = result;
          this.isThinking = false;
          resolve(result.bestMove);
        }, 50);
      });
    } catch (error) {
      console.error('AI error:', error);
      this.isThinking = false;
      return null;
    }
  }
  
  /**
   * Get hint for current position
   */
  async getHint(
    board: Board,
    color: PieceColor,
    difficulty: AIDifficulty = AIDifficulty.EXPERT
  ): Promise<Move | null> {
    if (this.currentAlgorithm.getHint) {
      return this.currentAlgorithm.getHint(board, color);
    }
    
    // Fall back to findBestMove with reduced depth
    const options = this.getSearchOptions(difficulty);
    options.maxDepth = Math.min(options.maxDepth, 3);
    
    const result = this.currentAlgorithm.findBestMove(board, color, options);
    return result.bestMove;
  }
  
  /**
   * Get search options based on difficulty
   */
  private getSearchOptions(difficulty: AIDifficulty): SearchOptions {
    const configs: Record<AIDifficulty, SearchOptions> = {
      [AIDifficulty.BEGINNER]: {
        maxDepth: 2,
        maxTime: 1000,
        useQuiescence: false,
        useOpeningBook: false
      },
      [AIDifficulty.AMATEUR]: {
        maxDepth: 3,
        maxTime: 2000,
        useQuiescence: true,
        useOpeningBook: false
      },
      [AIDifficulty.EXPERT]: {
        maxDepth: 4,
        maxTime: 3000,
        useQuiescence: true,
        useOpeningBook: true
      },
      [AIDifficulty.MASTER]: {
        maxDepth: 5,
        maxTime: 5000,
        useQuiescence: true,
        useOpeningBook: true,
        useTranspositionTable: true
      }
    };
    
    return configs[difficulty] || configs[AIDifficulty.EXPERT];
  }
  
  /**
   * Stop current search
   */
  stopSearch(): void {
    if (this.currentAlgorithm.stop) {
      this.currentAlgorithm.stop();
    }
    this.isThinking = false;
  }
  
  /**
   * Check if AI is currently thinking
   */
  isCurrentlyThinking(): boolean {
    return this.isThinking;
  }
  
  /**
   * Get last search result
   */
  getLastResult(): SearchResult | null {
    return this.lastResult;
  }
  
  /**
   * Evaluate current position
   */
  evaluatePosition(board: Board, color: PieceColor): number {
    if (this.currentAlgorithm.evaluate) {
      return this.currentAlgorithm.evaluate(board, color);
    }
    return 0;
  }
  
  /**
   * Get difficulty name in Vietnamese
   */
  getDifficultyName(difficulty: AIDifficulty): string {
    const names: Record<AIDifficulty, string> = {
      [AIDifficulty.BEGINNER]: 'Tập Sự',
      [AIDifficulty.AMATEUR]: 'Nghiệp Dư',
      [AIDifficulty.EXPERT]: 'Kỳ Thủ',
      [AIDifficulty.MASTER]: 'Đại Sư'
    };
    return names[difficulty] || 'Kỳ Thủ';
  }
  
  /**
   * Get all difficulty levels
   */
  getDifficultyLevels(): { value: AIDifficulty; name: string }[] {
    return [
      { value: AIDifficulty.BEGINNER, name: 'Tập Sự' },
      { value: AIDifficulty.AMATEUR, name: 'Nghiệp Dư' },
      { value: AIDifficulty.EXPERT, name: 'Kỳ Thủ' },
      { value: AIDifficulty.MASTER, name: 'Đại Sư' }
    ];
  }
}
