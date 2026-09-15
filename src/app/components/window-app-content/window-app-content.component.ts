import {
  Component,
  ComponentRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  Output,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
  signal,
} from '@angular/core';
import {
  ContextMenuEvent,
  ExplorerComponent,
  FileOpenEvent,
} from '../apps/explorer/explorer.component';
import { SettingsData } from '../apps/settings-app/settings-app.component';
import { APP_WINDOW_LOADERS } from '../../config/app-window-loaders';

@Component({
  selector: 'app-window-app-content',
  standalone: true,
  template: `
    @if (loading()) {
      <div class="window-app-loading" role="status">Loading…</div>
    }
    <ng-container #host />
  `,
  styles: [
    `
      .window-app-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 120px;
        color: var(--text-secondary, #666);
        font-size: 13px;
      }
    `,
  ],
})
export class WindowAppContentComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) componentId!: string;
  @Input() windowData?: Record<string, unknown>;

  @Output() explorerFileOpen = new EventEmitter<FileOpenEvent>();
  @Output() explorerContextMenuAction = new EventEmitter<ContextMenuEvent>();
  @Output() settingsChange = new EventEmitter<SettingsData>();

  loading = signal(false);

  @ViewChild('host', { read: ViewContainerRef }) private host?: ViewContainerRef;
  private componentRef?: ComponentRef<unknown>;
  private loadToken = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['componentId'] || changes['windowData']) {
      queueMicrotask(() => void this.loadComponent());
    }
  }

  ngAfterViewInit(): void {
    void this.loadComponent();
  }

  ngOnDestroy(): void {
    this.clearHost();
  }

  private clearHost(): void {
    this.componentRef?.destroy();
    this.componentRef = undefined;
    this.host?.clear();
  }

  private async loadComponent(): Promise<void> {
    const token = ++this.loadToken;
    const loader = APP_WINDOW_LOADERS[this.componentId];
    this.clearHost();

    if (!loader) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      const componentType = await loader();
      if (token !== this.loadToken || !this.host) {
        return;
      }

      this.componentRef = this.host.createComponent(componentType);
      this.applyInputsAndOutputs(this.componentRef);
      this.loading.set(false);
    } catch {
      if (token === this.loadToken) {
        this.loading.set(false);
      }
    }
  }

  private applyInputsAndOutputs(ref: ComponentRef<unknown>): void {
    const data = this.windowData ?? {};

    switch (this.componentId) {
      case 'my-info':
        ref.setInput('url', 'https://hpphat1992.vercel.app');
        break;
      case 'text-viewer':
        ref.setInput('filePath', data['path']);
        ref.setInput('fileName', data['name']);
        ref.setInput('fileType', data['type']);
        break;
      case 'image-viewer':
        ref.setInput('imagePath', data['path']);
        ref.setInput('imageName', data['name']);
        break;
      case 'pdf-viewer':
        ref.setInput('pdfPath', data['path']);
        break;
      case 'explorer': {
        const explorer = ref.instance as ExplorerComponent;
        explorer.onFileOpen.subscribe((event) => this.explorerFileOpen.emit(event));
        explorer.onContextMenuAction.subscribe((event) =>
          this.explorerContextMenuAction.emit(event)
        );
        break;
      }
      case 'settings': {
        const settings = ref.instance as { onSettingsChange: EventEmitter<SettingsData> };
        settings.onSettingsChange.subscribe((event) => this.settingsChange.emit(event));
        break;
      }
      default:
        break;
    }
  }
}
