import { Component, signal, ViewChild, ElementRef, AfterViewInit, OnDestroy, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// import * as d3 from 'd3'; // Will enable after npm install d3
import { GraphAlgorithms, GraphNode, GraphEdge, AlgorithmResult } from '../../../utils/graph-algorithms.util';

// Use types from util file
type PathResult = AlgorithmResult;

@Component({
  selector: 'app-graph-visualizer-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './graph-visualizer-app.component.html',
  styleUrl: './graph-visualizer-app.component.scss'
})
export class GraphVisualizerAppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('svg', { static: false }) svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('previewCanvas', { static: false }) previewCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('graphContainer', { static: false }) graphContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('templatePreviewCanvas', { static: false }) templatePreviewCanvasRef!: ElementRef<HTMLCanvasElement>;

  nodes = signal<GraphNode[]>([]);
  edges = signal<GraphEdge[]>([]);
  selectedNode = signal<string | null>(null);
  selectedEdge = signal<string | null>(null);
  selectedNodes = signal<Set<string>>(new Set());
  draggingNode = signal<string | null>(null);
  isSelecting = signal<boolean>(false);
  selectionRect = signal<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  creatingEdge = signal<{ from: string | null; to: string | null }>({ from: null, to: null });
  editingWeight = signal<{ edgeId: string; x: number; y: number } | null>(null);
  mode = signal<'create-node' | 'move' | 'add-edge' | 'select'>('move'); // 'create-node', 'move', 'add-edge', 'select'
  zoomLevel = signal<number>(1);
  panOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Algorithm settings
  selectedAlgorithm = signal<'dijkstra' | 'bellman-ford' | 'floyd-warshall' | 'a-star' | 'graph-coloring' | 'bfs' | 'dfs' | 'cycle-detection' | 'connected-components' | 'scc'>('dijkstra');
  startNode = signal<string | null>(null);
  endNode = signal<string | null>(null);
  pathResult = signal<PathResult | any | null>(null);
  isCalculating = signal<boolean>(false);

  // UI state
  showEdgeConfig = signal<boolean>(false);
  edgeWeight = signal<number>(1);
  edgeDirection = signal<'forward' | 'backward' | 'bidirectional'>('bidirectional');
  nodeCounter = signal<number>(0);
  edgeCounter = signal<number>(0);
  mousePosition = signal<{ x: number; y: number } | null>(null);
  showGraphInputDialog = signal<boolean>(false);
  showGraphTemplatesDialog = signal<boolean>(false);
  showActionMenu = signal<boolean>(false);
  showNodeConfig = signal<boolean>(false);
  nodeLabel = signal<string>('');

  // Graph input form data
  inputNodes = signal<string>('');
  inputEdges = signal<Array<{ from: string; to: string; weight: number; directed: boolean }>>([{ from: '', to: '', weight: 1, directed: false }]);
  previewNodes = signal<GraphNode[]>([]);
  previewEdges = signal<GraphEdge[]>([]);


  // Algorithm visualization
  algorithmSteps = signal<any[]>([]);
  currentStep = signal<number>(0);
  isAnimating = signal<boolean>(false);
  showCalculationPanel = signal<boolean>(false);
  finalResult = signal<PathResult | null>(null);
  highlightedStepNode = signal<string | null>(null);
  highlightedStepEdge = signal<{ from: string; to: string } | null>(null);

  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrame: number | null = null;
  // private d3Simulation: d3.Simulation<d3.SimulationNodeDatum, undefined> | null = null;
  // private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;

  // Dialog states
  showExportDialog = signal<boolean>(false);
  showImportDialog = signal<boolean>(false);
  exportFormat = signal<'json' | 'matrix'>('matrix');
  importData = signal<string>('');
  exportData = signal<string>('');
  exportFileName = signal<string>('graph');
  importMode = signal<'file' | 'text'>('file');
  selectedFileName = signal<string>('');
  selectedFileContent = signal<string>('');
  isDragOver = signal<boolean>(false);
  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;

  // Template configuration
  showTemplateConfigDialog = signal<boolean>(false);
  selectedTemplate = signal<any>(null);
  templateConfig = signal<{
    nodeCount?: number;
    rows?: number;
    cols?: number;
    edgeWeight?: number;
    direction?: 'forward' | 'backward' | 'bidirectional';
    density?: 'sparse' | 'medium' | 'dense' | 'very-dense';
  }>({});
  templateDialogStep = signal<number>(1); // 1: select template, 2: config

  // Pan functionality
  isPanning = signal<boolean>(false);
  panStartPos = signal<{ x: number; y: number } | null>(null);

  // Settings
  showSettingsDialog = signal<boolean>(false);
  nodeNamingMode = signal<'numeric' | 'alphabetic' | 'indexed'>('indexed'); // N0, N1... | A, B, C... | 1, 2, 3...
  
  // Help dialog
  showHelpDialog = signal<boolean>(false);
  dontShowHelpAgain = signal<boolean>(false);
  
  // Visual settings
  nodeColor = signal<string>('#2196F3');
  nodeRadius = signal<number>(25);
  nodeBorderWidth = signal<number>(2);
  nodeBorderColor = signal<string>('#ffffff');
  edgeColor = signal<string>('#666666');
  edgeThickness = signal<number>(1);
  edgeArrowSize = signal<number>(10);
  startNodeColor = signal<string>('#4CAF50');
  endNodeColor = signal<string>('#F44336');
  pathNodeColor = signal<string>('#FFC107');
  pathEdgeColor = signal<string>('#4CAF50');

  constructor() {
    // Watch for dialog open to initialize preview
    effect(() => {
      if (this.showGraphInputDialog()) {
        setTimeout(() => {
          this.updatePreview();
        }, 100);
      }
    });

    // Watch for settings dialog open to initialize preview
    effect(() => {
      if (this.showSettingsDialog()) {
        setTimeout(() => {
          this.drawSettingsPreview();
        }, 100);
      }
    });

    // Watch for settings changes to update preview
    effect(() => {
      // Trigger preview update when any visual setting changes
      if (this.showSettingsDialog()) {
        this.nodeColor();
        this.nodeRadius();
        this.nodeBorderWidth();
        this.nodeBorderColor();
        this.edgeColor();
        this.edgeThickness();
        this.startNodeColor();
        this.endNodeColor();
        this.pathNodeColor();
        this.pathEdgeColor();
        
        setTimeout(() => this.drawSettingsPreview(), 50);
      }
    });

    // Watch for template dialog step changes to update preview
    effect(() => {
      if (this.templateDialogStep() === 2 && this.selectedTemplate()) {
        setTimeout(() => this.drawTemplatePreview(), 200);
      }
    });

    // Watch for template config changes to update preview
    effect(() => {
      if (this.templateDialogStep() === 2 && this.selectedTemplate()) {
        this.templateConfig();
        setTimeout(() => this.drawTemplatePreview(), 50);
      }
    });

    // Check if should show help dialog on first load
    const helpShown = localStorage.getItem('graph-visualizer-help-shown');
    if (!helpShown) {
      setTimeout(() => {
        this.showHelpDialog.set(true);
      }, 500);
    }
  }

  // Hover state for edge creation
  hoveredNode = signal<string | null>(null);

  // Expose for template
  readonly Infinity = Infinity;
  readonly Array = Array;

  // Graph templates - as constant for optimization
  readonly graphTemplates = [
    {
      name: 'Đường thẳng',
      description: 'A → B → C → D',
      icon: 'pi pi-arrow-right',
      template: () => this.createLinearGraph()
    },
    {
      name: 'Vòng tròn',
      description: 'A → B → C → D → A',
      icon: 'pi pi-circle',
      template: () => this.createCycleGraph()
    },
    {
      name: 'Sao',
      description: 'Tất cả nối với 1 đỉnh trung tâm',
      icon: 'pi pi-star',
      template: () => this.createStarGraph()
    },
    {
      name: 'Đồ thị đầy đủ',
      description: 'Tất cả đỉnh nối với nhau',
      icon: 'pi pi-th-large',
      template: () => this.createCompleteGraph()
    },
    {
      name: 'Lưới 2x2',
      description: 'Lưới 2 hàng x 2 cột',
      icon: 'pi pi-table',
      template: () => this.createGridGraph(2, 2)
    },
    {
      name: 'Lưới 3x3',
      description: 'Lưới 3 hàng x 3 cột',
      icon: 'pi pi-table',
      template: () => this.createGridGraph(3, 3)
    },
    {
      name: 'Lưới 4x4',
      description: 'Lưới 4 hàng x 4 cột',
      icon: 'pi pi-table',
      template: () => this.createGridGraph(4, 4)
    },
    {
      name: 'Cây nhị phân',
      description: 'Cây nhị phân hoàn chỉnh',
      icon: 'pi pi-sitemap',
      template: () => this.createBinaryTree()
    },
    {
      name: 'Đồ thị hai phía',
      description: 'Bipartite graph',
      icon: 'pi pi-objects-column',
      template: () => this.createBipartiteGraph()
    },
    {
      name: 'Đồ thị hình thang',
      description: 'Trapezoid graph',
      icon: 'pi pi-shapes',
      template: () => this.createTrapezoidGraph()
    },
    {
      name: 'Đồ thị bánh xe',
      description: 'Wheel graph',
      icon: 'pi pi-circle-fill',
      template: () => this.createWheelGraph()
    },
    {
      name: 'Đồ thị lục giác',
      description: 'Hexagonal graph',
      icon: 'pi pi-hexagon',
      template: () => this.createHexagonalGraph()
    }
  ];

  ngAfterViewInit() {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      this.initCanvas();
      this.drawGraph();
      this.setupResizeObserver();
    }, 0);

    // Watch mode changes to reset edge creation
    effect(() => {
      const currentMode = this.mode();
      const creating = this.creatingEdge();
      
      // If switching away from add-edge mode and edge creation is in progress, reset it
      if (currentMode !== 'add-edge' && creating.from !== null) {
        this.creatingEdge.set({ from: null, to: null });
        this.selectedNode.set(null);
        this.mousePosition.set(null);
        this.drawGraph();
      }
    });

    // Auto-save edge config when weight or direction changes
    let autoSaveTimeout: any = null;
    effect(() => {
      const selectedEdgeId = this.selectedEdge();
      const weight = this.edgeWeight();
      const direction = this.edgeDirection();
      
      // Only auto-save if edge is selected and config panel is open
      if (selectedEdgeId && this.showEdgeConfig()) {
        // Debounce to avoid too many updates
        if (autoSaveTimeout) {
          clearTimeout(autoSaveTimeout);
        }
        autoSaveTimeout = setTimeout(() => {
          this.updateEdge(selectedEdgeId);
          this.drawGraph();
        }, 300); // Wait 300ms after last change
      }
    });
  }

  setupResizeObserver() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    // Use ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });

    resizeObserver.observe(container);
    
    // Store observer for cleanup
    (this as any).resizeObserver = resizeObserver;
  }

  drawSettingsPreview() {
    const canvas = document.getElementById('settings-preview-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 250;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw sample graph
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 60;

    // Draw edges first
    const nodes = [
      { id: 'A', x: centerX, y: centerY - radius, label: 'A', isStart: true },
      { id: 'B', x: centerX + radius, y: centerY, label: 'B', isStart: false },
      { id: 'C', x: centerX, y: centerY + radius, label: 'C', isStart: false },
      { id: 'D', x: centerX - radius, y: centerY, label: 'D', isStart: false }
    ];

    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'D' },
      { from: 'D', to: 'A' }
    ];

    // Draw edges
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return;

      ctx.strokeStyle = this.edgeColor();
      ctx.lineWidth = this.edgeThickness();
      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach(node => {
      const nodeRadius = this.nodeRadius();
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);

      if (node.isStart) {
        ctx.fillStyle = this.startNodeColor();
      } else if (node.id === 'C') {
        ctx.fillStyle = this.pathNodeColor();
      } else {
        ctx.fillStyle = this.nodeColor();
      }

      ctx.fill();
      ctx.strokeStyle = this.nodeBorderColor();
      ctx.lineWidth = this.nodeBorderWidth();
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, node.x, node.y);
    });
  }

  closeHelpDialog() {
    this.showHelpDialog.set(false);
    if (this.dontShowHelpAgain()) {
      localStorage.setItem('graph-visualizer-help-shown', 'true');
    }
  }

  openHelpDialog() {
    this.showHelpDialog.set(true);
  }

  ngOnDestroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    // Cleanup ResizeObserver
    if ((this as any).resizeObserver) {
      (this as any).resizeObserver.disconnect();
    }
  }

  @HostListener('keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    // Ignore if user is typing in an input field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Handle Delete key
    if (event.key === 'Delete' || event.key === 'Backspace' || event.keyCode === 46 || event.keyCode === 8) {
      event.preventDefault();
      
      // Delete selected edge first (if any)
      const selectedEdgeId = this.selectedEdge();
      if (selectedEdgeId) {
        this.deleteEdge(selectedEdgeId);
        return;
      }

      // Delete selected node (if any)
      const selectedNodeId = this.selectedNode();
      if (selectedNodeId) {
        this.deleteNode(selectedNodeId);
        return;
      }

      // Delete multiple selected nodes (in select mode)
      const selectedNodes = this.selectedNodes();
      if (selectedNodes.size > 0) {
        // Create a copy of the set to avoid modification during iteration
        const nodesToDelete = Array.from(selectedNodes);
        
        // Delete all nodes and their edges at once
        const currentNodes = this.nodes();
        const currentEdges = this.edges();
        const nodesToKeep = currentNodes.filter(n => !nodesToDelete.includes(n.id));
        const edgesToKeep = currentEdges.filter(e => 
          !nodesToDelete.includes(e.from) && !nodesToDelete.includes(e.to)
        );
        
        // Update start/end nodes if they were deleted
        if (nodesToDelete.includes(this.startNode() || '')) {
          this.startNode.set(null);
        }
        if (nodesToDelete.includes(this.endNode() || '')) {
          this.endNode.set(null);
        }
        
        this.nodes.set(nodesToKeep);
        this.edges.set(edgesToKeep);
        this.selectedNodes.set(new Set());
        this.drawGraph();
      }
    }
  }

  initCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    // Set canvas size - use CSS size directly, no scaling
    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();

      // Set canvas size to match container (1:1 with CSS pixels)
      canvas.width = rect.width;
      canvas.height = rect.height;

      // No CSS size override needed - canvas will use its width/height
    }

    // Handle window resize
    window.addEventListener('resize', () => this.handleResize());
  }

  handleResize() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.ctx) return;

    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();

      // Set canvas size to match container
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Re-render to prevent distortion
      this.drawGraph();
    }
  }

  onCanvasMouseDown(event: MouseEvent) {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.ctx) return;

    // Focus canvas to receive keyboard events
    canvas.focus();

    const rect = canvas.getBoundingClientRect();
    // Convert screen coordinates to canvas coordinates (accounting for zoom/pan)
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const x = screenX / this.zoomLevel() - this.panOffset().x;
    const y = screenY / this.zoomLevel() - this.panOffset().y;

    const currentMode = this.mode();

    // Check if clicking on a node
    const clickedNode = this.getNodeAt(x, y);
    if (clickedNode) {
      if (currentMode === 'add-edge') {
        // Add edge mode
        const creating = this.creatingEdge();
        if (creating.from === null) {
          // Double-click to edit node
          if (event.detail === 2) {
            this.handleNodeClick(clickedNode);
            return;
          }
          this.startCreatingEdge(clickedNode.id);
          this.mousePosition.set({ x, y });
        } else if (creating.from === clickedNode.id) {
          // Cancel edge creation if clicking same node
          this.creatingEdge.set({ from: null, to: null });
          this.selectedNode.set(null);
          this.mousePosition.set(null);
          this.drawGraph();
        } else {
          // Complete edge creation to different node
          this.createEdge(creating.from, clickedNode.id);
          this.creatingEdge.set({ from: null, to: null });
          this.selectedNode.set(null);
          this.mousePosition.set(null);
          this.drawGraph();
        }
      } else if (currentMode === 'move') {
        // Move mode - double-click to edit, otherwise start dragging
        if (event.detail === 2) {
          this.handleNodeClick(clickedNode);
          return;
        }
        // Start dragging node
        this.draggingNode.set(clickedNode.id);
        this.selectedNode.set(clickedNode.id);
      }
      // create-node mode: clicking on node does nothing
      return;
    }

    // Check if clicking on weight label (in move and add-edge modes)
    if (currentMode === 'move' || currentMode === 'add-edge') {
      const weightAt = this.getWeightAt(x, y);
      if (weightAt) {
        // Convert world coordinates to screen coordinates for overlay
        const zoom = this.zoomLevel();
        const pan = this.panOffset();
        const screenX = (weightAt.weightX + pan.x) * zoom;
        const screenY = (weightAt.weightY + pan.y) * zoom;
        
        this.editingWeight.set({
          edgeId: weightAt.edge.id,
          x: screenX - 25,
          y: screenY - 10
        });
        this.drawGraph();
        return;
      }
      
      // Check if clicking on an edge
      const clickedEdge = this.getEdgeAt(x, y);
      if (clickedEdge) {
        // Double-click or single click to edit edge
        this.handleEdgeClick(clickedEdge);
        return;
      }
    }

    // Start selection rectangle in select mode
    if (currentMode === 'select' && event.button === 0) {
      this.isSelecting.set(true);
      this.selectionRect.set({ x1: x, y1: y, x2: x, y2: y });
      // Clear previous selection if not holding Ctrl/Shift
      if (!event.ctrlKey && !event.shiftKey) {
        this.selectedNodes.set(new Set());
      }
      return;
    }

    // Start panning if clicking empty space in move mode
    if (currentMode === 'move' && event.button === 0) {
      // Allow panning with left mouse button drag on empty space
      this.isPanning.set(true);
      this.panStartPos.set({ x: screenX, y: screenY });
      return;
    }

    // Clicking on empty canvas
    if (currentMode === 'create-node') {
      // Create new node
      this.createNode(x, y);
    } else if (currentMode === 'add-edge') {
      // Cancel edge creation if clicking empty space
      const creating = this.creatingEdge();
      if (creating.from !== null) {
        this.creatingEdge.set({ from: null, to: null });
        this.selectedNode.set(null);
        this.mousePosition.set(null);
        this.drawGraph();
      }
    }
    // move mode: clicking empty canvas deselects (unless panning)
    else if (currentMode === 'move') {
      if (!this.isPanning()) {
        this.selectedNode.set(null);
        this.selectedEdge.set(null);
        this.showEdgeConfig.set(false);
        this.drawGraph();
      }
    }
    // select mode: clicking empty canvas clears selection
    else if (currentMode === 'select') {
      if (!event.ctrlKey && !event.shiftKey) {
        this.selectedNodes.set(new Set());
        this.drawGraph();
      }
    }
  }

  getNodeAt(x: number, y: number): GraphNode | null {
    const nodes = this.nodes();
    const radius = this.nodeRadius();
    for (const node of nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= radius) {
        return node;
      }
    }
    return null;
  }

  getEdgeAt(x: number, y: number): GraphEdge | null {
    const edges = this.edges();
    const nodes = this.nodes();

    for (const edge of edges) {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      const distance = this.distanceToLineSegment(x, y, fromNode.x, fromNode.y, toNode.x, toNode.y);
      if (distance <= 5) { // Edge click threshold
        return edge;
      }
    }
    return null;
  }

  getWeightAt(x: number, y: number): { edge: GraphEdge; weightX: number; weightY: number } | null {
    const edges = this.edges();
    const nodes = this.nodes();

    // Find all edges between same nodes to check for curved edges
    const edgeGroups = new Map<string, GraphEdge[]>();
    edges.forEach(edge => {
      const key = `${edge.from}-${edge.to}`;
      if (!edgeGroups.has(key)) {
        edgeGroups.set(key, []);
      }
      edgeGroups.get(key)!.push(edge);
    });

    for (const edge of edges) {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      // Check if this is a curved edge (multiple edges between same nodes)
      const sameEdges = edgeGroups.get(`${edge.from}-${edge.to}`) || [];
      const isCurved = sameEdges.length > 1;
      const edgeIndex = sameEdges.indexOf(edge);

      let weightX: number, weightY: number;

      if (isCurved && edgeIndex > 0) {
        // Curved edge - calculate control point
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const angle = Math.atan2(dy, dx);
        const perpendicularAngle = angle + Math.PI / 2;
        const curveDirection = edgeIndex % 2 === 0 ? 1 : -1;
        const curveOffset = 40 * curveDirection * Math.ceil(edgeIndex / 2);
        const midX = (fromNode.x + toNode.x) / 2;
        const midY = (fromNode.y + toNode.y) / 2;
        weightX = midX + Math.cos(perpendicularAngle) * curveOffset;
        weightY = midY + Math.sin(perpendicularAngle) * curveOffset;
      } else {
        // Straight edge - use midpoint
        weightX = (fromNode.x + toNode.x) / 2;
        weightY = (fromNode.y + toNode.y) / 2;
      }

      // Check if click is near weight label (30x20 rectangle)
      const distance = Math.sqrt((x - weightX) ** 2 + (y - weightY) ** 2);
      if (distance <= 20) {
        return { edge, weightX, weightY };
      }
    }
    return null;
  }

  distanceToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx: number, yy: number;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  startCreatingEdge(nodeId: string) {
    this.creatingEdge.set({ from: nodeId, to: null });
    this.selectedNode.set(nodeId);
    this.drawGraph();
  }

  handleEdgeClick(edge: GraphEdge) {
    this.selectedEdge.set(edge.id);
    this.edgeWeight.set(edge.weight);
    this.edgeDirection.set(edge.direction);
    this.showEdgeConfig.set(true);
    this.drawGraph();
  }

  getEdgeWeight(edgeId: string): number {
    const edge = this.edges().find(e => e.id === edgeId);
    return edge?.weight || 1;
  }

  finishEditingWeight() {
    const editing = this.editingWeight();
    if (!editing) return;

    const input = document.querySelector('.weight-input-inline') as HTMLInputElement;
    if (input) {
      const newWeight = parseInt(input.value, 10);
      if (!isNaN(newWeight) && newWeight >= 1) {
        const edges = this.edges();
        const edgeIndex = edges.findIndex(e => e.id === editing.edgeId);
        if (edgeIndex !== -1) {
          const updatedEdges = [...edges];
          updatedEdges[edgeIndex] = {
            ...updatedEdges[edgeIndex],
            weight: newWeight
          };
          this.edges.set(updatedEdges);
          this.drawGraph();
        }
      }
    }
    this.editingWeight.set(null);
  }

  cancelEditingWeight() {
    this.editingWeight.set(null);
    this.drawGraph();
  }

  handleNodeClick(node: GraphNode) {
    this.selectedNode.set(node.id);
    this.nodeLabel.set(node.label);
    this.showNodeConfig.set(true);
    this.drawGraph();
  }

  getEdgeFromNode(edgeId: string): string {
    const edge = this.edges().find(e => e.id === edgeId);
    return edge?.from || '';
  }

  getEdgeToNode(edgeId: string): string {
    const edge = this.edges().find(e => e.id === edgeId);
    return edge?.to || '';
  }

  getAlgorithmButtonText(): string {
    const algo = this.selectedAlgorithm();
    switch (algo) {
      case 'dijkstra':
      case 'bellman-ford':
      case 'floyd-warshall':
      case 'a-star':
        return 'Tìm đường đi ngắn nhất';
      case 'bfs':
        return 'Chạy BFS';
      case 'dfs':
        return 'Chạy DFS';
      case 'graph-coloring':
        return 'Tô màu đồ thị';
      case 'connected-components':
        return 'Tìm thành phần liên thông';
      case 'scc':
        return 'Tìm thành phần liên thông mạnh';
      case 'cycle-detection':
        return 'Phát hiện chu trình';
      default:
        return 'Chạy thuật toán';
    }
  }

  getNodeLabelFromIndex(index: number): string {
    const mode = this.nodeNamingMode();
    if (mode === 'numeric') {
      return `${index}`;
    } else if (mode === 'alphabetic') {
      // A, B, C, ..., Z, AA, AB, ...
      let result = '';
      let num = index;
      while (num >= 0) {
        result = String.fromCharCode(65 + (num % 26)) + result;
        num = Math.floor(num / 26) - 1;
      }
      return result;
    } else {
      // indexed: N0, N1, N2, ...
      return `N${index}`;
    }
  }

  createNode(x: number, y: number) {
    const counter = this.nodeCounter();
    const newNode: GraphNode = {
      id: `node-${counter}`,
      x,
      y,
      label: this.getNodeLabelFromIndex(counter),
      isStart: false,
      isEnd: false
    };

    this.nodes.set([...this.nodes(), newNode]);
    this.nodeCounter.set(counter + 1);
    this.drawGraph();
  }

  createEdge(fromId: string, toId: string) {
    if (fromId === toId) return; // Cannot create edge to itself

    // Allow multiple edges between same nodes
    const newEdge: GraphEdge = {
      id: `edge-${this.edgeCounter()}`,
      from: fromId,
      to: toId,
      weight: this.edgeWeight(),
      direction: this.edgeDirection() // Default is now bidirectional
    };

    this.edges.set([...this.edges(), newEdge]);
    this.edgeCounter.set(this.edgeCounter() + 1);
    this.drawGraph();
  }

  updateEdge(edgeId: string) {
    const edges = this.edges();
    const edgeIndex = edges.findIndex(e => e.id === edgeId);
    if (edgeIndex === -1) return;

    const updatedEdges = [...edges];
    updatedEdges[edgeIndex] = {
      ...updatedEdges[edgeIndex],
      weight: this.edgeWeight(),
      direction: this.edgeDirection()
    };

    this.edges.set(updatedEdges);
    this.drawGraph();
  }

  onNodeMouseDown(event: MouseEvent, nodeId: string) {
    event.stopPropagation();
    event.preventDefault();
    this.draggingNode.set(nodeId);
  }

  onCanvasMouseMove(event: MouseEvent) {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const x = screenX / this.zoomLevel() - this.panOffset().x;
    const y = screenY / this.zoomLevel() - this.panOffset().y;

    const currentMode = this.mode();

    // Handle panning (in move mode) - allow panning when dragging on empty space
    if (this.isPanning() && currentMode === 'move') {
      const startPos = this.panStartPos();
      if (startPos) {
        const deltaX = (screenX - startPos.x) / this.zoomLevel();
        const deltaY = (screenY - startPos.y) / this.zoomLevel();
        const currentPan = this.panOffset();
        this.panOffset.set({
          x: currentPan.x + deltaX,
          y: currentPan.y + deltaY
        });
        this.panStartPos.set({ x: screenX, y: screenY });
        this.drawGraph();
        return;
      }
    }

    // Update selection rectangle in select mode
    if (currentMode === 'select' && this.isSelecting()) {
      const rect = this.selectionRect();
      if (rect) {
        this.selectionRect.set({ ...rect, x2: x, y2: y });
        this.drawGraph();
      }
    }

    // Update mouse position for edge creation visualization (in add-edge mode)
    if (currentMode === 'add-edge') {
      this.mousePosition.set({ x, y });
      
      // Check if hovering over a node
      const hoveredNode = this.getNodeAt(x, y);
      if (hoveredNode && this.creatingEdge().from !== null && hoveredNode.id !== this.creatingEdge().from) {
        this.hoveredNode.set(hoveredNode.id);
      } else {
        this.hoveredNode.set(null);
      }
      this.drawGraph();
    }

    // Handle node dragging (in move mode) - only if not panning
    const draggingId = this.draggingNode();
    if (draggingId && currentMode === 'move' && !this.isPanning()) {
      const nodes = this.nodes();
      const nodeIndex = nodes.findIndex(n => n.id === draggingId);
      if (nodeIndex !== -1) {
        const updatedNodes = [...nodes];
        const nodeRadius = 25;
        // Constrain to canvas bounds (in world coordinates)
        const maxX = (canvas.width / this.zoomLevel()) - this.panOffset().x - nodeRadius;
        const maxY = (canvas.height / this.zoomLevel()) - this.panOffset().y - nodeRadius;
        const minX = -this.panOffset().x + nodeRadius;
        const minY = -this.panOffset().y + nodeRadius;
        
        updatedNodes[nodeIndex] = {
          ...updatedNodes[nodeIndex],
          x: Math.max(minX, Math.min(maxX, x)),
          y: Math.max(minY, Math.min(maxY, y))
        };
        this.nodes.set(updatedNodes);
        this.drawGraph();
      }
    }
  }

  onCanvasWheel(event: WheelEvent) {
    if (this.mode() !== 'move') return;

    event.preventDefault();
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const oldZoom = this.zoomLevel();
    
    // Calculate smooth zoom factor based on scroll delta
    // Use a smaller factor for smoother zooming (0.02 = 2% per scroll unit)
    const zoomSensitivity = 0.02;
    const zoomDelta = -event.deltaY * zoomSensitivity;
    const zoomFactor = 1 + zoomDelta;
    const newZoom = Math.max(0.5, Math.min(3, oldZoom * zoomFactor));

    // Get mouse position in screen coordinates
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Convert to world coordinates before zoom
    const worldX = mouseX / oldZoom - this.panOffset().x;
    const worldY = mouseY / oldZoom - this.panOffset().y;

    // Calculate new pan offset to keep mouse point fixed
    const newPanX = mouseX / newZoom - worldX;
    const newPanY = mouseY / newZoom - worldY;

    this.zoomLevel.set(newZoom);
    this.panOffset.set({ x: newPanX, y: newPanY });
    this.drawGraph();
  }

  onCanvasMouseUp(event: MouseEvent) {
    // Handle selection rectangle end (in select mode)
    if (this.isSelecting()) {
      const rect = this.selectionRect();
      if (rect) {
        const minX = Math.min(rect.x1, rect.x2);
        const maxX = Math.max(rect.x1, rect.x2);
        const minY = Math.min(rect.y1, rect.y2);
        const maxY = Math.max(rect.y1, rect.y2);
        
        const nodes = this.nodes();
        const selected = new Set(this.selectedNodes());
        const nodeRadius = this.nodeRadius();
        
        nodes.forEach(node => {
          // Check if node center is inside selection rectangle
          if (node.x >= minX - nodeRadius && node.x <= maxX + nodeRadius &&
              node.y >= minY - nodeRadius && node.y <= maxY + nodeRadius) {
            if (event.ctrlKey || event.shiftKey) {
              // Toggle selection
              if (selected.has(node.id)) {
                selected.delete(node.id);
              } else {
                selected.add(node.id);
              }
            } else {
              selected.add(node.id);
            }
          }
        });
        
        this.selectedNodes.set(selected);
      }
      this.isSelecting.set(false);
      this.selectionRect.set(null);
      this.drawGraph();
    }

    // Handle node dragging end (in move mode)
    const draggingId = this.draggingNode();
    if (draggingId) {
      this.draggingNode.set(null);
      this.drawGraph();
    }

    // Handle panning end
    if (this.isPanning()) {
      this.isPanning.set(false);
      this.panStartPos.set(null);
    }
  }

  deleteNode(nodeId: string) {
    this.nodes.set(this.nodes().filter(n => n.id !== nodeId));
    this.edges.set(this.edges().filter(e => e.from !== nodeId && e.to !== nodeId));

    if (this.startNode() === nodeId) this.startNode.set(null);
    if (this.endNode() === nodeId) this.endNode.set(null);

    this.drawGraph();
  }

  deleteEdge(edgeId: string) {
    this.edges.set(this.edges().filter(e => e.id !== edgeId));
    this.selectedEdge.set(null);
    this.showEdgeConfig.set(false);
    this.drawGraph();
  }

  setStartNode(nodeId: string) {
    const nodes = this.nodes();
    const updatedNodes = nodes.map(n => ({
      ...n,
      isStart: n.id === nodeId,
      isEnd: n.id === this.endNode() ? true : false
    }));
    this.nodes.set(updatedNodes);
    this.startNode.set(nodeId);
    this.drawGraph();
  }

  setEndNode(nodeId: string) {
    const nodes = this.nodes();
    const updatedNodes = nodes.map(n => ({
      ...n,
      isEnd: n.id === nodeId,
      isStart: n.id === this.startNode() ? true : false
    }));
    this.nodes.set(updatedNodes);
    this.endNode.set(nodeId);
    this.drawGraph();
  }

  drawGraph() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.ctx) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context and apply zoom/pan transformations
    this.ctx.save();
    this.ctx.translate(this.panOffset().x * this.zoomLevel(), this.panOffset().y * this.zoomLevel());
    this.ctx.scale(this.zoomLevel(), this.zoomLevel());

    const nodes = this.nodes();
    const edges = this.edges();
    const creating = this.creatingEdge();
    const selectedNodeId = this.selectedNode();
    const selectedEdgeId = this.selectedEdge();
    const pathResult = this.pathResult();
    const highlightedStepEdge = this.highlightedStepEdge();

    // Group edges by node pairs to calculate curve index
    const edgeGroups = new Map<string, GraphEdge[]>();
    edges.forEach(edge => {
      // Create a key for the edge pair (order-independent, use sorted node IDs)
      const nodePair = [edge.from, edge.to].sort().join('-');
      
      if (!edgeGroups.has(nodePair)) {
        edgeGroups.set(nodePair, []);
      }
      edgeGroups.get(nodePair)!.push(edge);
    });

    // Draw edges
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return;

      const isHighlighted = pathResult?.path && Array.isArray(pathResult.path) && pathResult.path.some((nodeId: string, index: number) => {
        const nextId = pathResult.path[index + 1];
        return (edge.from === nodeId && edge.to === nextId) ||
               (edge.direction === 'bidirectional' && edge.from === nextId && edge.to === nodeId);
      });

      // Check if edge is highlighted from step
      const isStepHighlighted = highlightedStepEdge && 
        ((edge.from === highlightedStepEdge.from && edge.to === highlightedStepEdge.to) ||
         (edge.direction === 'bidirectional' && edge.from === highlightedStepEdge.to && edge.to === highlightedStepEdge.from));

      // Find edge index in its group to determine curve
      const nodePair = [edge.from, edge.to].sort().join('-');
      const group = edgeGroups.get(nodePair) || [];
      // Sort edges by ID to ensure consistent ordering
      const sortedGroup = [...group].sort((a, b) => a.id.localeCompare(b.id));
      const edgeIndex = sortedGroup.findIndex(e => e.id === edge.id);
      const isCurved = group.length > 1 && edgeIndex > 0; // First edge is straight, others are curved

      this.drawEdge(fromNode, toNode, edge, isHighlighted || false, selectedEdgeId === edge.id, isStepHighlighted || false, isCurved, edgeIndex);
    });

    // Draw creating edge (temporary edge while dragging)
    if (creating.from) {
      const fromNode = nodes.find(n => n.id === creating.from);
      const mousePos = this.mousePosition();
      if (fromNode && mousePos) {
        this.drawTemporaryEdge(fromNode, mousePos);
      }
    }

    // Draw nodes
    const highlightedStepNode = this.highlightedStepNode();
    const selectedNodes = this.selectedNodes();
    nodes.forEach(node => {
      const isSelected = selectedNodeId === node.id || selectedNodes.has(node.id);
      const isInPath = pathResult?.path && Array.isArray(pathResult.path) && pathResult.path.includes(node.id) || false;
      const isStepHighlighted = highlightedStepNode === node.id;
      this.drawNode(node, isSelected, isInPath, isStepHighlighted);
    });

    // Restore transform
    this.ctx.restore();

    // Draw selection rectangle (after restore, so it's in screen coordinates)
    const selectionRect = this.selectionRect();
    if (selectionRect && this.mode() === 'select') {
      const canvas = this.canvasRef?.nativeElement;
      if (!canvas) return;

      // Convert world coordinates to screen coordinates
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      const x1 = (selectionRect.x1 + pan.x) * zoom;
      const y1 = (selectionRect.y1 + pan.y) * zoom;
      const x2 = (selectionRect.x2 + pan.x) * zoom;
      const y2 = (selectionRect.y2 + pan.y) * zoom;
      
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      
      this.ctx.strokeStyle = '#2196F3';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      this.ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
      this.ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
      this.ctx.setLineDash([]);
    }
  }

  drawEdge(from: GraphNode, to: GraphNode, edge: GraphEdge, isHighlighted: boolean, isSelected: boolean, isStepHighlighted: boolean = false, isCurved: boolean = false, curveIndex: number = 0) {
    if (!this.ctx) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const nodeRadius = this.nodeRadius();

    // Calculate arrow positions
    const startX = from.x + Math.cos(angle) * nodeRadius;
    const startY = from.y + Math.sin(angle) * nodeRadius;
    const endX = to.x - Math.cos(angle) * nodeRadius;
    const endY = to.y - Math.sin(angle) * nodeRadius;

    // Draw edge line - step highlight takes priority (red)
    if (isStepHighlighted) {
      this.ctx.strokeStyle = '#F44336';
      this.ctx.lineWidth = 4;
    } else if (isHighlighted) {
      this.ctx.strokeStyle = this.pathEdgeColor();
      this.ctx.lineWidth = Math.max(3, this.edgeThickness() + 2);
    } else if (isSelected) {
      this.ctx.strokeStyle = '#2196F3';
      this.ctx.lineWidth = Math.max(2, this.edgeThickness() + 1);
    } else {
      this.ctx.strokeStyle = this.edgeColor();
      this.ctx.lineWidth = this.edgeThickness();
    }

    this.ctx.beginPath();

    let controlX: number, controlY: number;
    if (isCurved) {
      // Draw curved edge for multiple edges between same nodes
      // Calculate perpendicular offset for curve
      const perpendicularAngle = angle + Math.PI / 2;
      // Alternate curve direction: first curved edge goes up, second goes down, etc.
      const curveDirection = curveIndex % 2 === 0 ? 1 : -1;
      const curveOffset = 40 * curveDirection * Math.ceil((curveIndex) / 2);
      
      // Control point for quadratic curve (perpendicular to the line)
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      controlX = midX + Math.cos(perpendicularAngle) * curveOffset;
      controlY = midY + Math.sin(perpendicularAngle) * curveOffset;

      // Adjust start and end points to account for curve
      const curveStartX = from.x + Math.cos(angle) * nodeRadius;
      const curveStartY = from.y + Math.sin(angle) * nodeRadius;
      const curveEndX = to.x - Math.cos(angle) * nodeRadius;
      const curveEndY = to.y - Math.sin(angle) * nodeRadius;

      // Draw quadratic curve
      this.ctx.moveTo(curveStartX, curveStartY);
      this.ctx.quadraticCurveTo(controlX, controlY, curveEndX, curveEndY);
    } else {
      // Draw straight line for first edge
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      // Set control point to midpoint for weight positioning
      controlX = (startX + endX) / 2;
      controlY = (startY + endY) / 2;
    }

    this.ctx.stroke();

    // Calculate angle at end point for arrow (for curved edges)
    let arrowAngle = angle;
    let startArrowAngle = angle + Math.PI;
    let arrowEndX = endX;
    let arrowEndY = endY;
    let arrowStartX = startX;
    let arrowStartY = startY;
    
    if (isCurved) {
      // Use curve end points
      arrowEndX = to.x - Math.cos(angle) * nodeRadius;
      arrowEndY = to.y - Math.sin(angle) * nodeRadius;
      arrowStartX = from.x + Math.cos(angle) * nodeRadius;
      arrowStartY = from.y + Math.sin(angle) * nodeRadius;
      
      // Calculate tangent angle at end point for curved edge
      const dx2 = arrowEndX - controlX;
      const dy2 = arrowEndY - controlY;
      arrowAngle = Math.atan2(dy2, dx2);
      
      // Calculate tangent angle at start point for curved edge
      const dx3 = controlX - arrowStartX;
      const dy3 = controlY - arrowStartY;
      startArrowAngle = Math.atan2(dy3, dx3);
    }

    // Draw arrow based on direction
    // For bidirectional edges, only draw one arrow (forward direction)
    if (edge.direction === 'forward') {
      this.drawArrow(arrowEndX, arrowEndY, arrowAngle, isHighlighted || isStepHighlighted);
    } else if (edge.direction === 'backward') {
      this.drawArrow(arrowStartX, arrowStartY, startArrowAngle, isHighlighted || isStepHighlighted);
    } else if (edge.direction === 'bidirectional') {
      // Bidirectional: only draw one arrow (forward direction) to avoid double arrows
      this.drawArrow(arrowEndX, arrowEndY, arrowAngle, isHighlighted || isStepHighlighted);
    }

    // Draw weight - position on curve for curved edges
    const weightX = controlX;
    const weightY = controlY;

    // Check if this weight is being edited
    const editingWeight = this.editingWeight();
    const isEditing = editingWeight && editingWeight.edgeId === edge.id;

    if (!isEditing) {
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(weightX - 15, weightY - 10, 30, 20);
      this.ctx.fillStyle = '#333';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(edge.weight.toString(), weightX, weightY);
    }
  }

  drawArrow(x: number, y: number, angle: number, isHighlighted: boolean) {
    if (!this.ctx) return;
    this.drawArrowForContext(this.ctx, x, y, angle, isHighlighted);
  }

  drawArrowForContext(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, isHighlighted: boolean = false) {
    const arrowLength = this.edgeArrowSize();
    const arrowWidth = this.edgeArrowSize() / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = isHighlighted ? '#4CAF50' : '#666';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowLength, -arrowWidth);
    ctx.lineTo(-arrowLength, arrowWidth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawTemporaryEdge(from: GraphNode, to: { x: number; y: number }) {
    if (!this.ctx) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    const nodeRadius = 25;

    const startX = from.x + Math.cos(angle) * nodeRadius;
    const startY = from.y + Math.sin(angle) * nodeRadius;

    // Draw temporary edge line
    this.ctx.strokeStyle = '#9E9E9E';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  drawNode(node: GraphNode, isSelected: boolean, isInPath: boolean, isStepHighlighted: boolean = false) {
    if (!this.ctx) return;

    const radius = this.nodeRadius();
    const startNode = this.startNode();
    const endNode = this.endNode();
    const isStartHighlighted = startNode === node.id;
    const isEndHighlighted = endNode === node.id;
    const isHovered = this.hoveredNode() === node.id && this.mode() === 'add-edge' && this.creatingEdge().from !== null;

    // Draw node circle
    this.ctx.beginPath();
    this.ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

    // Step highlight takes priority (red)
    if (isStepHighlighted) {
      this.ctx.fillStyle = '#F44336';
    } else if (node.isStart || isStartHighlighted) {
      this.ctx.fillStyle = this.startNodeColor();
    } else if (node.isEnd || isEndHighlighted) {
      this.ctx.fillStyle = this.endNodeColor();
    } else if (isInPath) {
      this.ctx.fillStyle = this.pathNodeColor();
    } else if (isHovered) {
      // Highlight when hovering during edge creation
      this.ctx.fillStyle = '#9C27B0';
    } else {
      this.ctx.fillStyle = this.nodeColor();
    }

    this.ctx.fill();

    if (isStepHighlighted) {
      // Red border for step highlight
      this.ctx.strokeStyle = '#D32F2F';
      this.ctx.lineWidth = 5;
    } else if (isSelected) {
      this.ctx.strokeStyle = '#FF5722';
      this.ctx.lineWidth = 3;
    } else if (isHovered) {
      // Highlight hovered node with pulsing border
      this.ctx.strokeStyle = '#E91E63';
      this.ctx.lineWidth = 4;
    } else if (isStartHighlighted || isEndHighlighted) {
      // Highlight Start/End nodes with thicker border
      this.ctx.strokeStyle = this.nodeBorderColor();
      this.ctx.lineWidth = Math.max(4, this.nodeBorderWidth() + 2);
    } else {
      this.ctx.strokeStyle = this.nodeBorderColor();
      this.ctx.lineWidth = this.nodeBorderWidth();
    }
    this.ctx.stroke();

    // Draw label
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(node.label, node.x, node.y);
  }

  // Algorithm implementations
  async findShortestPath() {
    const algorithm = this.selectedAlgorithm();
    const start = this.startNode();
    const end = this.endNode();

    // Algorithms that require start and end nodes
    const requiresStartEnd = ['dijkstra', 'bellman-ford', 'floyd-warshall', 'a-star'];
    
    if (requiresStartEnd.includes(algorithm)) {
      if (!start || !end) {
        alert('Vui lòng chọn Start và End node');
        return;
      }

      if (start === end) {
        alert('Start và End node không thể giống nhau');
        return;
      }
    } else if (algorithm === 'bfs' || algorithm === 'dfs') {
      if (!start) {
        alert('Vui lòng chọn Start node');
        return;
      }
    }

    this.isCalculating.set(true);
    this.isAnimating.set(true);
    this.pathResult.set(null);
    this.algorithmSteps.set([]);
    this.currentStep.set(0);

    const nodes = this.nodes();
    const edges = this.edges();

    const onStep = async (step: any) => {
      this.algorithmSteps.set([...this.algorithmSteps(), step]);
      this.currentStep.set(this.algorithmSteps().length - 1);
      this.drawGraph();
      await new Promise(resolve => setTimeout(resolve, 500));
    };

    let result: AlgorithmResult | any;

    switch (algorithm) {
      case 'dijkstra':
        result = await GraphAlgorithms.dijkstra(nodes, edges, start!, end!, onStep);
        break;
      case 'bellman-ford':
        result = await GraphAlgorithms.bellmanFord(nodes, edges, start!, end!, onStep);
        break;
      case 'floyd-warshall':
        result = await GraphAlgorithms.floydWarshall(nodes, edges, start!, end!, onStep);
        break;
      case 'a-star':
        result = await GraphAlgorithms.aStar(nodes, edges, start!, end!, onStep);
        break;
      case 'graph-coloring':
        result = await GraphAlgorithms.graphColoring(nodes, edges, onStep);
        break;
      case 'bfs':
        result = await GraphAlgorithms.bfs(nodes, edges, start!, onStep);
        break;
      case 'dfs':
        result = await GraphAlgorithms.dfs(nodes, edges, start!, onStep);
        break;
      case 'cycle-detection':
        result = await GraphAlgorithms.detectCycles(nodes, edges, onStep);
        break;
      case 'connected-components':
        result = await GraphAlgorithms.findConnectedComponents(nodes, edges, onStep);
        break;
      case 'scc':
        result = await GraphAlgorithms.findStronglyConnectedComponents(nodes, edges, onStep);
        break;
      default:
        result = await GraphAlgorithms.dijkstra(nodes, edges, start!, end!, onStep);
    }

    this.pathResult.set(result);
    this.finalResult.set(result);
    this.isCalculating.set(false);
    this.isAnimating.set(false);
    this.showCalculationPanel.set(true);
    this.drawGraph();
  }

  // Removed unused methods - using GraphAlgorithms from util instead
  // All algorithm implementations moved to graph-algorithms.util.ts

  clearGraph() {
    if (confirm('Bạn có chắc muốn xóa toàn bộ đồ thị?')) {
      this.nodes.set([]);
      this.edges.set([]);
      this.startNode.set(null);
      this.endNode.set(null);
      this.pathResult.set(null);
      this.nodeCounter.set(0);
      this.edgeCounter.set(0);
      this.zoomLevel.set(1);
      this.panOffset.set({ x: 0, y: 0 });
      this.drawGraph();
    }
  }

  saveEdgeConfig() {
    const edgeId = this.selectedEdge();
    if (edgeId) {
      this.updateEdge(edgeId);
    }
    this.showEdgeConfig.set(false);
    this.selectedEdge.set(null);
  }

  saveNodeConfig() {
    const nodeId = this.selectedNode();
    if (nodeId) {
      const nodes = this.nodes();
      const nodeIndex = nodes.findIndex(n => n.id === nodeId);
      if (nodeIndex !== -1) {
        const updatedNodes = [...nodes];
        updatedNodes[nodeIndex] = {
          ...updatedNodes[nodeIndex],
          label: this.nodeLabel()
        };
        this.nodes.set(updatedNodes);
        this.drawGraph();
      }
    }
    this.showNodeConfig.set(false);
  }

  getNodeLabel(nodeId: string): string {
    const node = this.nodes().find(n => n.id === nodeId);
    return node ? node.label : nodeId;
  }

  // Graph Input Methods
  addInputEdge() {
    this.inputEdges.set([
      ...this.inputEdges(),
      { from: '', to: '', weight: 1, directed: false }
    ]);
  }

  removeInputEdge(index: number) {
    const edges = this.inputEdges();
    this.inputEdges.set(edges.filter((_, i) => i !== index));
    this.updatePreview();
  }

  updatePreview() {
    const nodesText = this.inputNodes().trim();
    const edges = this.inputEdges();

    if (!nodesText) {
      this.previewNodes.set([]);
      this.previewEdges.set([]);
      setTimeout(() => this.drawPreview(), 0);
      return;
    }

    // Parse nodes
    const nodeNames = nodesText.split(',').map(n => n.trim()).filter(n => n.length > 0);
    const uniqueNodes = [...new Set(nodeNames)];

    if (uniqueNodes.length === 0) {
      this.previewNodes.set([]);
      this.previewEdges.set([]);
      setTimeout(() => this.drawPreview(), 0);
      return;
    }

    // Create preview nodes (arrange in circle)
    const centerX = 200;
    const centerY = 150;
    const radius = Math.min(100, 80 + uniqueNodes.length * 5);
    const previewNodes: GraphNode[] = uniqueNodes.map((name, index) => {
      const angle = (2 * Math.PI * index) / uniqueNodes.length;
      return {
        id: name,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        label: name,
        isStart: false,
        isEnd: false
      };
    });
    this.previewNodes.set(previewNodes);

    // Create preview edges
    const nodeSet = new Set(uniqueNodes);
    const previewEdges: GraphEdge[] = [];

    edges.forEach((edge, index) => {
      const from = edge.from.trim();
      const to = edge.to.trim();

      if (from && to && nodeSet.has(from) && nodeSet.has(to) && from !== to) {
        previewEdges.push({
          id: `preview-edge-${index}`,
          from: from,
          to: to,
          weight: edge.weight || 1,
          direction: edge.directed ? 'forward' : 'bidirectional'
        });
      }
    });

    this.previewEdges.set(previewEdges);
    setTimeout(() => this.drawPreview(), 0);
  }

  getPreviewErrors(): string[] {
    const errors: string[] = [];
    const nodesText = this.inputNodes().trim();

    if (!nodesText) {
      return errors;
    }

    const nodeNames = nodesText.split(',').map(n => n.trim()).filter(n => n.length > 0);
    const nodeSet = new Set(nodeNames);

    this.inputEdges().forEach((edge, index) => {
      const from = edge.from.trim();
      const to = edge.to.trim();

      if (from && !nodeSet.has(from)) {
        errors.push(`Cạnh ${index + 1}: Đỉnh "${from}" không có trong danh sách đỉnh`);
      }
      if (to && !nodeSet.has(to)) {
        errors.push(`Cạnh ${index + 1}: Đỉnh "${to}" không có trong danh sách đỉnh`);
      }
      if (from && to && from === to) {
        errors.push(`Cạnh ${index + 1}: Không thể tạo cạnh từ đỉnh đến chính nó`);
      }
    });

    return errors;
  }

  private previewCtx: CanvasRenderingContext2D | null = null;

  drawPreview() {
    const canvas = this.previewCanvasRef?.nativeElement;
    if (!canvas) {
      // Retry after a short delay if canvas not ready
      setTimeout(() => this.drawPreview(), 100);
      return;
    }

    if (!this.previewCtx) {
      this.previewCtx = canvas.getContext('2d');
      if (!this.previewCtx) return;
      canvas.width = 400;
      canvas.height = 300;
    }

    if (!this.previewCtx) return;

    const ctx = this.previewCtx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nodes = this.previewNodes();
    const edges = this.previewEdges();

    // Draw edges
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return;

      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const angle = Math.atan2(dy, dx);
      const nodeRadius = 20;

      const startX = fromNode.x + Math.cos(angle) * nodeRadius;
      const startY = fromNode.y + Math.sin(angle) * nodeRadius;
      const endX = toNode.x - Math.cos(angle) * nodeRadius;
      const endY = toNode.y - Math.sin(angle) * nodeRadius;

      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      if (edge.direction === 'forward' || edge.direction === 'bidirectional') {
        this.drawArrowForContext(ctx, endX, endY, angle);
      }
      if (edge.direction === 'backward' || edge.direction === 'bidirectional') {
        this.drawArrowForContext(ctx, startX, startY, angle + Math.PI);
      }

      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(midX - 12, midY - 8, 24, 16);
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(edge.weight.toString(), midX, midY);
    });

    // Draw nodes
    nodes.forEach(node => {
      const radius = 20;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#2196F3';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, node.x, node.y);
    });
  }

  applyGraphInput() {
    const errors = this.getPreviewErrors();
    if (errors.length > 0) {
      alert('Có lỗi trong dữ liệu:\n' + errors.join('\n'));
      return;
    }

    const previewNodes = this.previewNodes();
    if (previewNodes.length === 0) {
      alert('Vui lòng nhập ít nhất một đỉnh');
      return;
    }

    // Clear existing graph
    this.nodes.set([]);
    this.edges.set([]);
    this.nodeCounter.set(0);
    this.edgeCounter.set(0);

    // Get canvas dimensions for positioning
    const canvas = this.canvasRef?.nativeElement;
    const centerX = canvas ? canvas.width / 2 : 400;
    const centerY = canvas ? canvas.height / 2 : 300;
    const radius = Math.min(canvas ? canvas.width / 3 : 200, canvas ? canvas.height / 3 : 150);

    // Create nodes arranged in circle
    const newNodes: GraphNode[] = previewNodes.map((previewNode, index) => {
      const angle = (2 * Math.PI * index) / previewNodes.length;
      return {
        id: previewNode.id,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        label: previewNode.label,
        isStart: false,
        isEnd: false
      };
    });

    // Create edges
    const newEdges: GraphEdge[] = this.previewEdges().map((previewEdge, index) => ({
      id: `edge-${this.edgeCounter() + index}`,
      from: previewEdge.from,
      to: previewEdge.to,
      weight: previewEdge.weight,
      direction: previewEdge.direction
    }));

    this.nodes.set(newNodes);
    this.edges.set(newEdges);
    this.nodeCounter.set(previewNodes.length);
    this.edgeCounter.set(newEdges.length);

    // Reset form
    this.inputNodes.set('');
    this.inputEdges.set([]);
    this.previewNodes.set([]);
    this.previewEdges.set([]);
    this.showGraphInputDialog.set(false);

    this.drawGraph();
  }


  applyTemplate(template: any) {
    if (template && template.template) {
      // Store selected template and move to config step
      this.selectedTemplate.set(template);
      this.initializeTemplateConfig(template);
      this.templateDialogStep.set(2);
      // Draw preview after a short delay to ensure canvas is ready
      setTimeout(() => this.drawTemplatePreview(), 200);
    }
  }

  goBackToTemplateSelection() {
    this.templateDialogStep.set(1);
    this.selectedTemplate.set(null);
    this.templateConfig.set({});
  }

  getDensitySpacing(density: 'sparse' | 'medium' | 'dense' | 'very-dense' = 'medium'): number {
    switch (density) {
      case 'sparse': return 200;
      case 'medium': return 150;
      case 'dense': return 100;
      case 'very-dense': return 70;
      default: return 150;
    }
  }

  getDensityRadius(density: 'sparse' | 'medium' | 'dense' | 'very-dense' = 'medium'): number {
    switch (density) {
      case 'sparse': return 180;
      case 'medium': return 120;
      case 'dense': return 80;
      case 'very-dense': return 60;
      default: return 120;
    }
  }

  initializeTemplateConfig(template: any) {
    const config: any = {
      edgeWeight: 1,
      direction: 'bidirectional' as const,
      density: 'medium' as const
    };

    // Set default config based on template type
    if (template.name.includes('Lưới')) {
      // Grid templates already have rows/cols in the function call
      config.edgeWeight = 1;
      config.direction = 'bidirectional';
      config.density = 'medium';
    } else if (template.name === 'Đồ thị đầy đủ') {
      config.nodeCount = 5;
      config.edgeWeight = 1;
      config.direction = 'bidirectional';
      config.density = 'medium';
    } else if (template.name === 'Sao') {
      config.nodeCount = 6; // 1 center + 5 outer
      config.edgeWeight = 1;
      config.direction = 'bidirectional';
      config.density = 'medium';
    } else if (template.name === 'Vòng tròn') {
      config.nodeCount = 4;
      config.edgeWeight = 1;
      config.direction = 'bidirectional';
      config.density = 'medium';
    } else if (template.name === 'Đường thẳng') {
      config.nodeCount = 4;
      config.edgeWeight = 1;
      config.direction = 'bidirectional';
      config.density = 'medium';
    }

    this.templateConfig.set(config);
  }

  drawTemplatePreview() {
    const canvas = this.templatePreviewCanvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 350;
    canvas.height = 300;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const template = this.selectedTemplate();
    const config = this.templateConfig();
    if (!template) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const nodeRadius = 20;
    let nodes: Array<{ id: string; x: number; y: number; label: string; isStart: boolean }> = [];
    let edges: Array<{ from: string; to: string }> = [];

    // Get density-based spacing/radius
    const density = config.density || 'medium';
    const baseSpacing = this.getDensitySpacing(density);
    const baseRadius = this.getDensityRadius(density);
    
    // Scale for preview (smaller canvas)
    const previewSpacing = baseSpacing * 0.4;
    const previewRadius = baseRadius * 0.4;

    // Generate preview based on template type
    if (template.name === 'Đường thẳng') {
      const nodeCount = config.nodeCount || 4;
      const spacing = previewSpacing;
      const startX = 50;
      const startY = centerY;
      for (let i = 0; i < nodeCount; i++) {
        const nodeId = String.fromCharCode(65 + i);
        nodes.push({
          id: nodeId,
          x: startX + i * spacing,
          y: startY,
          label: nodeId,
          isStart: i === 0
        });
        if (i > 0) {
          edges.push({ from: String.fromCharCode(65 + i - 1), to: nodeId });
        }
      }
    } else if (template.name === 'Vòng tròn') {
      const nodeCount = config.nodeCount || 4;
      const radius = previewRadius;
      for (let i = 0; i < nodeCount; i++) {
        const angle = (2 * Math.PI * i) / nodeCount;
        const nodeId = String.fromCharCode(65 + i);
        nodes.push({
          id: nodeId,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          label: nodeId,
          isStart: i === 0
        });
        const nextId = String.fromCharCode(65 + ((i + 1) % nodeCount));
        edges.push({ from: nodeId, to: nextId });
      }
    } else if (template.name === 'Sao') {
      const outerCount = (config.nodeCount || 6) - 1;
      const radius = previewRadius;
      // Center node
      nodes.push({
        id: 'A',
        x: centerX,
        y: centerY,
        label: 'A',
        isStart: true
      });
      // Outer nodes
      for (let i = 0; i < outerCount; i++) {
        const angle = (2 * Math.PI * i) / outerCount;
        const nodeId = String.fromCharCode(66 + i);
        nodes.push({
          id: nodeId,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          label: nodeId,
          isStart: false
        });
        edges.push({ from: 'A', to: nodeId });
      }
    } else if (template.name === 'Đồ thị đầy đủ') {
      const nodeCount = config.nodeCount || 5;
      const radius = previewRadius;
      for (let i = 0; i < nodeCount; i++) {
        const angle = (2 * Math.PI * i) / nodeCount;
        const nodeId = String.fromCharCode(65 + i);
        nodes.push({
          id: nodeId,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          label: nodeId,
          isStart: i === 0
        });
      }
      // All pairs
      for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
          edges.push({
            from: String.fromCharCode(65 + i),
            to: String.fromCharCode(65 + j)
          });
        }
      }
    } else if (template.name.includes('Lưới')) {
      // Grid preview
      const rows = template.name.includes('2x2') ? 2 : 3;
      const cols = template.name.includes('2x2') ? 2 : 3;
      const spacing = previewSpacing * 0.75;
      const startX = 50;
      const startY = 50;
      let nodeIndex = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const nodeId = String.fromCharCode(65 + nodeIndex);
          nodes.push({
            id: nodeId,
            x: startX + col * spacing,
            y: startY + row * spacing,
            label: nodeId,
            isStart: row === 0 && col === 0
          });
          nodeIndex++;
        }
      }
      // Grid edges
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const currentIndex = row * cols + col;
          if (col < cols - 1) {
            edges.push({
              from: String.fromCharCode(65 + currentIndex),
              to: String.fromCharCode(65 + currentIndex + 1)
            });
          }
          if (row < rows - 1) {
            edges.push({
              from: String.fromCharCode(65 + currentIndex),
              to: String.fromCharCode(65 + currentIndex + cols)
            });
          }
        }
      }
    }

    // Draw edges
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return;

      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const angle = Math.atan2(dy, dx);

      const startX = fromNode.x + Math.cos(angle) * nodeRadius;
      const startY = fromNode.y + Math.sin(angle) * nodeRadius;
      const endX = toNode.x - Math.cos(angle) * nodeRadius;
      const endY = toNode.y - Math.sin(angle) * nodeRadius;

      ctx.strokeStyle = this.edgeColor();
      ctx.lineWidth = this.edgeThickness();
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Draw arrow
      if (config.direction === 'forward' || config.direction === 'bidirectional') {
        this.drawArrowForContext(ctx, endX, endY, angle, false);
      }
      if (config.direction === 'backward' || config.direction === 'bidirectional') {
        this.drawArrowForContext(ctx, startX, startY, angle + Math.PI, false);
      }

      // Draw weight
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(midX - 12, midY - 8, 24, 16);
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((config.edgeWeight || 1).toString(), midX, midY);
    });

    // Draw nodes
    nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);

      if (node.isStart) {
        ctx.fillStyle = this.startNodeColor();
      } else {
        ctx.fillStyle = this.nodeColor();
      }

      ctx.fill();
      ctx.strokeStyle = this.nodeBorderColor();
      ctx.lineWidth = this.nodeBorderWidth();
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, node.x, node.y);
    });
  }

  updateTemplateConfigEdgeWeight(value: number) {
    const config = this.templateConfig();
    this.templateConfig.set({
      ...config,
      edgeWeight: value
    });
  }

  updateTemplateConfigDirection(value: 'forward' | 'backward' | 'bidirectional') {
    const config = this.templateConfig();
    this.templateConfig.set({
      ...config,
      direction: value
    });
  }

  updateTemplateConfigNodeCount(value: number) {
    const config = this.templateConfig();
    this.templateConfig.set({
      ...config,
      nodeCount: value
    });
  }

  updateTemplateConfigStarOuterCount(value: number) {
    const config = this.templateConfig();
    this.templateConfig.set({
      ...config,
      nodeCount: value + 1 // Total nodes = outer + 1 center
    });
  }

  updateTemplateConfigDensity(value: 'sparse' | 'medium' | 'dense' | 'very-dense') {
    const config = this.templateConfig();
    this.templateConfig.set({
      ...config,
      density: value
    });
  }

  getDensityValue(density: string): number {
    switch (density) {
      case 'sparse': return 1;
      case 'medium': return 3;
      case 'dense': return 4;
      case 'very-dense': return 5;
      default: return 3;
    }
  }

  updateTemplateConfigDensityFromSlider(value: number) {
    let density: 'sparse' | 'medium' | 'dense' | 'very-dense';
    if (value <= 1) density = 'sparse';
    else if (value <= 2) density = 'medium';
    else if (value <= 4) density = 'dense';
    else density = 'very-dense';
    this.updateTemplateConfigDensity(density);
  }

  applyTemplateWithConfig() {
    const template = this.selectedTemplate();
    const config = this.templateConfig();
    
    if (!template || !template.template) return;

    const density = config.density || 'medium';
    const spacing = this.getDensitySpacing(density);
    const radius = this.getDensityRadius(density);

    // Get current max node counter to continue numbering
    const currentMaxCounter = this.nodeCounter();
    const currentMaxEdgeCounter = this.edgeCounter();

    // Apply the template with config (don't clear existing graph)
    if (template.name === 'Đồ thị đầy đủ' && config.nodeCount) {
      this.createCompleteGraph(config.nodeCount, config.edgeWeight || 1, config.direction || 'bidirectional', radius);
    } else if (template.name === 'Sao' && config.nodeCount) {
      this.createStarGraph(config.nodeCount - 1, config.edgeWeight || 1, config.direction || 'bidirectional', radius);
    } else if (template.name === 'Vòng tròn' && config.nodeCount) {
      this.createCycleGraph(config.nodeCount, config.edgeWeight || 1, config.direction || 'bidirectional', radius);
    } else if (template.name === 'Đường thẳng' && config.nodeCount) {
      this.createLinearGraph(config.nodeCount, config.edgeWeight || 1, config.direction || 'bidirectional', spacing);
    } else if (template.name.includes('Lưới')) {
      // Grid templates
      const rows = template.name.includes('2x2') ? 2 : template.name.includes('3x3') ? 3 : 4;
      const cols = template.name.includes('2x2') ? 2 : template.name.includes('3x3') ? 3 : 4;
      this.createGridGraph(rows, cols, config.edgeWeight || 1, config.direction || 'bidirectional', spacing);
    } else if (template.name === 'Cây nhị phân') {
      this.createBinaryTree(3, config.edgeWeight || 1, config.direction || 'bidirectional', spacing);
    } else if (template.name === 'Đồ thị hai phía') {
      this.createBipartiteGraph(3, 3, config.edgeWeight || 1, config.direction || 'bidirectional', spacing);
    } else if (template.name === 'Đồ thị hình thang') {
      this.createTrapezoidGraph(5, config.edgeWeight || 1, config.direction || 'bidirectional', spacing);
    } else if (template.name === 'Đồ thị bánh xe') {
      this.createWheelGraph(6, config.edgeWeight || 1, config.direction || 'bidirectional', radius);
    } else if (template.name === 'Đồ thị lục giác') {
      this.createHexagonalGraph(3, config.edgeWeight || 1, config.direction || 'bidirectional', spacing);
    } else {
      // For default, just apply and update edges
      template.template();
      const edges = this.edges();
      const updatedEdges = edges.map(edge => ({
        ...edge,
        weight: config.edgeWeight || edge.weight,
        direction: config.direction || edge.direction
      }));
      this.edges.set(updatedEdges);
    }

    this.showGraphTemplatesDialog.set(false);
    this.templateDialogStep.set(1);
    this.selectedTemplate.set(null);
    this.templateConfig.set({});
    this.drawGraph();
  }

  // Zoom controls - zoom from center of viewport
  zoomIn() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const oldZoom = this.zoomLevel();
    const newZoom = Math.min(3, oldZoom * 1.2);
    const zoomFactor = newZoom / oldZoom;

    // Get center of viewport in screen coordinates
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Convert to world coordinates before zoom
    const worldX = centerX / oldZoom - this.panOffset().x;
    const worldY = centerY / oldZoom - this.panOffset().y;

    // Calculate new pan offset to keep center point fixed
    const newPanX = centerX / newZoom - worldX;
    const newPanY = centerY / newZoom - worldY;

    this.zoomLevel.set(newZoom);
    this.panOffset.set({ x: newPanX, y: newPanY });
    this.drawGraph();
  }

  zoomOut() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const oldZoom = this.zoomLevel();
    const newZoom = Math.max(0.5, oldZoom / 1.2);
    const zoomFactor = newZoom / oldZoom;

    // Get center of viewport in screen coordinates
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Convert to world coordinates before zoom
    const worldX = centerX / oldZoom - this.panOffset().x;
    const worldY = centerY / oldZoom - this.panOffset().y;

    // Calculate new pan offset to keep center point fixed
    const newPanX = centerX / newZoom - worldX;
    const newPanY = centerY / newZoom - worldY;

    this.zoomLevel.set(newZoom);
    this.panOffset.set({ x: newPanX, y: newPanY });
    this.drawGraph();
  }

  resetZoom() {
    this.zoomLevel.set(1);
    this.panOffset.set({ x: 0, y: 0 });
    this.drawGraph();
  }

  fitToView() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const nodes = this.nodes();
    if (nodes.length === 0) {
      this.resetZoom();
      return;
    }

    // Find bounding box of all nodes
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    const nodeRadius = this.nodeRadius();
    const padding = 50; // Padding around nodes

    nodes.forEach(node => {
      minX = Math.min(minX, node.x - nodeRadius);
      maxX = Math.max(maxX, node.x + nodeRadius);
      minY = Math.min(minY, node.y - nodeRadius);
      maxY = Math.max(maxY, node.y + nodeRadius);
    });

    // Add padding
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Calculate zoom level to fit graph in viewport
    const zoomX = canvasWidth / graphWidth;
    const zoomY = canvasHeight / graphHeight;
    const newZoom = Math.min(zoomX, zoomY, 2); // Cap zoom at 2x

    // Calculate center of graph
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate pan offset to center graph
    const newPanX = (canvasWidth / 2) / newZoom - centerX;
    const newPanY = (canvasHeight / 2) / newZoom - centerY;

    this.zoomLevel.set(newZoom);
    this.panOffset.set({ x: newPanX, y: newPanY });
    this.drawGraph();
  }

  // Pan to ensure element is in viewport
  panToElement(worldX: number, worldY: number, padding: number = 50) {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const zoom = this.zoomLevel();
    const currentPan = this.panOffset();

    // Convert world coordinates to screen coordinates
    const screenX = (worldX + currentPan.x) * zoom;
    const screenY = (worldY + currentPan.y) * zoom;

    // Check if element is outside viewport
    let newPanX = currentPan.x;
    let newPanY = currentPan.y;

    // Check left/right bounds
    if (screenX < padding) {
      newPanX = (padding / zoom) - worldX;
    } else if (screenX > canvas.width - padding) {
      newPanX = ((canvas.width - padding) / zoom) - worldX;
    }

    // Check top/bottom bounds
    if (screenY < padding) {
      newPanY = (padding / zoom) - worldY;
    } else if (screenY > canvas.height - padding) {
      newPanY = ((canvas.height - padding) / zoom) - worldY;
    }

    // Only update if pan changed
    if (newPanX !== currentPan.x || newPanY !== currentPan.y) {
      this.panOffset.set({ x: newPanX, y: newPanY });
      this.drawGraph();
    }
  }

  // Select step and highlight corresponding node/edge
  selectStep(stepIndex: number) {
    this.currentStep.set(stepIndex);
    const step = this.algorithmSteps()[stepIndex];
    if (!step) return;

    // Clear previous highlights
    this.highlightedStepNode.set(null);
    this.highlightedStepEdge.set(null);

    // Highlight current node if exists
    if (step.current) {
      this.highlightedStepNode.set(step.current);
      const node = this.nodes().find(n => n.id === step.current);
      if (node) {
        this.panToElement(node.x, node.y);
      }
    }

    // Highlight updated node if exists
    if (step.updated) {
      this.highlightedStepNode.set(step.updated);
      const node = this.nodes().find(n => n.id === step.updated);
      if (node) {
        this.panToElement(node.x, node.y);
      }
    }

    // Highlight edge if considering an edge
    if (step.from && step.to) {
      this.highlightedStepEdge.set({ from: step.from, to: step.to });
      const fromNode = this.nodes().find(n => n.id === step.from);
      const toNode = this.nodes().find(n => n.id === step.to);
      if (fromNode && toNode) {
        // Pan to center of edge
        const centerX = (fromNode.x + toNode.x) / 2;
        const centerY = (fromNode.y + toNode.y) / 2;
        this.panToElement(centerX, centerY);
      }
    }

    this.drawGraph();
  }

  createLinearGraph(nodeCount: number = 4, edgeWeight: number = 1, direction: 'forward' | 'backward' | 'bidirectional' = 'bidirectional', spacing: number = 150) {
    const existingNodes = this.nodes();
    const existingEdges = this.edges();
    const nodes: GraphNode[] = [...existingNodes];
    const edges: GraphEdge[] = [...existingEdges];
    const canvas = this.canvasRef?.nativeElement;
    
    // Calculate starting position based on existing nodes or viewport center
    let startX = 100;
    let startY = canvas ? canvas.height / 2 : 300;
    
    if (existingNodes.length > 0) {
      // Find the rightmost node and start from there
      const rightmostNode = existingNodes.reduce((max, node) => node.x > max.x ? node : max);
      startX = rightmostNode.x + spacing * 2;
      startY = rightmostNode.y;
    } else {
      // Use viewport center in world coordinates
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      startX = (canvas ? canvas.width / 2 : 400) / zoom - pan.x;
      startY = (canvas ? canvas.height / 2 : 300) / zoom - pan.y;
    }

    const currentMaxCounter = this.nodeCounter();
    let nodeIndex = 0;

    for (let i = 0; i < nodeCount; i++) {
      const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + i);
      nodes.push({
        id: nodeId,
        x: startX + i * spacing,
        y: startY,
        label: nodeId,
        isStart: i === 0 && existingNodes.length === 0,
        isEnd: i === nodeCount - 1 && existingNodes.length === 0
      });

      if (i > 0) {
        const prevNodeId = this.getNodeLabelFromIndex(currentMaxCounter + i - 1);
        edges.push({
          id: `edge-${this.edgeCounter() + nodeIndex}`,
          from: prevNodeId,
          to: nodeId,
          weight: edgeWeight,
          direction: direction
        });
        nodeIndex++;
      }
    }

    this.nodes.set(nodes);
    this.edges.set(edges);
    this.nodeCounter.set(currentMaxCounter + nodeCount);
    this.edgeCounter.set(this.edgeCounter() + nodeIndex);
    if (existingNodes.length === 0) {
      this.startNode.set(this.getNodeLabelFromIndex(currentMaxCounter));
      this.endNode.set(this.getNodeLabelFromIndex(currentMaxCounter + nodeCount - 1));
    }
    this.drawGraph();
  }

  createCycleGraph(nodeCount: number = 4, edgeWeight: number = 1, direction: 'forward' | 'backward' | 'bidirectional' = 'bidirectional', radius: number = 120) {
    const existingNodes = this.nodes();
    const existingEdges = this.edges();
    const nodes: GraphNode[] = [...existingNodes];
    const edges: GraphEdge[] = [...existingEdges];
    const canvas = this.canvasRef?.nativeElement;
    
    // Calculate center position based on existing nodes or viewport center
    let centerX = canvas ? canvas.width / 2 : 400;
    let centerY = canvas ? canvas.height / 2 : 300;
    
    if (existingNodes.length > 0) {
      // Find the rightmost node and place cycle to the right
      const rightmostNode = existingNodes.reduce((max, node) => node.x > max.x ? node : max);
      centerX = rightmostNode.x + radius * 2;
      centerY = rightmostNode.y;
    } else {
      // Use viewport center in world coordinates
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      centerX = (canvas ? canvas.width / 2 : 400) / zoom - pan.x;
      centerY = (canvas ? canvas.height / 2 : 300) / zoom - pan.y;
    }

    const currentMaxCounter = this.nodeCounter();

    for (let i = 0; i < nodeCount; i++) {
      const angle = (2 * Math.PI * i) / nodeCount;
      const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + i);
      nodes.push({
        id: nodeId,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        label: nodeId,
        isStart: i === 0 && existingNodes.length === 0,
        isEnd: i === Math.floor(nodeCount / 2) && existingNodes.length === 0
      });

      const nextId = this.getNodeLabelFromIndex(currentMaxCounter + ((i + 1) % nodeCount));
      edges.push({
        id: `edge-${this.edgeCounter() + i}`,
        from: nodeId,
        to: nextId,
        weight: edgeWeight,
        direction: direction
      });
    }

    this.nodes.set(nodes);
    this.edges.set(edges);
    this.nodeCounter.set(currentMaxCounter + nodeCount);
    this.edgeCounter.set(this.edgeCounter() + nodeCount);
    if (existingNodes.length === 0) {
      this.startNode.set(this.getNodeLabelFromIndex(currentMaxCounter));
      this.endNode.set(this.getNodeLabelFromIndex(currentMaxCounter + Math.floor(nodeCount / 2)));
    }
    this.drawGraph();
  }

  createStarGraph(outerNodeCount: number = 5, edgeWeight: number = 1, direction: 'forward' | 'backward' | 'bidirectional' = 'bidirectional', radius: number = 120) {
    const existingNodes = this.nodes();
    const existingEdges = this.edges();
    const nodes: GraphNode[] = [...existingNodes];
    const edges: GraphEdge[] = [...existingEdges];
    const canvas = this.canvasRef?.nativeElement;
    
    // Calculate center position based on existing nodes or viewport center
    let centerX = canvas ? canvas.width / 2 : 400;
    let centerY = canvas ? canvas.height / 2 : 300;
    
    if (existingNodes.length > 0) {
      // Find the rightmost node and place star to the right
      const rightmostNode = existingNodes.reduce((max, node) => node.x > max.x ? node : max);
      centerX = rightmostNode.x + radius * 2;
      centerY = rightmostNode.y;
    } else {
      // Use viewport center in world coordinates
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      centerX = (canvas ? canvas.width / 2 : 400) / zoom - pan.x;
      centerY = (canvas ? canvas.height / 2 : 300) / zoom - pan.y;
    }

    const currentMaxCounter = this.nodeCounter();

    // Center node
    const centerNodeId = this.getNodeLabelFromIndex(currentMaxCounter);
    nodes.push({
      id: centerNodeId,
      x: centerX,
      y: centerY,
      label: centerNodeId,
      isStart: existingNodes.length === 0,
      isEnd: false
    });

    // Outer nodes
    for (let i = 0; i < outerNodeCount; i++) {
      const angle = (2 * Math.PI * i) / outerNodeCount;
      const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + 1 + i);
      nodes.push({
        id: nodeId,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        label: nodeId,
        isStart: false,
        isEnd: i === Math.floor(outerNodeCount / 2) && existingNodes.length === 0
      });

      edges.push({
        id: `edge-${this.edgeCounter() + i}`,
        from: centerNodeId,
        to: nodeId,
        weight: edgeWeight,
        direction: direction
      });
    }

    this.nodes.set(nodes);
    this.edges.set(edges);
    this.nodeCounter.set(currentMaxCounter + 1 + outerNodeCount);
    this.edgeCounter.set(this.edgeCounter() + outerNodeCount);
    if (existingNodes.length === 0) {
      this.startNode.set(centerNodeId);
      const endNodeId = this.getNodeLabelFromIndex(currentMaxCounter + 1 + Math.floor(outerNodeCount / 2));
      this.endNode.set(endNodeId);
    }
    this.drawGraph();
  }

  createCompleteGraph(nodeCount: number = 5, edgeWeight: number = 1, direction: 'forward' | 'backward' | 'bidirectional' = 'bidirectional', radius: number = 120) {
    const existingNodes = this.nodes();
    const existingEdges = this.edges();
    const nodes: GraphNode[] = [...existingNodes];
    const edges: GraphEdge[] = [...existingEdges];
    const canvas = this.canvasRef?.nativeElement;
    
    // Calculate center position based on existing nodes or viewport center
    let centerX = canvas ? canvas.width / 2 : 400;
    let centerY = canvas ? canvas.height / 2 : 300;
    
    if (existingNodes.length > 0) {
      // Find the rightmost node and place complete graph to the right
      const rightmostNode = existingNodes.reduce((max, node) => node.x > max.x ? node : max);
      centerX = rightmostNode.x + radius * 2;
      centerY = rightmostNode.y;
    } else {
      // Use viewport center in world coordinates
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      centerX = (canvas ? canvas.width / 2 : 400) / zoom - pan.x;
      centerY = (canvas ? canvas.height / 2 : 300) / zoom - pan.y;
    }

    const currentMaxCounter = this.nodeCounter();

    // Create nodes in circle
    for (let i = 0; i < nodeCount; i++) {
      const angle = (2 * Math.PI * i) / nodeCount;
      const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + i);
      nodes.push({
        id: nodeId,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        label: nodeId,
        isStart: i === 0 && existingNodes.length === 0,
        isEnd: i === Math.floor(nodeCount / 2) && existingNodes.length === 0
      });
    }

    // Create edges between all nodes
    let edgeIndex = 0;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const fromNodeId = this.getNodeLabelFromIndex(currentMaxCounter + i);
        const toNodeId = this.getNodeLabelFromIndex(currentMaxCounter + j);
        edges.push({
          id: `edge-${this.edgeCounter() + edgeIndex}`,
          from: fromNodeId,
          to: toNodeId,
          weight: edgeWeight,
          direction: direction
        });
        edgeIndex++;
      }
    }

    this.nodes.set(nodes);
    this.edges.set(edges);
    this.nodeCounter.set(currentMaxCounter + nodeCount);
    this.edgeCounter.set(this.edgeCounter() + edgeIndex);
    if (existingNodes.length === 0) {
      this.startNode.set(this.getNodeLabelFromIndex(currentMaxCounter));
      this.endNode.set(this.getNodeLabelFromIndex(currentMaxCounter + Math.floor(nodeCount / 2)));
    }
    this.drawGraph();
  }

  createGridGraph(rows: number, cols: number, edgeWeight: number = 1, direction: 'forward' | 'backward' | 'bidirectional' = 'bidirectional', spacing: number = 120) {
    const existingNodes = this.nodes();
    const existingEdges = this.edges();
    const nodes: GraphNode[] = [...existingNodes];
    const edges: GraphEdge[] = [...existingEdges];
    const canvas = this.canvasRef?.nativeElement;
    
    // Calculate starting position based on existing nodes or viewport
    let startX = 150;
    let startY = 150;
    
    if (existingNodes.length > 0) {
      // Find the rightmost node and place grid to the right
      const rightmostNode = existingNodes.reduce((max, node) => node.x > max.x ? node : max);
      startX = rightmostNode.x + spacing * 2;
      startY = rightmostNode.y;
    } else {
      // Use viewport center in world coordinates
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      startX = (canvas ? 150 : 150) / zoom - pan.x;
      startY = (canvas ? 150 : 150) / zoom - pan.y;
    }

    const currentMaxCounter = this.nodeCounter();

    let nodeIndex = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + nodeIndex);
        nodes.push({
          id: nodeId,
          x: startX + col * spacing,
          y: startY + row * spacing,
          label: nodeId,
          isStart: row === 0 && col === 0 && existingNodes.length === 0,
          isEnd: row === rows - 1 && col === cols - 1 && existingNodes.length === 0
        });
        nodeIndex++;
      }
    }

    let edgeIndex = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const currentIndex = row * cols + col;
        const currentNode = this.getNodeLabelFromIndex(currentMaxCounter + currentIndex);

        // Right edge
        if (col < cols - 1) {
          const rightIndex = row * cols + (col + 1);
          const rightNode = this.getNodeLabelFromIndex(currentMaxCounter + rightIndex);
          edges.push({
            id: `edge-${this.edgeCounter() + edgeIndex}`,
            from: currentNode,
            to: rightNode,
            weight: edgeWeight,
            direction: direction
          });
          edgeIndex++;
        }

        // Down edge
        if (row < rows - 1) {
          const downIndex = (row + 1) * cols + col;
          const downNode = this.getNodeLabelFromIndex(currentMaxCounter + downIndex);
          edges.push({
            id: `edge-${this.edgeCounter() + edgeIndex}`,
            from: currentNode,
            to: downNode,
            weight: edgeWeight,
            direction: direction
          });
          edgeIndex++;
        }
      }
    }

    this.nodes.set(nodes);
    this.edges.set(edges);
    this.nodeCounter.set(currentMaxCounter + nodeIndex);
    this.edgeCounter.set(this.edgeCounter() + edgeIndex);
    if (existingNodes.length === 0) {
      this.startNode.set(this.getNodeLabelFromIndex(currentMaxCounter));
      this.endNode.set(this.getNodeLabelFromIndex(currentMaxCounter + (rows * cols - 1)));
    }
    this.drawGraph();
  }

  createBinaryTree(levels: number = 3, edgeWeight: number = 1, direction: 'forward' | 'backward' | 'bidirectional' = 'bidirectional', spacing: number = 120) {
    const existingNodes = this.nodes();
    const existingEdges = this.edges();
    const nodes: GraphNode[] = [...existingNodes];
    const edges: GraphEdge[] = [...existingEdges];
    const canvas = this.canvasRef?.nativeElement;
    
    let startX = canvas ? canvas.width / 2 : 400;
    let startY = 100;
    
    if (existingNodes.length > 0) {
      const rightmostNode = existingNodes.reduce((max, node) => node.x > max.x ? node : max);
      startX = rightmostNode.x + spacing * 3;
      startY = rightmostNode.y;
    } else {
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      startX = (canvas ? canvas.width / 2 : 400) / zoom - pan.x;
      startY = (canvas ? 100 : 100) / zoom - pan.y;
    }

    const currentMaxCounter = this.nodeCounter();
    let nodeIndex = 0;
    const nodeMap: Record<number, string> = {};

    for (let level = 0; level < levels; level++) {
      const nodesInLevel = Math.pow(2, level);
      const levelWidth = nodesInLevel * spacing;
      const levelStartX = startX - levelWidth / 2 + spacing / 2;

      for (let i = 0; i < nodesInLevel; i++) {
        const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + nodeIndex);
        const x = levelStartX + i * spacing;
        const y = startY + level * spacing * 1.5;
        
        nodes.push({
          id: nodeId,
          x,
          y,
          label: nodeId,
          isStart: level === 0 && i === 0 && existingNodes.length === 0,
          isEnd: level === levels - 1 && i === nodesInLevel - 1 && existingNodes.length === 0
        });

        nodeMap[level * 100 + i] = nodeId;

        if (level > 0) {
          const parentIndex = Math.floor(i / 2);
          const parentId = nodeMap[(level - 1) * 100 + parentIndex];
          edges.push({
            id: `edge-${this.edgeCounter() + nodeIndex}`,
            from: parentId,
            to: nodeId,
            weight: edgeWeight,
            direction: direction
          });
        }
        nodeIndex++;
      }
    }

    this.nodes.set(nodes);
    this.edges.set(edges);
    this.nodeCounter.set(currentMaxCounter + nodeIndex);
    this.edgeCounter.set(this.edgeCounter() + nodeIndex - 1);
    if (existingNodes.length === 0) {
      this.startNode.set(this.getNodeLabelFromIndex(currentMaxCounter));
      this.endNode.set(this.getNodeLabelFromIndex(currentMaxCounter + nodeIndex - 1));
    }
    this.drawGraph();
  }

  createBipartiteGraph(leftCount: number = 3, rightCount: number = 3, edgeWeight: number = 1, direction: 'forward' | 'backward' | 'bidirectional' = 'bidirectional', spacing: number = 120) {
    const existingNodes = this.nodes();
    const existingEdges = this.edges();
    const nodes: GraphNode[] = [...existingNodes];
    const edges: GraphEdge[] = [...existingEdges];
    const canvas = this.canvasRef?.nativeElement;
    
    let centerX = canvas ? canvas.width / 2 : 400;
    let centerY = canvas ? canvas.height / 2 : 300;
    
    if (existingNodes.length > 0) {
      const rightmostNode = existingNodes.reduce((max, node) => node.x > max.x ? node : max);
      centerX = rightmostNode.x + spacing * 2;
      centerY = rightmostNode.y;
    } else {
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      centerX = (canvas ? canvas.width / 2 : 400) / zoom - pan.x;
      centerY = (canvas ? canvas.height / 2 : 300) / zoom - pan.y;
    }

    const currentMaxCounter = this.nodeCounter();
    const leftNodes: string[] = [];
    const rightNodes: string[] = [];

    // Create left nodes
    for (let i = 0; i < leftCount; i++) {
      const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + i);
      leftNodes.push(nodeId);
      nodes.push({
        id: nodeId,
        x: centerX - spacing,
        y: centerY - (leftCount - 1) * spacing / 2 + i * spacing,
        label: nodeId,
        isStart: i === 0 && existingNodes.length === 0
      });
    }

    // Create right nodes
    for (let i = 0; i < rightCount; i++) {
      const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + leftCount + i);
      rightNodes.push(nodeId);
      nodes.push({
        id: nodeId,
        x: centerX + spacing,
        y: centerY - (rightCount - 1) * spacing / 2 + i * spacing,
        label: nodeId,
        isEnd: i === 0 && existingNodes.length === 0
      });
    }

    // Connect all left nodes to all right nodes
    let edgeIndex = 0;
    for (const leftNode of leftNodes) {
      for (const rightNode of rightNodes) {
        edges.push({
          id: `edge-${this.edgeCounter() + edgeIndex}`,
          from: leftNode,
          to: rightNode,
          weight: edgeWeight,
          direction: direction
        });
        edgeIndex++;
      }
    }

    this.nodes.set(nodes);
    this.edges.set(edges);
    this.nodeCounter.set(currentMaxCounter + leftCount + rightCount);
    this.edgeCounter.set(this.edgeCounter() + edgeIndex);
    if (existingNodes.length === 0) {
      this.startNode.set(leftNodes[0]);
      this.endNode.set(rightNodes[0]);
    }
    this.drawGraph();
  }

  createTrapezoidGraph(nodeCount: number = 5, edgeWeight: number = 1, direction: 'forward' | 'backward' | 'bidirectional' = 'bidirectional', spacing: number = 120) {
    const existingNodes = this.nodes();
    const existingEdges = this.edges();
    const nodes: GraphNode[] = [...existingNodes];
    const edges: GraphEdge[] = [...existingEdges];
    const canvas = this.canvasRef?.nativeElement;
    
    let centerX = canvas ? canvas.width / 2 : 400;
    let centerY = canvas ? canvas.height / 2 : 300;
    
    if (existingNodes.length > 0) {
      const rightmostNode = existingNodes.reduce((max, node) => node.x > max.x ? node : max);
      centerX = rightmostNode.x + spacing * 2;
      centerY = rightmostNode.y;
    } else {
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      centerX = (canvas ? canvas.width / 2 : 400) / zoom - pan.x;
      centerY = (canvas ? canvas.height / 2 : 300) / zoom - pan.y;
    }

    const currentMaxCounter = this.nodeCounter();
    const topNodes: string[] = [];
    const bottomNodes: string[] = [];

    // Top row
    for (let i = 0; i < nodeCount; i++) {
      const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + i);
      topNodes.push(nodeId);
      nodes.push({
        id: nodeId,
        x: centerX - (nodeCount - 1) * spacing / 2 + i * spacing,
        y: centerY - spacing,
        label: nodeId,
        isStart: i === 0 && existingNodes.length === 0
      });
    }

    // Bottom row
    for (let i = 0; i < nodeCount; i++) {
      const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + nodeCount + i);
      bottomNodes.push(nodeId);
      nodes.push({
        id: nodeId,
        x: centerX - (nodeCount - 1) * spacing / 2 + i * spacing,
        y: centerY + spacing,
        label: nodeId,
        isEnd: i === 0 && existingNodes.length === 0
      });
    }

    // Connect top to bottom
    let edgeIndex = 0;
    for (let i = 0; i < nodeCount; i++) {
      edges.push({
        id: `edge-${this.edgeCounter() + edgeIndex}`,
        from: topNodes[i],
        to: bottomNodes[i],
        weight: edgeWeight,
        direction: direction
      });
      edgeIndex++;
    }

    // Connect adjacent nodes in each row
    for (let i = 0; i < nodeCount - 1; i++) {
      edges.push({
        id: `edge-${this.edgeCounter() + edgeIndex}`,
        from: topNodes[i],
        to: topNodes[i + 1],
        weight: edgeWeight,
        direction: direction
      });
      edgeIndex++;
      edges.push({
        id: `edge-${this.edgeCounter() + edgeIndex}`,
        from: bottomNodes[i],
        to: bottomNodes[i + 1],
        weight: edgeWeight,
        direction: direction
      });
      edgeIndex++;
    }

    this.nodes.set(nodes);
    this.edges.set(edges);
    this.nodeCounter.set(currentMaxCounter + nodeCount * 2);
    this.edgeCounter.set(this.edgeCounter() + edgeIndex);
    if (existingNodes.length === 0) {
      this.startNode.set(topNodes[0]);
      this.endNode.set(bottomNodes[0]);
    }
    this.drawGraph();
  }

  createWheelGraph(outerNodeCount: number = 6, edgeWeight: number = 1, direction: 'forward' | 'backward' | 'bidirectional' = 'bidirectional', radius: number = 120) {
    const existingNodes = this.nodes();
    const existingEdges = this.edges();
    const nodes: GraphNode[] = [...existingNodes];
    const edges: GraphEdge[] = [...existingEdges];
    const canvas = this.canvasRef?.nativeElement;
    
    let centerX = canvas ? canvas.width / 2 : 400;
    let centerY = canvas ? canvas.height / 2 : 300;
    
    if (existingNodes.length > 0) {
      const rightmostNode = existingNodes.reduce((max, node) => node.x > max.x ? node : max);
      centerX = rightmostNode.x + radius * 2;
      centerY = rightmostNode.y;
    } else {
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      centerX = (canvas ? canvas.width / 2 : 400) / zoom - pan.x;
      centerY = (canvas ? canvas.height / 2 : 300) / zoom - pan.y;
    }

    const currentMaxCounter = this.nodeCounter();
    const centerNodeId = this.getNodeLabelFromIndex(currentMaxCounter);
    const outerNodes: string[] = [];

    // Center node
    nodes.push({
      id: centerNodeId,
      x: centerX,
      y: centerY,
      label: centerNodeId,
      isStart: existingNodes.length === 0
    });

    // Outer nodes
    for (let i = 0; i < outerNodeCount; i++) {
      const angle = (2 * Math.PI * i) / outerNodeCount;
      const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + 1 + i);
      outerNodes.push(nodeId);
      nodes.push({
        id: nodeId,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        label: nodeId,
        isEnd: i === 0 && existingNodes.length === 0
      });

      // Connect to center
      edges.push({
        id: `edge-${this.edgeCounter() + i}`,
        from: centerNodeId,
        to: nodeId,
        weight: edgeWeight,
        direction: direction
      });
    }

    // Connect outer nodes in cycle
    let edgeIndex = outerNodeCount;
    for (let i = 0; i < outerNodeCount; i++) {
      edges.push({
        id: `edge-${this.edgeCounter() + edgeIndex}`,
        from: outerNodes[i],
        to: outerNodes[(i + 1) % outerNodeCount],
        weight: edgeWeight,
        direction: direction
      });
      edgeIndex++;
    }

    this.nodes.set(nodes);
    this.edges.set(edges);
    this.nodeCounter.set(currentMaxCounter + 1 + outerNodeCount);
    this.edgeCounter.set(this.edgeCounter() + edgeIndex);
    if (existingNodes.length === 0) {
      this.startNode.set(centerNodeId);
      this.endNode.set(outerNodes[0]);
    }
    this.drawGraph();
  }

  createHexagonalGraph(hexCount: number = 3, edgeWeight: number = 1, direction: 'forward' | 'backward' | 'bidirectional' = 'bidirectional', spacing: number = 120) {
    const existingNodes = this.nodes();
    const existingEdges = this.edges();
    const nodes: GraphNode[] = [...existingNodes];
    const edges: GraphEdge[] = [...existingEdges];
    const canvas = this.canvasRef?.nativeElement;
    
    let startX = canvas ? canvas.width / 2 : 400;
    let startY = canvas ? canvas.height / 2 : 300;
    
    if (existingNodes.length > 0) {
      const rightmostNode = existingNodes.reduce((max, node) => node.x > max.x ? node : max);
      startX = rightmostNode.x + spacing * 2;
      startY = rightmostNode.y;
    } else {
      const zoom = this.zoomLevel();
      const pan = this.panOffset();
      startX = (canvas ? canvas.width / 2 : 400) / zoom - pan.x;
      startY = (canvas ? canvas.height / 2 : 300) / zoom - pan.y;
    }

    const currentMaxCounter = this.nodeCounter();
    let nodeIndex = 0;
    const hexRadius = spacing / 2;

    // Create hexagonal pattern
    for (let ring = 0; ring < hexCount; ring++) {
      const ringRadius = ring * spacing * 1.5;
      const nodesInRing = ring === 0 ? 1 : ring * 6;

      for (let i = 0; i < nodesInRing; i++) {
        const angle = ring === 0 ? 0 : (2 * Math.PI * i) / nodesInRing;
        const nodeId = this.getNodeLabelFromIndex(currentMaxCounter + nodeIndex);
        nodes.push({
          id: nodeId,
          x: startX + ringRadius * Math.cos(angle),
          y: startY + ringRadius * Math.sin(angle),
          label: nodeId,
          isStart: ring === 0 && i === 0 && existingNodes.length === 0,
          isEnd: ring === hexCount - 1 && i === nodesInRing - 1 && existingNodes.length === 0
        });
        nodeIndex++;
      }
    }

    // Connect nodes (simplified - connect each node to nearest neighbors)
    let edgeIndex = 0;
    for (let i = 0; i < nodes.length - currentMaxCounter; i++) {
      const node1 = nodes[nodes.length - nodeIndex + i];
      for (let j = i + 1; j < nodes.length - currentMaxCounter; j++) {
        const node2 = nodes[nodes.length - nodeIndex + j];
        const dist = Math.sqrt((node1.x - node2.x) ** 2 + (node1.y - node2.y) ** 2);
        if (dist < spacing * 1.2) {
          edges.push({
            id: `edge-${this.edgeCounter() + edgeIndex}`,
            from: node1.id,
            to: node2.id,
            weight: edgeWeight,
            direction: direction
          });
          edgeIndex++;
        }
      }
    }

    this.nodes.set(nodes);
    this.edges.set(edges);
    this.nodeCounter.set(currentMaxCounter + nodeIndex);
    this.edgeCounter.set(this.edgeCounter() + edgeIndex);
    if (existingNodes.length === 0) {
      this.startNode.set(this.getNodeLabelFromIndex(currentMaxCounter));
      this.endNode.set(this.getNodeLabelFromIndex(currentMaxCounter + nodeIndex - 1));
    }
    this.drawGraph();
  }

  // Export/Import Methods
  getMatrixExportData(): string {
    const nodes = this.nodes();
    const edges = this.edges();
    const nodeIds = nodes.map(n => n.id);
    const matrix: (number | string)[][] = [];

    // Header row
    matrix.push(['', ...nodeIds]);

    // Data rows
    nodeIds.forEach(fromId => {
      const row: (number | string)[] = [fromId];
      nodeIds.forEach(toId => {
        if (fromId === toId) {
          row.push(0);
        } else {
          const edge = edges.find(e =>
            (e.from === fromId && e.to === toId && (e.direction === 'forward' || e.direction === 'bidirectional')) ||
            (e.to === fromId && e.from === toId && (e.direction === 'backward' || e.direction === 'bidirectional'))
          );
          row.push(edge ? edge.weight : '∞');
        }
      });
      matrix.push(row);
    });

    return matrix.map(row => row.join('\t')).join('\n');
  }

  downloadGraphFile() {
    const nodes = this.nodes();
    const edges = this.edges();
    
    // Get matrix data
    const matrixData = this.getMatrixExportData();
    
    // Calculate relative positions using first node as origin
    const originNode = nodes[0];
    const metadata: any = {
      version: '1.0',
      origin: {
        nodeId: originNode?.id || '',
        x: originNode?.x || 0,
        y: originNode?.y || 0
      },
      nodes: nodes.map(node => ({
        id: node.id,
        label: node.label,
        relativeX: originNode ? node.x - originNode.x : node.x,
        relativeY: originNode ? node.y - originNode.y : node.y
      })),
      edges: edges.map(edge => ({
        from: edge.from,
        to: edge.to,
        weight: edge.weight,
        direction: edge.direction
      })),
      startNode: this.startNode(),
      endNode: this.endNode()
    };
    
    // Combine matrix data with metadata
    const fileContent = `# Graph Matrix Data
${matrixData}

# Metadata (JSON)
${JSON.stringify(metadata, null, 2)}`;
    
    const fileName = (this.exportFileName() || 'graph').replace(/[^a-zA-Z0-9_-]/g, '_') + '.grp';
    
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    this.showExportDialog.set(false);
  }

  exportGraph(format: 'json' | 'matrix') {
    // Always use matrix format for .grp files
    this.exportFormat.set('matrix');
    // Generate matrix data when opening dialog
    this.exportData.set(this.getMatrixExportData());
    this.showExportDialog.set(true);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.selectedFileName.set(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        this.selectedFileContent.set(content);
      };
      reader.readAsText(file);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.grp') || file.name.endsWith('.json')) {
        this.selectedFileName.set(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          this.selectedFileContent.set(content);
        };
        reader.readAsText(file);
      } else {
        alert('Chỉ hỗ trợ file .grp hoặc .json');
      }
    }
  }

  clearSelectedFile() {
    this.selectedFileName.set('');
    this.selectedFileContent.set('');
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  importGraph() {
    let data: string;
    
    // Get data from file or text input
    if (this.importMode() === 'file') {
      data = this.selectedFileContent().trim();
      if (!data) {
        alert('Vui lòng chọn file');
        return;
      }
    } else {
      data = this.importData().trim();
      if (!data) {
        alert('Vui lòng nhập dữ liệu');
        return;
      }
    }

    try {
      // Check if file contains metadata section
      const metadataMatch = data.match(/# Metadata \(JSON\)\s*\n([\s\S]*)$/);
      if (metadataMatch) {
        try {
          const metadata = JSON.parse(metadataMatch[1]);
          if (metadata.nodes && metadata.edges) {
            // Restore nodes with relative positions
            const originX = metadata.origin?.x || 0;
            const originY = metadata.origin?.y || 0;
            
            const restoredNodes = metadata.nodes.map((nodeData: any) => ({
              id: nodeData.id,
              label: nodeData.label,
              x: originX + (nodeData.relativeX || 0),
              y: originY + (nodeData.relativeY || 0),
              isStart: nodeData.id === metadata.startNode,
              isEnd: nodeData.id === metadata.endNode
            }));
            
            this.nodes.set(restoredNodes);
            this.edges.set(metadata.edges);
            if (metadata.startNode) this.startNode.set(metadata.startNode);
            if (metadata.endNode) this.endNode.set(metadata.endNode);
            this.nodeCounter.set(metadata.nodes.length);
            this.edgeCounter.set(metadata.edges.length);
            this.showImportDialog.set(false);
            this.clearSelectedFile();
            this.importData.set('');
            this.drawGraph();
            return;
          }
        } catch (e) {
          // Metadata parse failed, continue to matrix parsing
        }
      }
      
      // Try JSON first (standalone JSON)
      const jsonData = JSON.parse(data);
      if (jsonData.nodes && jsonData.edges) {
        this.nodes.set(jsonData.nodes);
        this.edges.set(jsonData.edges);
        if (jsonData.startNode) this.startNode.set(jsonData.startNode);
        if (jsonData.endNode) this.endNode.set(jsonData.endNode);
        this.nodeCounter.set(jsonData.nodes.length);
        this.edgeCounter.set(jsonData.edges.length);
        this.showImportDialog.set(false);
        this.clearSelectedFile();
        this.importData.set('');
        this.drawGraph();
        return;
      }
    } catch (e) {
      // Not JSON, try matrix
    }

    // Parse matrix format
    try {
      // Remove metadata section if exists
      let matrixData = data;
      const metadataIndex = data.indexOf('# Metadata');
      if (metadataIndex !== -1) {
        matrixData = data.substring(0, metadataIndex).trim();
      }
      // Remove comment lines
      const lines = matrixData.split('\n')
        .filter(l => l.trim() && !l.trim().startsWith('#'))
        .map(l => l.trim());
        
      if (lines.length < 2) {
        alert('Dữ liệu không hợp lệ. Vui lòng kiểm tra định dạng ma trận.');
        return;
      }

      // Parse header - support both tab and space separated
      const headerLine = lines[0];
      let nodeIds: string[];
      
      // Try tab-separated first
      if (headerLine.includes('\t')) {
        nodeIds = headerLine.split('\t').filter(h => h && h.trim() !== '');
        // Remove first empty element if exists
        if (nodeIds[0] === '' || nodeIds[0].trim() === '') {
          nodeIds.shift();
        }
      } else {
        // Space-separated
        nodeIds = headerLine.split(/\s+/).filter(h => h && h.trim() !== '');
        // Remove first empty element if exists
        if (nodeIds[0] === '' || nodeIds[0].trim() === '') {
          nodeIds.shift();
        }
      }

      if (nodeIds.length === 0) {
        alert('Không tìm thấy đỉnh trong ma trận');
        return;
      }

      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const canvas = this.canvasRef?.nativeElement;
      const centerX = canvas ? canvas.width / 2 : 400;
      const centerY = canvas ? canvas.height / 2 : 300;
      const radius = Math.min(canvas ? canvas.width / 3 : 200, canvas ? canvas.height / 3 : 150);

      // Create nodes
      nodeIds.forEach((id, index) => {
        const angle = (2 * Math.PI * index) / nodeIds.length;
        nodes.push({
          id: id.trim(),
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          label: id.trim(),
          isStart: index === 0,
          isEnd: index === nodeIds.length - 1
        });
      });

      // Parse matrix rows and detect symmetric (bidirectional) vs asymmetric (directed) edges
      const edgeMap = new Map<string, { from: string; to: string; weight: number; isSymmetric: boolean }>();
      
      for (let i = 1; i < lines.length; i++) {
        let row: string[];
        // Support both tab and space separated
        if (lines[i].includes('\t')) {
          row = lines[i].split('\t').filter(r => r !== '');
        } else {
          row = lines[i].split(/\s+/).filter(r => r && r.trim() !== '');
        }
        
        if (row.length === 0) continue;
        
        const fromId = row[0].trim();
        for (let j = 1; j < row.length && j <= nodeIds.length; j++) {
          const toId = nodeIds[j - 1].trim();
          const weightStr = row[j].trim();

          if (weightStr !== '∞' && weightStr !== 'Infinity' && weightStr !== '0' && fromId !== toId) {
            const weight = parseFloat(weightStr);
            if (!isNaN(weight) && weight > 0) {
              const edgeKey = `${fromId}-${toId}`;
              const reverseKey = `${toId}-${fromId}`;
              
              // Check if reverse edge exists
              const reverseEdge = edgeMap.get(reverseKey);
              if (reverseEdge && reverseEdge.weight === weight) {
                // Symmetric edge - mark as bidirectional
                reverseEdge.isSymmetric = true;
                edgeMap.set(reverseKey, reverseEdge);
              } else {
                // New edge - check if it will be symmetric later
                edgeMap.set(edgeKey, {
                  from: fromId,
                  to: toId,
                  weight: weight,
                  isSymmetric: false
                });
              }
            }
          }
        }
      }

      // Create edges from map
      const processedPairs = new Set<string>();
      edgeMap.forEach((edgeData, edgeKey) => {
        const reverseKey = `${edgeData.to}-${edgeData.from}`;
        const pairKey = [edgeData.from, edgeData.to].sort().join('-');
        
        // Only process each pair once
        if (processedPairs.has(pairKey)) return;
        processedPairs.add(pairKey);
        
        // Check if reverse edge exists with same weight
        const reverseEdge = edgeMap.get(reverseKey);
        const isBidirectional = reverseEdge && reverseEdge.weight === edgeData.weight;
        
        edges.push({
          id: `edge-${this.edgeCounter() + edges.length}`,
          from: edgeData.from,
          to: edgeData.to,
          weight: edgeData.weight,
          direction: isBidirectional ? 'bidirectional' : 'forward'
        });
      });

      this.nodes.set(nodes);
      this.edges.set(edges);
      this.nodeCounter.set(nodes.length);
      this.edgeCounter.set(edges.length);
      this.startNode.set(nodeIds[0]);
      this.endNode.set(nodeIds[nodeIds.length - 1]);
      this.showImportDialog.set(false);
      this.clearSelectedFile();
      this.importData.set('');
      this.drawGraph();
    } catch (e: any) {
      alert('Lỗi khi nhập dữ liệu: ' + (e?.message || 'Dữ liệu không hợp lệ'));
    }
  }
}

