import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MedicalImagePreviewState {
  src: string;
  title: string;
  explorerId?: number;
}

@Component({
  selector: 'app-medical-history-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './medical-history-preview.component.html',
  styleUrls: ['./medical-history-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalHistoryPreviewComponent {
  preview = input<MedicalImagePreviewState | null>(null);

  closed = output<void>();
  openInDocuments = output<number>();

  private readonly minZoom = 1;
  private readonly maxZoom = 6;
  private readonly zoomStep = 1.4;

  scale = signal(1);
  tx = signal(0);
  ty = signal(0);
  interacting = signal(false);

  transform = computed(
    () => `translate3d(${this.tx()}px, ${this.ty()}px, 0) scale(${this.scale()})`
  );

  zoomPercent = computed(() => Math.round(this.scale() * 100));
  canZoomIn = computed(() => this.scale() < this.maxZoom - 0.001);
  canZoomOut = computed(() => this.scale() > this.minZoom + 0.001);

  private pointers = new Map<number, { x: number; y: number }>();
  private panStart: { x: number; y: number; tx: number; ty: number } | null =
    null;
  private pinchStart: {
    dist: number;
    scale: number;
    tx: number;
    ty: number;
    midX: number;
    midY: number;
    centerX: number;
    centerY: number;
  } | null = null;

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (!this.preview()) return;
    const target = ev.target as HTMLElement | null;
    const tag = target?.tagName;
    const typing =
      tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
    if (typing) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.close();
    } else if (ev.key === '+' || ev.key === '=') {
      ev.preventDefault();
      this.zoomIn();
    } else if (ev.key === '-' || ev.key === '_') {
      ev.preventDefault();
      this.zoomOut();
    } else if (ev.key === '0') {
      ev.preventDefault();
      this.resetZoom();
    }
  }

  close(): void {
    this.resetZoom();
    this.pointers.clear();
    this.panStart = null;
    this.pinchStart = null;
    this.interacting.set(false);
    this.closed.emit();
  }

  onOpenInDocuments(explorerId: number): void {
    this.close();
    this.openInDocuments.emit(explorerId);
  }

  resetZoom(): void {
    this.scale.set(1);
    this.tx.set(0);
    this.ty.set(0);
  }

  zoomIn(ev?: Event): void {
    ev?.stopPropagation();
    this.applyZoom(this.scale() * this.zoomStep);
  }

  zoomOut(ev?: Event): void {
    ev?.stopPropagation();
    this.applyZoom(this.scale() / this.zoomStep);
  }

  onWheel(ev: WheelEvent): void {
    if (!this.preview()) return;
    ev.preventDefault();
    const stage = ev.currentTarget as HTMLElement;
    const rect = stage.getBoundingClientRect();
    const factor = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.applyZoom(this.scale() * factor, {
      x: ev.clientX,
      y: ev.clientY,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    });
  }

  onPointerDown(ev: PointerEvent): void {
    if (!this.preview()) return;
    const stage = ev.currentTarget as HTMLElement;
    try {
      stage.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    this.interacting.set(true);

    if (this.pointers.size >= 2) {
      this.startPinch(stage);
      this.panStart = null;
    } else if (this.scale() > 1.001) {
      this.panStart = {
        x: ev.clientX,
        y: ev.clientY,
        tx: this.tx(),
        ty: this.ty(),
      };
    } else {
      this.panStart = null;
    }
  }

  onPointerMove(ev: PointerEvent): void {
    if (!this.pointers.has(ev.pointerId)) return;
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (this.pointers.size >= 2 && this.pinchStart) {
      this.updatePinch();
      return;
    }

    if (this.panStart && this.pointers.size === 1) {
      const dx = ev.clientX - this.panStart.x;
      const dy = ev.clientY - this.panStart.y;
      this.tx.set(this.panStart.tx + dx);
      this.ty.set(this.panStart.ty + dy);
    }
  }

  onPointerUp(ev: PointerEvent): void {
    this.pointers.delete(ev.pointerId);
    if (this.pointers.size < 2) this.pinchStart = null;
    if (this.pointers.size === 0) {
      this.panStart = null;
      this.interacting.set(false);
    } else if (this.pointers.size === 1 && this.scale() > 1.001) {
      const remaining = Array.from(this.pointers.values())[0];
      this.panStart = {
        x: remaining.x,
        y: remaining.y,
        tx: this.tx(),
        ty: this.ty(),
      };
    }
  }

  onDblClick(ev: MouseEvent): void {
    if (!this.preview()) return;
    const stage = ev.currentTarget as HTMLElement;
    const rect = stage.getBoundingClientRect();
    const target = this.scale() > 1.01 ? 1 : 2.5;
    this.applyZoom(target, {
      x: ev.clientX,
      y: ev.clientY,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    });
    ev.preventDefault();
  }

  private applyZoom(
    targetScale: number,
    anchor?: { x: number; y: number; centerX: number; centerY: number }
  ): void {
    const oldScale = this.scale();
    const clamped = Math.min(this.maxZoom, Math.max(this.minZoom, targetScale));
    if (Math.abs(clamped - oldScale) < 0.001) return;

    if (clamped <= this.minZoom + 0.001) {
      this.resetZoom();
      return;
    }

    const ratio = clamped / oldScale;
    const tx = this.tx();
    const ty = this.ty();
    if (anchor) {
      const kx = anchor.x - anchor.centerX;
      const ky = anchor.y - anchor.centerY;
      this.tx.set(kx * (1 - ratio) + tx * ratio);
      this.ty.set(ky * (1 - ratio) + ty * ratio);
    } else {
      this.tx.set(tx * ratio);
      this.ty.set(ty * ratio);
    }
    this.scale.set(clamped);
  }

  private startPinch(stage: HTMLElement): void {
    const pts = Array.from(this.pointers.values());
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const rect = stage.getBoundingClientRect();
    this.pinchStart = {
      dist: dist || 1,
      scale: this.scale(),
      tx: this.tx(),
      ty: this.ty(),
      midX,
      midY,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };
  }

  private updatePinch(): void {
    const start = this.pinchStart;
    if (!start) return;
    const pts = Array.from(this.pointers.values());
    if (pts.length < 2) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ratio = dist / start.dist;
    const target = Math.min(
      this.maxZoom,
      Math.max(this.minZoom, start.scale * ratio)
    );
    const r = target / start.scale;
    const kx = start.midX - start.centerX;
    const ky = start.midY - start.centerY;
    this.scale.set(target);
    this.tx.set(kx * (1 - r) + start.tx * r);
    this.ty.set(ky * (1 - r) + start.ty * r);
  }
}
