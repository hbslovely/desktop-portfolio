import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of, Subject, BehaviorSubject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { 
  StockPrediction, 
  TrainingProgress, 
  TrainingConfig, 
  ModelStatus,
  DEFAULT_TRAINING_CONFIG,
  NeuralNetworkService
} from './neural-network.service';

export interface WorkerTrainingProgress extends TrainingProgress {
  totalEpochs: number;
}

@Injectable({
  providedIn: 'root'
})
export class NeuralNetworkWorkerService {
  private worker: Worker | null = null;
  private isModelReady = false;
  private isTraining = false;
  private currentTrainingConfig: TrainingConfig = { ...DEFAULT_TRAINING_CONFIG };
  private lastTrainingLoss: number | null = null;
  private lastTrainingAccuracy: number | null = null;
  private lastTrainingEpochs: number = 0;
  private useWorker = false; // Flag to track if worker is available

  // Fallback service for when worker is not available
  private fallbackService: NeuralNetworkService;

  // Observables for async communication
  private trainingProgress$ = new BehaviorSubject<WorkerTrainingProgress | null>(null);
  private predictionResult$ = new Subject<StockPrediction>();
  private error$ = new Subject<string>();

  constructor(private http: HttpClient) {
    // Create fallback service instance
    this.fallbackService = new NeuralNetworkService(http);
    this.initWorker();
  }

  /**
   * Initialize web worker
   */
  private initWorker(): void {
    if (typeof Worker !== 'undefined') {
      try {
        // Use the correct path with .ts extension for Angular to bundle the worker
        this.worker = new Worker(new URL('../workers/neural-network.worker.ts', import.meta.url), { type: 'module' });
        
        this.worker.onmessage = ({ data }) => {
          this.handleWorkerMessage(data);
        };

        this.worker.onerror = (error) => {
          console.error('Worker error:', error);
          this.error$.next(error.message);
          // Fallback to main thread on worker error
          this.useWorker = false;
        };

        this.useWorker = true;
        console.log('✅ Neural Network Worker initialized');
      } catch (error) {
        console.warn('⚠️ Web Worker not available, using main thread fallback:', error);
        this.worker = null;
        this.useWorker = false;
      }
    } else {
      console.warn('⚠️ Web Workers not supported, using main thread fallback');
      this.useWorker = false;
    }
  }

  /**
   * Handle messages from worker
   */
  private handleWorkerMessage(data: any): void {
    switch (data.type) {
      case 'progress':
        this.trainingProgress$.next({
          epoch: data.epoch,
          totalEpochs: data.totalEpochs,
          loss: data.loss,
          accuracy: data.accuracy
        });
        this.lastTrainingLoss = data.loss;
        this.lastTrainingAccuracy = data.accuracy;
        this.lastTrainingEpochs = data.epoch;
        break;

      case 'trained':
        this.isTraining = false;
        this.isModelReady = true;
        this.lastTrainingLoss = data.loss;
        this.lastTrainingAccuracy = data.accuracy;
        this.lastTrainingEpochs = data.epochs;
        console.log('✅ Model trained via worker');
        break;

      case 'prediction':
        this.predictionResult$.next(data.result);
        break;

      case 'weightsLoaded':
        this.isModelReady = data.success;
        console.log('✅ Weights loaded via worker');
        break;

      case 'weights':
        // Handle weights export (for saving)
        break;

      case 'disposed':
        this.isModelReady = false;
        break;

      case 'error':
        this.error$.next(data.error);
        this.isTraining = false;
        break;
    }
  }

  /**
   * Get current training configuration
   */
  getTrainingConfig(): TrainingConfig {
    return { ...this.currentTrainingConfig };
  }

  /**
   * Set training configuration
   */
  setTrainingConfig(config: Partial<TrainingConfig>): void {
    this.currentTrainingConfig = { ...this.currentTrainingConfig, ...config };
  }

  /**
   * Check if model exists in database
   */
  checkModelExists(symbol: string): Observable<ModelStatus> {
    return this.http.get<any>(`/api/stocks-v2/neural-network/${symbol.toUpperCase()}?action=check`).pipe(
      map(response => ({
        exists: response.exists || false,
        hasWeights: response.hasWeights || false,
        hasSimulation: response.hasSimulation || false
      })),
      catchError(error => {
        console.error('Error checking model exists:', error);
        return of({ exists: false, hasWeights: false, hasSimulation: false });
      })
    );
  }

