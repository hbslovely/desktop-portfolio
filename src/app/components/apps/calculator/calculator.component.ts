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
  
  // Modern simplified button layout
  buttons = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['±', '0', '.', '=']
  ];

  displayValue = computed(() => this.display());

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
      
      this.display.set(String(newValue));
      this.previousValue.set(0);
      this.currentOperation.set('');
      this.waitingForOperand.set(true);
    }
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

  getButtonClass(button: string): string {
    if (this.isNumber(button) || button === '.') {
      return 'number';
    } else if (this.isOperator(button)) {
      return 'operator';
    } else if (button === '=') {
      return 'equals';
    } else {
      return 'function';
    }
  }
}
