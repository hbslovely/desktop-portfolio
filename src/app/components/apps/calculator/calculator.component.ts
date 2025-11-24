import { Component, signal, computed, ChangeDetectionStrategy, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

interface CalculationHistory {
  expression: string;
  result: string;
  timestamp: Date;
}

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calculator.component.html',
  styleUrl: './calculator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalculatorComponent implements OnInit, OnDestroy {
  display = signal('0');
  expression = signal('');
  previousValue = signal(0);
  currentOperation = signal('');
  waitingForOperand = signal(false);
  memory = signal(0);
  isScientificMode = signal(false);
  history = signal<CalculationHistory[]>([]);
  showHistory = signal(false);
  angleMode = signal<'DEG' | 'RAD'>('DEG');
  
  // Basic calculator buttons
  basicButtons = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['±', '0', '.', '=']
  ];

  // Scientific calculator buttons
  scientificButtons = [
    ['sin', 'cos', 'tan', '÷'],
    ['log', 'ln', '√', '×'],
    ['x²', 'x³', 'xʸ', '-'],
    ['(', ')', '1/x', '+'],
    ['7', '8', '9', '%'],
    ['4', '5', '6', '±'],
    ['1', '2', '3', '⌫'],
    ['0', '.', 'C', '=']
  ];
  
  // Constants
  constants = [
    { label: 'π', value: 'π', name: 'Pi (3.14159...)' },
    { label: 'e', value: 'e', name: 'Euler\'s number (2.71828...)' },
    { label: 'φ', value: 'φ', name: 'Golden ratio (1.61803...)' },
    { label: '√2', value: '√2', name: 'Square root of 2' }
  ];

  // Memory buttons
  memoryButtons = [
    ['MC', 'MR', 'M-', 'M+']
  ];

  displayValue = computed(() => {
    const val = this.display();
    if (val === 'Error' || val === 'Infinity' || val === '-Infinity') {
      return val;
    }
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    
    // Format large numbers
    if (Math.abs(num) >= 1e15) {
      return num.toExponential(10);
    }
    if (Math.abs(num) < 0.0001 && num !== 0) {
      return num.toExponential(6);
    }
    
    // Format with appropriate decimal places
    const str = num.toString();
    if (str.includes('.')) {
      const parts = str.split('.');
      if (parts[1].length > 10) {
        return num.toFixed(10).replace(/\.?0+$/, '');
      }
    }
    return val;
  });

  ngOnInit() {
    // Load history from localStorage
    const savedHistory = localStorage.getItem('calculator-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        this.history.set(parsed.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp)
        })));
      } catch (e) {
        console.error('Error loading history:', e);
      }
    }

    // Load memory from localStorage
    const savedMemory = localStorage.getItem('calculator-memory');
    if (savedMemory) {
      try {
        this.memory.set(parseFloat(savedMemory));
      } catch (e) {
        console.error('Error loading memory:', e);
      }
    }
  }

  ngOnDestroy() {
    // Save history to localStorage
    localStorage.setItem('calculator-history', JSON.stringify(this.history()));
    localStorage.setItem('calculator-memory', JSON.stringify(this.memory()));
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    const key = event.key;
    
    // Handle copy/paste
    if ((event.ctrlKey || event.metaKey) && key === 'c') {
      this.copyToClipboard();
      event.preventDefault();
      return;
    }
    
    if ((event.ctrlKey || event.metaKey) && key === 'v') {
      this.pasteFromClipboard();
      event.preventDefault();
      return;
    }
    
    // Prevent default for calculator keys
    if (this.isCalculatorKey(key)) {
      event.preventDefault();
    }

    if (key >= '0' && key <= '9') {
      this.inputNumber(key);
    } else if (key === '.') {
      this.inputDecimal();
    } else if (key === '+' || key === '-') {
      this.inputOperator(key);
    } else if (key === '*') {
      this.inputOperator('×');
    } else if (key === '/') {
      event.preventDefault();
      this.inputOperator('÷');
    } else if (key === 'Enter' || key === '=') {
      this.calculate();
    } else if (key === 'Escape' || key === 'c' || key === 'C') {
      this.clear();
    } else if (key === 'Backspace') {
      this.backspace();
    } else if (key === '%') {
      this.percentage();
    }
  }

  private isCalculatorKey(key: string): boolean {
    return /^[0-9+\-*/.=EnterEscapeBackspace%]$/i.test(key);
  }

  toggleMode() {
    this.isScientificMode.set(!this.isScientificMode());
    if (!this.isScientificMode()) {
      this.clear();
    }
  }

  toggleAngleMode() {
    this.angleMode.set(this.angleMode() === 'DEG' ? 'RAD' : 'DEG');
  }

  toggleHistory() {
    this.showHistory.set(!this.showHistory());
  }

  clearHistory() {
    this.history.set([]);
    localStorage.removeItem('calculator-history');
  }

  onButtonClick(value: string) {
    if (this.isNumber(value)) {
      this.inputNumber(value);
    } else if (value === '.') {
      this.inputDecimal();
    } else if (this.isOperator(value)) {
      this.inputOperator(value);
    } else if (value === '=') {
      this.calculate();
    } else if (value === 'C') {
      this.clear();
    } else if (value === '±') {
      this.toggleSign();
    } else if (value === '%') {
      this.percentage();
    } else if (value === '⌫') {
      this.backspace();
    } else if (this.isScientificFunction(value)) {
      this.handleScientificFunction(value);
    } else if (this.isMemoryFunction(value)) {
      this.handleMemoryFunction(value);
    } else if (value === '(' || value === ')') {
      // Parentheses support (basic implementation)
      if (value === '(') {
        this.inputOperator('(');
      }
    } else if (this.isConstant(value)) {
      this.handleConstant(value);
    }
  }

  private isNumber(value: string): boolean {
    return /^\d$/.test(value);
  }

  private isOperator(value: string): boolean {
    return ['÷', '×', '-', '+', '(', ')'].includes(value);
  }

  private isScientificFunction(value: string): boolean {
    return ['sin', 'cos', 'tan', 'log', 'ln', '√', 'x²', 'x³', 'xʸ', 'π', 'e', 'φ', '√2', '1/x'].includes(value);
  }
  
  private isConstant(value: string): boolean {
    return ['π', 'e', 'φ', '√2'].includes(value);
  }

  private isMemoryFunction(value: string): boolean {
    return ['MC', 'MR', 'M-', 'M+'].includes(value);
  }

  private inputNumber(num: string) {
    if (this.waitingForOperand()) {
      this.display.set(num);
      this.expression.set('');
      this.waitingForOperand.set(false);
    } else {
      const current = this.display() === '0' ? num : this.display() + num;
      this.display.set(current);
    }
  }

  private inputDecimal() {
    if (this.waitingForOperand()) {
      this.display.set('0.');
      this.expression.set('');
      this.waitingForOperand.set(false);
    } else if (this.display().indexOf('.') === -1) {
      this.display.set(this.display() + '.');
    }
  }

  private inputOperator(nextOperator: string) {
    const inputValue = parseFloat(this.display());

    if (this.previousValue() === 0) {
      this.previousValue.set(inputValue);
      this.expression.set(this.display() + ' ' + nextOperator);
    } else if (this.currentOperation()) {
      const currentValue = this.previousValue() || 0;
      const newValue = this.performCalculation(currentValue, inputValue, this.currentOperation());

      this.display.set(String(newValue));
      this.previousValue.set(newValue);
      this.expression.set(String(newValue) + ' ' + nextOperator);
    } else {
      this.expression.set(this.display() + ' ' + nextOperator);
    }

    this.waitingForOperand.set(true);
    this.currentOperation.set(nextOperator);
  }

  private calculate() {
    const inputValue = parseFloat(this.display());
    const currentValue = this.previousValue();

    if (currentValue !== 0 && this.currentOperation()) {
      const newValue = this.performCalculation(currentValue, inputValue, this.currentOperation());
      const result = this.formatResult(newValue);
      
      // Build expression for history
      const fullExpression = `${currentValue} ${this.currentOperation()} ${inputValue}`;
      
      // Add to history
      const historyEntry: CalculationHistory = {
        expression: fullExpression + ' =',
        result: result,
        timestamp: new Date()
      };
      this.history.update(h => [historyEntry, ...h.slice(0, 49)]); // Keep last 50
      
      this.display.set(result);
      this.expression.set(fullExpression + ' = ' + result);
      this.previousValue.set(0);
      this.currentOperation.set('');
      this.waitingForOperand.set(true);
    }
  }

  private formatResult(value: number): string {
    if (isNaN(value) || !isFinite(value)) {
      return 'Error';
    }
    
    // Round to avoid floating point errors
    const rounded = Math.round(value * 1e12) / 1e12;
    
    return String(rounded);
  }

  private performCalculation(firstValue: number, secondValue: number, operator: string): number {
    try {
      switch (operator) {
        case '+':
          return firstValue + secondValue;
        case '-':
          return firstValue - secondValue;
        case '×':
          return firstValue * secondValue;
        case '÷':
          if (secondValue === 0) {
            throw new Error('Division by zero');
          }
          return firstValue / secondValue;
        case '^':
          return Math.pow(firstValue, secondValue);
        default:
          return secondValue;
      }
    } catch (e) {
      return NaN;
    }
  }

  private handleScientificFunction(func: string) {
    const value = parseFloat(this.display());
    let result: number;

    try {
      switch (func) {
        case 'sin':
          result = Math.sin(this.angleMode() === 'DEG' ? (value * Math.PI) / 180 : value);
          break;
        case 'cos':
          result = Math.cos(this.angleMode() === 'DEG' ? (value * Math.PI) / 180 : value);
          break;
        case 'tan':
          result = Math.tan(this.angleMode() === 'DEG' ? (value * Math.PI) / 180 : value);
          break;
        case 'log':
          if (value <= 0) throw new Error('Invalid input');
          result = Math.log10(value);
          break;
        case 'ln':
          if (value <= 0) throw new Error('Invalid input');
          result = Math.log(value);
          break;
        case '√':
          if (value < 0) throw new Error('Invalid input');
          result = Math.sqrt(value);
          break;
        case 'x²':
          result = value * value;
          break;
        case 'x³':
          result = value * value * value;
          break;
        case 'xʸ':
          // Store for power operation
          this.previousValue.set(value);
          this.currentOperation.set('^');
          this.waitingForOperand.set(true);
          return;
        case '1/x':
          if (value === 0) throw new Error('Division by zero');
          result = 1 / value;
          break;
        default:
          // Constants are handled separately
          if (this.isConstant(func)) {
            return;
          }
          return;
      }

      const formatted = this.formatResult(result);
      this.display.set(formatted);
      this.expression.set(`${func}(${value}) = ${formatted}`);
      
      // Add to history
      const historyEntry: CalculationHistory = {
        expression: `${func}(${value})`,
        result: formatted,
        timestamp: new Date()
      };
      this.history.update(h => [historyEntry, ...h.slice(0, 49)]);
      
      this.waitingForOperand.set(true);
    } catch (e) {
      this.display.set('Error');
      this.waitingForOperand.set(true);
    }
  }

  private handleMemoryFunction(func: string) {
    const value = parseFloat(this.display());
    
    switch (func) {
      case 'MC':
        this.memory.set(0);
        break;
      case 'MR':
        this.display.set(String(this.memory()));
        this.waitingForOperand.set(true);
        break;
      case 'M+':
        this.memory.set(this.memory() + value);
        break;
      case 'M-':
        this.memory.set(this.memory() - value);
        break;
    }
  }

  private clear() {
    this.display.set('0');
    this.expression.set('');
    this.previousValue.set(0);
    this.currentOperation.set('');
    this.waitingForOperand.set(false);
  }

  private toggleSign() {
    const value = parseFloat(this.display());
    this.display.set(String(-value));
  }

  private percentage() {
    const value = parseFloat(this.display());
    this.display.set(String(value / 100));
  }
  
  private backspace() {
    const current = this.display();
    if (current.length > 1 && current !== 'Error') {
      this.display.set(current.slice(0, -1));
    } else {
      this.display.set('0');
    }
  }

  useHistoryEntry(entry: CalculationHistory) {
    this.display.set(entry.result);
    this.waitingForOperand.set(true);
    this.showHistory.set(false);
  }
  
  private handleConstant(constant: string) {
    let value: number;
    let displayName: string;
    
    switch (constant) {
      case 'π':
        value = Math.PI;
        displayName = 'π';
        break;
      case 'e':
        value = Math.E;
        displayName = 'e';
        break;
      case 'φ':
        value = (1 + Math.sqrt(5)) / 2;
        displayName = 'φ';
        break;
      case '√2':
        value = Math.sqrt(2);
        displayName = '√2';
        break;
      default:
        return;
    }
    
    const formatted = this.formatResult(value);
    this.display.set(formatted);
    this.expression.set(`${displayName} = ${formatted}`);
    this.waitingForOperand.set(true);
    
    // Add to history
    const historyEntry: CalculationHistory = {
      expression: displayName,
      result: formatted,
      timestamp: new Date()
    };
    this.history.update(h => [historyEntry, ...h.slice(0, 49)]);
  }
  
  async copyToClipboard() {
    try {
      const text = this.displayValue();
      await navigator.clipboard.writeText(text);
      // Visual feedback could be added here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
  
  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text);
      if (!isNaN(num)) {
        this.display.set(text);
        this.waitingForOperand.set(false);
      }
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  }

  getButtonClass(button: string): string {
    if (this.isNumber(button) || button === '.') {
      return 'number';
    } else if (this.isConstant(button)) {
      return 'constant';
    } else if (this.isOperator(button)) {
      return 'operator';
    } else if (button === '=') {
      return 'equals';
    } else if (this.isMemoryFunction(button)) {
      return 'memory';
    } else if (this.isScientificFunction(button)) {
      return 'scientific';
    } else {
      return 'function';
    }
  }

  getButtons() {
    return this.isScientificMode() ? this.scientificButtons : this.basicButtons;
  }
}