  /**
   * Train the model using web worker or fallback to main thread
   */
  async trainModel(
    prices: number[],
    config: Partial<TrainingConfig> = {},
    onProgress?: (progress: TrainingProgress) => void
  ): Promise<void> {
    // Use fallback service if worker is not available
    if (!this.useWorker || !this.worker) {
      console.log('📱 Training on main thread (fallback mode)');
      this.fallbackService.setTrainingConfig({ ...this.currentTrainingConfig, ...config });
      await this.fallbackService.trainModel(prices, config, onProgress);
      this.isModelReady = true;
      this.isTraining = false;
      return;
    }

    if (this.isTraining) {
      throw new Error('Model is already training');
    }

    const trainingConfig = { ...this.currentTrainingConfig, ...config };
    this.currentTrainingConfig = trainingConfig;
    this.isTraining = true;
    this.isModelReady = false;

    return new Promise((resolve, reject) => {
      // Subscribe to progress updates
      const progressSub = this.trainingProgress$.subscribe(progress => {
        if (progress && onProgress) {
          onProgress(progress);
        }
      });

      // Subscribe to errors
      const errorSub = this.error$.subscribe(error => {
        progressSub.unsubscribe();
        errorSub.unsubscribe();
        this.isTraining = false;
        reject(new Error(error));
      });

      // Listen for completion
      const messageHandler = ({ data }: MessageEvent) => {
        if (data.type === 'trained') {
          this.worker?.removeEventListener('message', messageHandler);
          progressSub.unsubscribe();
          errorSub.unsubscribe();
          resolve();
        }
      };
      this.worker?.addEventListener('message', messageHandler);

      // Send training message to worker
      this.worker?.postMessage({
        type: 'train',
        prices,
        config: {
          epochs: trainingConfig.epochs,
          batchSize: trainingConfig.batchSize,
          validationSplit: trainingConfig.validationSplit,
          lookbackDays: trainingConfig.lookbackDays,
          forecastDays: trainingConfig.forecastDays,
          learningRate: trainingConfig.learningRate
        }
      });
    });
  }

  /**
   * Predict using web worker or fallback to main thread
   */
  async predict(prices: number[], days: number = 1): Promise<StockPrediction> {
    // Use fallback service if worker is not available
    if (!this.useWorker || !this.worker) {
      return this.fallbackService.predict(prices, days);
    }

    if (!this.isModelReady) {
      throw new Error('Model is not trained yet');
    }

    return new Promise((resolve, reject) => {
      const resultSub = this.predictionResult$.subscribe(result => {
        resultSub.unsubscribe();
        errorSub.unsubscribe();
        resolve(result);
      });

      const errorSub = this.error$.subscribe(error => {
        resultSub.unsubscribe();
        errorSub.unsubscribe();
        reject(new Error(error));
      });

      this.worker?.postMessage({
        type: 'predict',
        prices,
        days
      });
    });
  }

  /**
   * Load weights into worker or fallback service
   */
  async loadWeights(symbol: string): Promise<boolean> {
    // Use fallback service if worker is not available
    if (!this.useWorker || !this.worker) {
      const result = await this.fallbackService.loadWeights(symbol);
      if (result) {
        this.isModelReady = true;
        const savedConfig = this.fallbackService.getTrainingConfig();
        this.currentTrainingConfig = savedConfig;
      }
      return result;
    }

    try {
      const response: any = await this.http.get<any>(`/api/stocks-v2/neural-network/${symbol.toUpperCase()}`).toPromise();
      
      if (!response.success || !response.data) {
        console.log('No saved weights found for', symbol);
        return false;
      }

      const weightsData = response.data.weights;
      if (!weightsData || !Array.isArray(weightsData)) {
        console.log('Invalid weights data format');
        return false;
      }

      const lookbackDays = response.data.lookbackDays || 60;
      const forecastDays = response.data.forecastDays || 1;

      this.currentTrainingConfig = {
        ...this.currentTrainingConfig,
        lookbackDays,
        forecastDays
      };

      return new Promise((resolve) => {
        const messageHandler = ({ data }: MessageEvent) => {
          if (data.type === 'weightsLoaded') {
            this.worker?.removeEventListener('message', messageHandler);
            this.lastTrainingEpochs = response.data.trainingEpochs || 0;
            this.lastTrainingLoss = response.data.loss || null;
            this.lastTrainingAccuracy = response.data.accuracy || null;
            resolve(data.success);
          } else if (data.type === 'error') {
            this.worker?.removeEventListener('message', messageHandler);
            resolve(false);
          }
        };
        this.worker?.addEventListener('message', messageHandler);

        this.worker?.postMessage({
          type: 'loadWeights',
          weightsData,
          config: { lookbackDays, forecastDays }
        });
      });
    } catch (error) {
      console.error('Error loading weights:', error);
      return false;
    }
  }

