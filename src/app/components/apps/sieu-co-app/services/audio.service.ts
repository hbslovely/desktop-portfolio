import { Injectable } from '@angular/core';

/**
 * Service quản lý âm thanh trong game
 */
@Injectable()
export class AudioService {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled = true;
  private volume = 0.5;

  constructor() {
    this.initSounds();
  }

  private initSounds(): void {
    // Tạo các âm thanh bằng AudioContext để không cần file
    // Trong thực tế có thể load từ file
  }

  /**
   * Bật/tắt âm thanh
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Điều chỉnh âm lượng (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(sound => {
      sound.volume = this.volume;
    });
  }

  /**
   * Phát âm thanh di chuyển quân
   */
  playMove(): void {
    this.playTone(300, 0.1);
  }

  /**
   * Phát âm thanh ăn quân
   */
  playCapture(): void {
    this.playTone(400, 0.15);
    setTimeout(() => this.playTone(250, 0.1), 100);
  }

  /**
   * Phát âm thanh chiếu tướng
   */
  playCheck(): void {
    this.playTone(500, 0.2);
  }

  /**
   * Phát âm thanh chiếu bí
   */
  playCheckmate(): void {
    const frequencies = [523, 659, 784, 1047];
    frequencies.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3), i * 150);
    });
  }

  /**
   * Phát âm thanh lật quân (cờ úp)
   */
  playFlip(): void {
    this.playTone(350, 0.1);
  }

  /**
   * Phát âm thanh sai
   */
  playError(): void {
    this.playTone(200, 0.2);
  }

  /**
   * Tạo và phát một tone đơn giản
   */
  private playTone(frequency: number, duration: number): void {
    if (!this.enabled) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.value = this.volume * 0.3;
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      // AudioContext not supported
    }
  }
}
