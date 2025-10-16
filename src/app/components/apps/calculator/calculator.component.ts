import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calculator.component.html',
  styleUrl: './calculator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalculatorComponent {
  display = signal('0');
  previousValue = signal(0);
  currentOperation = signal('');
  waitingForOperand = signal(false);
  memory = signal(0);
  history = signal<string[]>([]);
  showHistory = signal(false);
  
  // Button layout - Enhanced with more features
  buttons = [
    ['MC', 'MR', 'M+', 'M-', 'C', '⌫'],
    ['√', 'x²', '1/x', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['±', '0', '.', '=']
  ];

  displayValue = computed(() => this.display());
  memoryIndicator = computed(() => this.memory() !== 0 ? 'M' : '');
  historyList = computed(() => this.history());

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
    } else if (value === '√') {
      this.squareRoot();
    } else if (value === 'x²') {
      this.square();
    } else if (value === '1/x') {
      this.reciprocal();
    } else if (value === 'MC') {
      this.memoryClear();
    } else if (value === 'MR') {
      this.memoryRecall();
    } else if (value === 'M+') {
      this.memoryAdd();
    } else if (value === 'M-') {
      this.memorySubtract();
    }
  }

  private isNumber(value: string): boolean {
    return /^\d$/.test(value);
  }

  private isOperator(value: string): boolean {
    return ['÷', '×', '-', '+'].includes(value);
  }

  private inputNumber(num: string) {
    if (this.waitingForOperand()) {
      this.display.set(num);
      this.waitingForOperand.set(false);
    } else {
      this.display.set(this.display() === '0' ? num : this.display() + num);
    }
  }

  private inputDecimal() {
    if (this.waitingForOperand()) {
      this.display.set('0.');
      this.waitingForOperand.set(false);
    } else if (this.display().indexOf('.') === -1) {
      this.display.set(this.display() + '.');
    }
  }

  private inputOperator(nextOperator: string) {
    const inputValue = parseFloat(this.display());

    if (this.previousValue() === 0) {
      this.previousValue.set(inputValue);
    } else if (this.currentOperation()) {
      const currentValue = this.previousValue() || 0;
      const newValue = this.performCalculation(currentValue, inputValue, this.currentOperation());

      this.display.set(String(newValue));
      this.previousValue.set(newValue);
    }

    this.waitingForOperand.set(true);
    this.currentOperation.set(nextOperator);
  }

  private calculate() {
    const inputValue = parseFloat(this.display());
    const currentValue = this.previousValue();

    if (currentValue !== 0 && this.currentOperation()) {
      const newValue = this.performCalculation(currentValue, inputValue, this.currentOperation());
      
      // Add to history
      const historyEntry = `${currentValue} ${this.currentOperation()} ${inputValue} = ${newValue}`;
      this.addToHistory(historyEntry);
      
      this.display.set(String(newValue));
      this.previousValue.set(0);
      this.currentOperation.set('');
      this.waitingForOperand.set(true);
    }
  }
  
  private addToHistory(entry: string) {
    const currentHistory = this.history();
    const newHistory = [entry, ...currentHistory].slice(0, 10); // Keep last 10
    this.history.set(newHistory);
  }

  private performCalculation(firstValue: number, secondValue: number, operator: string): number {
    switch (operator) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '×':
        return firstValue * secondValue;
      case '÷':
        return firstValue / secondValue;
      default:
        return secondValue;
    }
  }

  private clear() {
    this.display.set('0');
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
    if (current.length > 1) {
      this.display.set(current.slice(0, -1));
    } else {
      this.display.set('0');
    }
  }
  
  private squareRoot() {
    const value = parseFloat(this.display());
    if (value < 0) {
      this.display.set('Error');
    } else {
      const result = Math.sqrt(value);
      this.display.set(String(result));
      this.addToHistory(`√${value} = ${result}`);
    }
  }
  
  private square() {
    const value = parseFloat(this.display());
    const result = value * value;
    this.display.set(String(result));
    this.addToHistory(`${value}² = ${result}`);
  }
  
  private reciprocal() {
    const value = parseFloat(this.display());
    if (value === 0) {
      this.display.set('Error');
    } else {
      const result = 1 / value;
      this.display.set(String(result));
      this.addToHistory(`1/${value} = ${result}`);
    }
  }
  
  // Memory functions
  private memoryClear() {
    this.memory.set(0);
  }
  
  private memoryRecall() {
    this.display.set(String(this.memory()));
    this.waitingForOperand.set(true);
  }
  
  private memoryAdd() {
    // If there's a pending operation, calculate it first
    if (this.currentOperation() && this.previousValue() !== 0) {
      const inputValue = parseFloat(this.display());
      const currentValue = this.previousValue();
      const result = this.performCalculation(currentValue, inputValue, this.currentOperation());
      this.display.set(String(result));
      this.previousValue.set(0);
      this.currentOperation.set('');
      this.memory.update(m => m + result);
    } else {
      const value = parseFloat(this.display());
      this.memory.update(m => m + value);
    }
    this.waitingForOperand.set(true);
  }
  
  private memorySubtract() {
    // If there's a pending operation, calculate it first
    if (this.currentOperation() && this.previousValue() !== 0) {
      const inputValue = parseFloat(this.display());
      const currentValue = this.previousValue();
      const result = this.performCalculation(currentValue, inputValue, this.currentOperation());
      this.display.set(String(result));
      this.previousValue.set(0);
      this.currentOperation.set('');
      this.memory.update(m => m - result);
    } else {
      const value = parseFloat(this.display());
      this.memory.update(m => m - value);
    }
    this.waitingForOperand.set(true);
  }
  
  toggleHistory() {
    this.showHistory.update(v => !v);
  }
  
  clearHistory() {
    this.history.set([]);
  }

  getButtonClass(button: string): string {
    if (this.isNumber(button) || button === '.') {
      return 'number';
    } else if (this.isOperator(button) || button === '=') {
      return 'operator';
    } else if (['MC', 'MR', 'M+', 'M-'].includes(button)) {
      return 'memory';
    } else if (['√', 'x²', '1/x'].includes(button)) {
      return 'scientific';
    } else {
      return 'function';
    }
  }
}