  /**
   * Save weights to database
   */
  saveWeights(symbol: string): Observable<any> {
    // Use fallback service if worker is not available
    if (!this.useWorker || !this.worker) {
      return this.fallbackService.saveWeights(symbol);
    }
    
    if (!this.isModelReady) {
      return throwError(() => new Error('Model is not trained yet'));
    }

    return new Observable(observer => {
      const messageHandler = ({ data }: MessageEvent) => {
        if (data.type === 'weights') {
          this.worker?.removeEventListener('message', messageHandler);
          
          const inputSize = this.currentTrainingConfig.lookbackDays + 3;

          this.http.post<any>(`/api/stocks-v2/neural-network/${symbol.toUpperCase()}`, {
            weights: data.weights,
            trainingEpochs: this.lastTrainingEpochs,
            loss: this.lastTrainingLoss,
            accuracy: this.lastTrainingAccuracy,
            modelConfig: {
              inputSize: inputSize,
              layers: [
                { units: 128, activation: 'relu' },
                { units: 64, activation: 'relu' },
                { units: 32, activation: 'relu' },
                { units: 3, activation: 'linear' }
              ]
            },
            lookbackDays: this.currentTrainingConfig.lookbackDays,
            forecastDays: this.currentTrainingConfig.forecastDays,
            batchSize: this.currentTrainingConfig.batchSize,
            validationSplit: this.currentTrainingConfig.validationSplit,
          }).pipe(
            catchError(error => {
              console.error('Error saving weights:', error);
              return throwError(() => error);
            })
          ).subscribe({
            next: (response) => {
              observer.next(response);
              observer.complete();
            },
            error: (error) => {
              observer.error(error);
            }
          });
        } else if (data.type === 'error') {
          this.worker?.removeEventListener('message', messageHandler);
          observer.error(new Error(data.error));
        }
      };
      this.worker?.addEventListener('message', messageHandler);

      this.worker?.postMessage({ type: 'getWeights' });
    });
  }

  /**
   * Check if model is ready
   */
  isReady(): boolean {
    // Check fallback service if worker is not available
    if (!this.useWorker || !this.worker) {
      return this.fallbackService.isReady();
    }
    return this.isModelReady && !this.isTraining;
  }

  /**
   * Check if model is training
   */
  isModelTraining(): boolean {
    if (!this.useWorker || !this.worker) {
      return this.fallbackService.isModelTraining();
    }
    return this.isTraining;
  }

  /**
   * Get training progress observable
   */
  getTrainingProgress$(): Observable<WorkerTrainingProgress | null> {
    return this.trainingProgress$.asObservable();
  }

  /**
   * Get training progress
   */
  getTrainingProgress(): TrainingProgress | null {
    if (!this.useWorker || !this.worker) {
      return this.fallbackService.getTrainingProgress();
    }
    return this.trainingProgress$.value;
  }

  /**
   * Get error observable
   */
  getError$(): Observable<string> {
    return this.error$.asObservable();
  }

  /**
   * Dispose model in worker
   */
  disposeModel(): void {
    if (!this.useWorker || !this.worker) {
      this.fallbackService.disposeModel();
      this.isModelReady = false;
      return;
    }
    if (this.worker) {
      this.worker.postMessage({ type: 'dispose' });
      this.isModelReady = false;
    }
  }

  /**
   * Terminate worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isModelReady = false;
    }
  }

  /**
   * Get model summary
   */
  getModelSummary(): string {
    if (!this.useWorker || !this.worker) {
      return this.fallbackService.getModelSummary() + '\n(Fallback mode - main thread)';
    }
    
    let summary = 'Neural Network Model (Worker):\n';
    summary += `Status: ${this.isModelReady ? 'Ready' : 'Not Ready'}\n`;
    summary += `Training: ${this.isTraining ? 'Yes' : 'No'}\n`;
    
    const progress = this.trainingProgress$.value;
    if (progress) {
      summary += `Last Epoch: ${progress.epoch}/${progress.totalEpochs}\n`;
      summary += `Loss: ${progress.loss.toFixed(6)}\n`;
      if (progress.accuracy) {
        summary += `Accuracy: ${(progress.accuracy * 100).toFixed(2)}%\n`;
      }
    }

    return summary;
  }
}

