import { Component, ViewChild, ElementRef, AfterViewInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Point {
  x: number;
  y: number;
}

interface DrawingPath {
  points: Point[];
  color: string;
  lineWidth: number;
  tool: string;
}

@Component({
  selector: 'app-paint-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paint-app.component.html',
  styleUrl: './paint-app.component.scss'
})
export class PaintAppComponent implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private currentPath: Point[] = [];
  private paths: DrawingPath[] = [];
  private previewPoint: Point | null = null;
  
  // Tool settings
  selectedTool = signal<string>('brush');
  selectedColor = signal<string>('#000000');
  lineWidth = signal<number>(5);
  
  // Available tools
  tools = [
    { id: 'brush', name: 'Brush', icon: 'pi pi-pencil' },
    { id: 'eraser', name: 'Eraser', icon: 'pi pi-times' },
    { id: 'line', name: 'Line', icon: 'pi pi-minus' },
    { id: 'rectangle', name: 'Rectangle', icon: 'pi pi-square' },
    { id: 'circle', name: 'Circle', icon: 'pi pi-circle' },
    { id: 'text', name: 'Text', icon: 'pi pi-font' }
  ];
  
  // Available colors
  colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
    '#FF00FF', '#00FFFF', '#FFFFFF', '#FFA500', '#800080',
    '#FFC0CB', '#A52A2A', '#808080', '#008000', '#000080'
  ];
  
  // Canvas settings
  canvasWidth = 800;
  canvasHeight = 600;
  
  // Text settings
  fontSize = signal<number>(16);
  fontFamily = signal<string>('Arial');
  textInput = signal<string>('');
  showTextInput = signal<boolean>(false);
  textPosition = signal<Point | null>(null);

  ngAfterViewInit() {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.setupCanvas();
  }

  setupCanvas() {
    // Set canvas size
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    
    // Set default styles
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  getMousePos(event: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  startDrawing(event: MouseEvent) {
    this.isDrawing = true;
    const point = this.getMousePos(event);
    this.currentPath = [point];
    
    if (this.selectedTool() === 'text') {
      this.textPosition.set(point);
      this.showTextInput.set(true);
      this.textInput.set('');
      return;
    }
    
    if (this.selectedTool() === 'brush' || this.selectedTool() === 'eraser') {
      this.ctx.beginPath();
      this.ctx.moveTo(point.x, point.y);
    }
  }

  draw(event: MouseEvent) {
    if (!this.isDrawing) return;
    
    const point = this.getMousePos(event);
    this.currentPath.push(point);
    
    const tool = this.selectedTool();
    
    if (tool === 'brush') {
      this.ctx.strokeStyle = this.selectedColor();
      this.ctx.lineWidth = this.lineWidth();
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
    } else if (tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.lineWidth = this.lineWidth();
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
      this.ctx.globalCompositeOperation = 'source-over';
    } else if (tool === 'line' || tool === 'rectangle' || tool === 'circle') {
      // Store the preview point for shape tools
      this.previewPoint = point;
      this.drawPreview(tool, this.currentPath[0], point);
    }
  }

  stopDrawing(event: MouseEvent) {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    const point = this.getMousePos(event);
    this.currentPath.push(point);
    
    const tool = this.selectedTool();
    
    if (tool === 'line' || tool === 'rectangle' || tool === 'circle') {
      this.drawShape(tool, this.currentPath[0], point);
      this.previewPoint = null; // Clear preview
    }
    
    // Save the path
    if (this.currentPath.length > 1) {
      this.paths.push({
        points: [...this.currentPath],
        color: this.selectedColor(),
        lineWidth: this.lineWidth(),
        tool: tool
      });
    }
    
    this.currentPath = [];
  }

  drawShape(tool: string, startPoint: Point, endPoint: Point) {
    this.ctx.strokeStyle = this.selectedColor();
    this.ctx.lineWidth = this.lineWidth();
    this.ctx.globalCompositeOperation = 'source-over';
    
    switch (tool) {
      case 'line':
        this.ctx.beginPath();
        this.ctx.moveTo(startPoint.x, startPoint.y);
        this.ctx.lineTo(endPoint.x, endPoint.y);
        this.ctx.stroke();
        break;
        
      case 'rectangle':
        const width = endPoint.x - startPoint.x;
        const height = endPoint.y - startPoint.y;
        this.ctx.strokeRect(startPoint.x, startPoint.y, width, height);
        break;
        
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(endPoint.x - startPoint.x, 2) + 
          Math.pow(endPoint.y - startPoint.y, 2)
        );
        this.ctx.beginPath();
        this.ctx.arc(startPoint.x, startPoint.y, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
        break;
    }
  }

  drawPreview(tool: string, startPoint: Point, endPoint: Point) {
    // Clear the canvas and redraw all saved paths
    this.redrawCanvas();
    
    // Draw the preview shape in a different style
    this.ctx.strokeStyle = this.selectedColor();
    this.ctx.lineWidth = this.lineWidth();
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.setLineDash([5, 5]); // Dashed line for preview
    
    switch (tool) {
      case 'line':
        this.ctx.beginPath();
        this.ctx.moveTo(startPoint.x, startPoint.y);
        this.ctx.lineTo(endPoint.x, endPoint.y);
        this.ctx.stroke();
        break;
        
      case 'rectangle':
        const width = endPoint.x - startPoint.x;
        const height = endPoint.y - startPoint.y;
        this.ctx.strokeRect(startPoint.x, startPoint.y, width, height);
        break;
        
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(endPoint.x - startPoint.x, 2) + 
          Math.pow(endPoint.y - startPoint.y, 2)
        );
        this.ctx.beginPath();
        this.ctx.arc(startPoint.x, startPoint.y, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
        break;
    }
    
    this.ctx.setLineDash([]); // Reset line dash
  }

  selectTool(tool: string) {
    this.selectedTool.set(tool);
  }

  selectColor(color: string) {
    this.selectedColor.set(color);
  }

  setLineWidth(width: number) {
    this.lineWidth.set(width);
  }

  clearCanvas() {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.paths = [];
  }

  undo() {
    if (this.paths.length > 0) {
      this.paths.pop();
      this.redrawCanvas();
    }
  }

  redrawCanvas() {
    // Clear canvas
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Redraw all paths
    this.paths.forEach(path => {
      this.ctx.strokeStyle = path.color;
      this.ctx.lineWidth = path.lineWidth;
      
      if (path.tool === 'brush') {
        this.ctx.beginPath();
        this.ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          this.ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        this.ctx.stroke();
      } else if (path.tool === 'eraser') {
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.beginPath();
        this.ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          this.ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        this.ctx.stroke();
        this.ctx.globalCompositeOperation = 'source-over';
      } else if (path.tool === 'line' || path.tool === 'rectangle' || path.tool === 'circle') {
        const startPoint = path.points[0];
        const endPoint = path.points[path.points.length - 1];
        this.drawShape(path.tool, startPoint, endPoint);
      } else if (path.tool === 'text') {
        const textPath = path as any;
        this.ctx.fillStyle = textPath.color;
        this.ctx.font = `${textPath.lineWidth}px ${textPath.fontFamily}`;
        this.ctx.fillText(textPath.text, path.points[0].x, path.points[0].y);
      }
    });
  }

  downloadCanvas() {
    const link = document.createElement('a');
    link.download = 'paint-drawing.png';
    link.href = this.canvas.toDataURL();
    link.click();
  }

  getSelectedToolName(): string {
    const tool = this.tools.find(t => t.id === this.selectedTool());
    return tool ? tool.name : 'Unknown';
  }

  addText() {
    const text = this.textInput().trim();
    const position = this.textPosition();
    
    if (text && position) {
      // Save text as a path for undo functionality
      this.paths.push({
        points: [position],
        color: this.selectedColor(),
        lineWidth: this.fontSize(),
        tool: 'text',
        text: text,
        fontFamily: this.fontFamily()
      } as any);
      
      // Draw the text
      this.drawText(text, position);
    }
    
    this.showTextInput.set(false);
    this.textInput.set('');
    this.textPosition.set(null);
    this.isDrawing = false;
  }

  cancelText() {
    this.showTextInput.set(false);
    this.textInput.set('');
    this.textPosition.set(null);
    this.isDrawing = false;
  }

  drawText(text: string, position: Point) {
    this.ctx.fillStyle = this.selectedColor();
    this.ctx.font = `${this.fontSize()}px ${this.fontFamily()}`;
    this.ctx.fillText(text, position.x, position.y);
  }

  setFontSize(size: number) {
    this.fontSize.set(size);
  }

  setFontFamily(font: string) {
    this.fontFamily.set(font);
  }
}
