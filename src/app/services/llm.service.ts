import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of, from } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Expense, CategoryBudget } from './expense.service';

export interface LLMConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ExpenseSummaryRequest {
  expenses: Expense[];
  budgets?: CategoryBudget[];
  timeRange?: {
    from: string;
    to: string;
  };
  language?: 'vi' | 'en';
}

export interface ExpenseSummaryResponse {
  summary: string;
  insights: string[];
  recommendations: string[];
  categoryAnalysis: {
    category: string;
    total: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
    comment: string;
  }[];
  totalSpent: number;
  averageDaily: number;
  topExpenses: {
    content: string;
    amount: number;
    date: string;
  }[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Parsed expense from raw text input
 */
export interface ParsedExpense {
  content: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
  confidence: number; // 0-1 confidence score
  rawInput: string;
}

/**
 * Available categories for expense classification
 */
export const EXPENSE_CATEGORIES = [
  'Kinh doanh',
  'Đi chợ',
  'Siêu thị',
  'Ăn uống ngoài',
  'Nhà hàng',
  'Đi lại - xăng xe',
  'Gia đình/Bạn bè',
  'Điện - nước',
  'Pet/Thú cưng/Vật nuôi khác',
  'Sức khỏe',
  'Thời trang / Mỹ Phẩm/ Làm đẹp',
  'Mua sắm / Mua sắm online',
  'Sữa/vitamin/chất bổ/Thuốc khác',
  'Từ thiện',
  'Điện thoại',
  'Sinh hoạt (Lee)',
  'Ăn vặt / Ăn uống ngoài bữa chính',
  'Du lịch – Nghỉ dưỡng',
  'Thiết bị làm việc',
  'Chi tiêu khác'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

@Injectable({
  providedIn: 'root'
})
export class LLMService {
  // Default configuration - HuggingFace
  private config: LLMConfig = {
    model: 'mistralai/Mistral-7B-Instruct-v0.2:featherless-ai',
    maxTokens: 512, // Shorter responses (200-300 chars ~ 100-150 tokens)
    temperature: 0.3
  };

  // Status signals
  isHuggingFaceAvailable = signal<boolean>(false);
  isProcessing = signal<boolean>(false);
  lastError = signal<string | null>(null);

  // HuggingFace Router API URL - use proxy to avoid CORS
  private readonly HUGGINGFACE_URL = '/api/huggingface';

  constructor(private http: HttpClient) {
    this.loadConfig();
    this.checkHuggingFaceStatus();
  }

  /**
   * Check if HuggingFace API is available
   */
  checkHuggingFaceStatus(): void {
    const token = this.getHuggingFaceToken();
    if (token) {
      this.isHuggingFaceAvailable.set(true);
      console.log('✅ HuggingFace API token configured');
    } else {
      this.isHuggingFaceAvailable.set(false);
      console.log('❌ HuggingFace token not configured');
    }
  }

  /**
   * Get HuggingFace API token
   */
  private getHuggingFaceToken(): string {
    return (environment as any).huggingfaceToken || '';
  }

  /**
   * Load LLM configuration from localStorage
   */
  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('llm-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
      }
    } catch (error) {
      console.error('Error loading LLM config:', error);
    }
  }

  /**
   * Save LLM configuration to localStorage
   */
  saveConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };
    localStorage.setItem('llm-config', JSON.stringify(this.config));
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  // ========== RAW EXPENSE PARSING ==========

  /**
   * Parse raw expense input to structured expense data using HuggingFace AI
   * Examples:
   *   - "mua bánh 10k" -> { content: "Mua bánh", amount: 10000, category: "Ăn vặt / Ăn uống ngoài bữa chính" }
   *   - "grab 50k đi làm" -> { content: "Grab đi làm", amount: 50000, category: "Đi lại - xăng xe" }
   *   - "cà phê 35000" -> { content: "Cà phê", amount: 35000, category: "Ăn uống ngoài" }
   */
  parseExpenseFromText(rawInput: string): Observable<ParsedExpense> {
    if (!rawInput || rawInput.trim().length === 0) {
      return throwError(() => new Error('Vui lòng nhập nội dung chi tiêu'));
    }

    // Always try HuggingFace API first for better accuracy
    if (this.isHuggingFaceAvailable()) {
      return this.parseExpenseWithLLM(rawInput).pipe(
        catchError(() => {
          // Fallback to local parsing on API error
          console.log('HuggingFace API failed, using local parsing');
          return of(this.parseExpenseLocally(rawInput));
        })
      );
    }

    // Fallback to local parsing if no API available
    return of(this.parseExpenseLocally(rawInput));
  }

  /**
   * Parse expense locally without LLM (fast, works offline)
   */
  parseExpenseLocally(rawInput: string): ParsedExpense {
    const input = rawInput.trim().toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    // Extract amount using regex patterns
    const amount = this.extractAmount(input);
    
    // Remove amount from input to get content
    let content = this.removeAmountFromText(rawInput);
    content = this.capitalizeFirst(content.trim());

    // Detect category based on keywords
    const category = this.detectCategory(input);

    // Calculate confidence
    let confidence = 0.5;
    if (amount > 0) confidence += 0.3;
    if (content.length > 0) confidence += 0.2;

    return {
      content: content || 'Chi tiêu',
      amount,
      category,
      date: today,
      confidence,
      rawInput
    };
  }

  /**
   * Extract amount from text
   * Supports: 10k, 10K, 10000, 10.000, 10,000, 10 nghìn, 10 triệu, etc.
   */
  private extractAmount(text: string): number {
    const patterns = [
      // 10k, 10K, 10k5 (10,500)
      /(\d+)[kK](\d)?/,
      // 10tr, 10 triệu
      /(\d+(?:[.,]\d+)?)\s*(?:tr|triệu)/i,
      // 10 nghìn, 10 ngàn
      /(\d+(?:[.,]\d+)?)\s*(?:nghìn|ngàn|ng)/i,
      // Plain number with dots: 10.000, 100.000
      /(\d{1,3}(?:\.\d{3})+)/,
      // Plain number with commas: 10,000
      /(\d{1,3}(?:,\d{3})+)/,
      // Plain number: 10000
      /(\d{4,})/,
      // Small number at end: bánh 50
      /\s(\d{2,3})$/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let value = match[1];
        
        // Handle 10k5 = 10,500
        if (pattern === patterns[0] && match[2]) {
          return parseInt(match[1]) * 1000 + parseInt(match[2]) * 100;
        }
        
        // Handle triệu
        if (pattern === patterns[1]) {
          value = value.replace(',', '.');
          return Math.round(parseFloat(value) * 1000000);
        }
        
        // Handle nghìn
        if (pattern === patterns[2]) {
          value = value.replace(',', '.');
          return Math.round(parseFloat(value) * 1000);
        }
        
        // Handle k/K
        if (pattern === patterns[0]) {
          return parseInt(match[1]) * 1000;
        }
        
        // Handle formatted numbers
        const cleanValue = value.replace(/[.,]/g, '');
        const parsed = parseInt(cleanValue, 10);
        
        // Small numbers are likely in thousands
        if (parsed < 1000 && parsed >= 10) {
          return parsed * 1000;
        }
        
        return parsed;
      }
    }

    return 0;
  }

  /**
   * Remove amount text from input
   */
  private removeAmountFromText(text: string): string {
    return text
      .replace(/\d+[kK]\d?/g, '')
      .replace(/\d+(?:[.,]\d+)?\s*(?:tr|triệu)/gi, '')
      .replace(/\d+(?:[.,]\d+)?\s*(?:nghìn|ngàn|ng)/gi, '')
      .replace(/\d{1,3}(?:\.\d{3})+/g, '')
      .replace(/\d{1,3}(?:,\d{3})+/g, '')
      .replace(/\d{4,}/g, '')
      .replace(/\s+đ\s*/gi, '')
      .replace(/\s+vnd\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detect category based on keywords
   */
  private detectCategory(text: string): ExpenseCategory {
    const categoryKeywords: Record<ExpenseCategory, string[]> = {
      'Kinh doanh': ['kinh doanh', 'business', 'hàng', 'bán', 'nhập'],
      'Đi chợ': ['chợ', 'rau', 'thịt', 'cá', 'trứng', 'đồ tươi'],
      'Siêu thị': ['siêu thị', 'coopmart', 'vinmart', 'big c', 'lotte', 'aeon', 'mega market'],
      'Ăn uống ngoài': ['ăn', 'uống', 'cơm', 'phở', 'bún', 'mì', 'cafe', 'cà phê', 'coffee', 'trà sữa', 'quán', 'tiệm'],
      'Nhà hàng': ['nhà hàng', 'restaurant', 'buffet', 'lẩu', 'nướng', 'bbq'],
      'Đi lại - xăng xe': ['grab', 'taxi', 'xe', 'xăng', 'gửi xe', 'đỗ xe', 'uber', 'be', 'gojek', 'bus', 'xe buýt', 'đi lại'],
      'Gia đình/Bạn bè': ['gia đình', 'bạn bè', 'họp mặt', 'tiệc', 'sinh nhật', 'quà', 'biếu', 'lì xì'],
      'Điện - nước': ['điện', 'nước', 'gas', 'internet', 'wifi', 'hóa đơn'],
      'Pet/Thú cưng/Vật nuôi khác': ['pet', 'chó', 'mèo', 'thú cưng', 'thức ăn chó', 'thức ăn mèo'],
      'Sức khỏe': ['thuốc', 'bác sĩ', 'khám', 'bệnh viện', 'nha khoa', 'gym', 'yoga', 'thể dục'],
      'Thời trang / Mỹ Phẩm/ Làm đẹp': ['quần', 'áo', 'giày', 'dép', 'túi', 'thời trang', 'mỹ phẩm', 'son', 'kem', 'tóc', 'nail', 'spa'],
      'Mua sắm / Mua sắm online': ['mua', 'shopping', 'lazada', 'shopee', 'tiki', 'sendo', 'online'],
      'Sữa/vitamin/chất bổ/Thuốc khác': ['sữa', 'vitamin', 'bổ sung', 'thuốc bổ', 'canxi', 'omega'],
      'Từ thiện': ['từ thiện', 'quyên góp', 'ủng hộ', 'donate'],
      'Điện thoại': ['điện thoại', 'cước', 'data', '4g', '5g', 'nạp tiền'],
      'Sinh hoạt (Lee)': ['lee', 'sinh hoạt'],
      'Ăn vặt / Ăn uống ngoài bữa chính': ['ăn vặt', 'snack', 'bánh', 'kẹo', 'trà sữa', 'kem', 'nước ngọt'],
      'Du lịch – Nghỉ dưỡng': ['du lịch', 'nghỉ dưỡng', 'khách sạn', 'resort', 'vé máy bay', 'tour'],
      'Thiết bị làm việc': ['laptop', 'máy tính', 'chuột', 'bàn phím', 'màn hình', 'thiết bị'],
      'Chi tiêu khác': []
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category as ExpenseCategory;
      }
    }

    return 'Chi tiêu khác';
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(text: string): string {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Parse expense using HuggingFace LLM
   */
  private parseExpenseWithLLM(rawInput: string): Observable<ParsedExpense> {
    const today = new Date().toISOString().split('T')[0];
    const prompt = `Phân tích chi tiêu và trả về JSON. Chỉ trả về JSON, không giải thích.

Input: "${rawInput}"

Danh mục có thể chọn:
${EXPENSE_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Format JSON:
{"content": "Tên chi tiêu", "amount": số_tiền, "category": "Danh mục phù hợp nhất"}

Quy tắc:
- amount: Số nguyên (VNĐ). 10k=10000, 1tr=1000000
- category: PHẢI là 1 trong các danh mục trên
- content: Viết hoa chữ cái đầu

Ví dụ:
- "cafe 25k" -> {"content": "Cafe", "amount": 25000, "category": "Ăn uống ngoài"}
- "grab 50k" -> {"content": "Grab", "amount": 50000, "category": "Đi lại - xăng xe"}
- "siêu thị 200k" -> {"content": "Siêu thị", "amount": 200000, "category": "Siêu thị"}`;

    return this.chat([{ role: 'user', content: prompt }]).pipe(
      map(response => {
        try {
          const jsonMatch = response.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Find best matching category
            let category = this.findBestMatchingCategory(parsed.category);
            
            // Parse amount - handle string numbers
            let amount = parsed.amount;
            if (typeof amount === 'string') {
              amount = parseInt(amount.replace(/[.,\s]/g, ''), 10) || 0;
            }
            
            return {
              content: parsed.content || this.capitalizeFirst(rawInput),
              amount: amount || this.extractAmount(rawInput.toLowerCase()),
              category,
              date: today,
              note: parsed.note,
              confidence: 0.95,
              rawInput
            };
          }
        } catch (e) {
          console.error('Error parsing LLM response:', e, response);
        }
        
        // Fallback to local parsing
        return this.parseExpenseLocally(rawInput);
      })
    );
  }

  /**
   * Find best matching category from AI response
   */
  private findBestMatchingCategory(aiCategory: string): ExpenseCategory {
    if (!aiCategory) return 'Chi tiêu khác';
    
    // Exact match
    if (EXPENSE_CATEGORIES.includes(aiCategory as ExpenseCategory)) {
      return aiCategory as ExpenseCategory;
    }
    
    // Case-insensitive match
    const lowerCategory = aiCategory.toLowerCase();
    for (const cat of EXPENSE_CATEGORIES) {
      if (cat.toLowerCase() === lowerCategory) {
        return cat;
      }
    }
    
    // Partial match
    for (const cat of EXPENSE_CATEGORIES) {
      if (cat.toLowerCase().includes(lowerCategory) || lowerCategory.includes(cat.toLowerCase())) {
        return cat;
      }
    }
    
    return 'Chi tiêu khác';
  }

  /**
   * Parse multiple expenses from a list
   * Example: "mua bánh 10k, grab 50k, cafe 35k"
   */
  parseMultipleExpenses(rawInput: string): Observable<ParsedExpense[]> {
    // Split by common delimiters
    const items = rawInput.split(/[,;và\n]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    if (items.length === 1) {
      return this.parseExpenseFromText(items[0]).pipe(
        map(expense => [expense])
      );
    }

    // Parse each item
    const parseObservables = items.map(item => this.parseExpenseFromText(item));
    
    return from(Promise.all(parseObservables.map(obs => 
      new Promise<ParsedExpense>((resolve, reject) => {
        obs.subscribe({ next: resolve, error: reject });
      })
    )));
  }

  // ========== CHAT METHODS ==========

  // Default system prompt to ensure Vietnamese responses
  private readonly VIETNAMESE_SYSTEM_PROMPT = 'Bạn là trợ lý AI thông minh. Luôn trả lời bằng tiếng Việt. Trả lời NGẮN GỌN (tối đa 200-300 ký tự), đi thẳng vào vấn đề, không lan man.';

  /**
   * Chat with HuggingFace LLM
   */
  chat(messages: ChatMessage[]): Observable<string> {
    this.isProcessing.set(true);
    this.lastError.set(null);

    const apiKey = this.getHuggingFaceToken();
    if (!apiKey) {
      this.isProcessing.set(false);
      return throwError(() => new Error('HuggingFace token chưa được cấu hình. Vui lòng thêm NG_APP_HUGGINGFACE_TOKEN vào environment.'));
    }

    // Add Vietnamese system prompt if no system message exists
    const messagesWithSystem = this.ensureVietnameseSystemPrompt(messages);

    return this.chatWithHuggingFace(messagesWithSystem, apiKey).pipe(
      tap(() => this.isProcessing.set(false)),
      catchError(error => {
        this.isProcessing.set(false);
        this.lastError.set(error.message);
        return throwError(() => error);
      })
    );
  }

  /**
   * Ensure messages have a Vietnamese system prompt
   */
  private ensureVietnameseSystemPrompt(messages: ChatMessage[]): ChatMessage[] {
    const hasSystemMessage = messages.some(m => m.role === 'system');
    
    if (hasSystemMessage) {
      // Append Vietnamese instruction to existing system message
      return messages.map(m => {
        if (m.role === 'system') {
          return {
            ...m,
            content: `${m.content}\n\nLuôn trả lời bằng tiếng Việt, NGẮN GỌN (tối đa 200-300 ký tự).`
          };
        }
        return m;
      });
    }
    
    // Add new system message at the beginning
    return [
      { role: 'system', content: this.VIETNAMESE_SYSTEM_PROMPT },
      ...messages
    ];
  }

  /**
   * Chat with HuggingFace Router API (OpenAI-compatible format)
   */
  private chatWithHuggingFace(messages: ChatMessage[], apiKey: string): Observable<string> {
    const model = this.config.model || 'mistralai/Mistral-7B-Instruct-v0.2:featherless-ai';
    const url = `${this.HUGGINGFACE_URL}/v1/chat/completions`;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    });

    const body = {
      model: model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    };

    return this.http.post<any>(url, body, { headers }).pipe(
      map(response => {
        // OpenAI-compatible response format
        if (response.choices && response.choices.length > 0) {
          return response.choices[0].message?.content || '';
        }
        return '';
      }),
      catchError(error => {
        console.error('HuggingFace API error:', error);
        
        // Check for model loading status
        if (error.error?.error?.includes('loading')) {
          return throwError(() => new Error(
            'Model đang được tải. Vui lòng thử lại sau vài giây.'
          ));
        }
        
        // Check for rate limit
        if (error.status === 429) {
          return throwError(() => new Error(
            'Đã vượt quá giới hạn API. Vui lòng thử lại sau.'
          ));
        }

        // Check for invalid token
        if (error.status === 401) {
          return throwError(() => new Error(
            'HuggingFace token không hợp lệ. Vui lòng kiểm tra lại token.'
          ));
        }
        
        return throwError(() => new Error(
          error.error?.error || error.error?.message || 'Lỗi khi gọi HuggingFace API'
        ));
      })
    );
  }

  // ========== EXPENSE SUMMARY METHODS ==========

  /**
   * Generate expense summary using LLM
   */
  summarizeExpenses(request: ExpenseSummaryRequest): Observable<ExpenseSummaryResponse> {
    const language = request.language || 'vi';
    const prompt = this.buildExpenseSummaryPrompt(request, language);

    return this.chat([
      {
        role: 'system',
        content: language === 'vi'
          ? `Bạn là một chuyên gia tài chính cá nhân. Phân tích chi tiêu và đưa ra nhận xét hữu ích.
Luôn trả lời bằng JSON hợp lệ theo format được yêu cầu.
Sử dụng tiếng Việt trong các phần text.
Đơn vị tiền tệ là VNĐ (đồng Việt Nam).`
          : `You are a personal finance expert. Analyze expenses and provide helpful insights.
Always respond with valid JSON in the requested format.
Currency is VND (Vietnamese Dong).`
      },
      {
        role: 'user',
        content: prompt
      }
    ]).pipe(
      map(response => this.parseExpenseSummaryResponse(response, request))
    );
  }

  /**
   * Build prompt for expense summary
   */
  private buildExpenseSummaryPrompt(request: ExpenseSummaryRequest, language: 'vi' | 'en'): string {
    const { expenses, budgets, timeRange } = request;

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const categoryTotals = this.calculateCategoryTotals(expenses);
    const topExpenses = [...expenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    if (language === 'vi') {
      return `
Phân tích chi tiêu và trả về JSON:
{
  "summary": "Tóm tắt ngắn gọn (2-3 câu)",
  "insights": ["Nhận xét 1", "Nhận xét 2", "Nhận xét 3"],
  "recommendations": ["Đề xuất 1", "Đề xuất 2"],
  "categoryAnalysis": [{"category": "Tên", "total": số, "percentage": %, "trend": "up|down|stable", "comment": "Nhận xét"}],
  "totalSpent": ${totalSpent},
  "averageDaily": trung bình/ngày,
  "topExpenses": [{"content": "nội dung", "amount": số, "date": "ngày"}]
}

Dữ liệu:
- Tổng: ${expenses.length} giao dịch, ${totalSpent.toLocaleString('vi-VN')} đ
- Thời gian: ${timeRange ? `${timeRange.from} - ${timeRange.to}` : 'Không xác định'}

Theo danh mục:
${Object.entries(categoryTotals).map(([cat, total]) => 
  `- ${cat}: ${total.toLocaleString('vi-VN')} đ (${((total / totalSpent) * 100).toFixed(1)}%)`
).join('\n')}

${budgets?.length ? `Ngân sách:\n${budgets.map(b => `- ${b.category}: ${b.amount.toLocaleString('vi-VN')} đ`).join('\n')}` : ''}

Top 5:
${topExpenses.map(e => `- ${e.date}: ${e.content} - ${e.amount.toLocaleString('vi-VN')} đ`).join('\n')}
`;
    } else {
      return `
Analyze expenses and return JSON:
{
  "summary": "Brief summary (2-3 sentences)",
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "categoryAnalysis": [{"category": "Name", "total": amount, "percentage": %, "trend": "up|down|stable", "comment": "Comment"}],
  "totalSpent": ${totalSpent},
  "averageDaily": daily average,
  "topExpenses": [{"content": "description", "amount": amount, "date": "date"}]
}

Data:
- Total: ${expenses.length} transactions, ${totalSpent.toLocaleString('vi-VN')} VND
- Period: ${timeRange ? `${timeRange.from} - ${timeRange.to}` : 'Not specified'}

By category:
${Object.entries(categoryTotals).map(([cat, total]) => 
  `- ${cat}: ${total.toLocaleString('vi-VN')} VND (${((total / totalSpent) * 100).toFixed(1)}%)`
).join('\n')}
`;
    }
  }

  /**
   * Calculate total spending per category
   */
  private calculateCategoryTotals(expenses: Expense[]): Record<string, number> {
    return expenses.reduce((acc, expense) => {
      const category = expense.category || 'Chi tiêu khác';
      acc[category] = (acc[category] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Parse LLM response to ExpenseSummaryResponse
   */
  private parseExpenseSummaryResponse(
    response: string, 
    request: ExpenseSummaryRequest
  ): ExpenseSummaryResponse {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || '',
          insights: parsed.insights || [],
          recommendations: parsed.recommendations || [],
          categoryAnalysis: parsed.categoryAnalysis || [],
          totalSpent: parsed.totalSpent || request.expenses.reduce((s, e) => s + e.amount, 0),
          averageDaily: parsed.averageDaily || 0,
          topExpenses: parsed.topExpenses || []
        };
      }
    } catch (error) {
      console.error('Error parsing LLM response:', error);
    }

    const totalSpent = request.expenses.reduce((s, e) => s + e.amount, 0);
    const days = this.getUniqueDays(request.expenses);
    
    return {
      summary: response || 'Không thể phân tích chi tiêu.',
      insights: [],
      recommendations: [],
      categoryAnalysis: [],
      totalSpent,
      averageDaily: days > 0 ? Math.round(totalSpent / days) : 0,
      topExpenses: request.expenses
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map(e => ({ content: e.content, amount: e.amount, date: e.date }))
    };
  }

  private getUniqueDays(expenses: Expense[]): number {
    const uniqueDates = new Set(expenses.map(e => e.date));
    return uniqueDates.size;
  }

  /**
   * Quick summary - get a short summary of recent expenses
   */
  getQuickSummary(expenses: Expense[], language: 'vi' | 'en' = 'vi'): Observable<string> {
    if (expenses.length === 0) {
      return of(language === 'vi' 
        ? 'Không có chi tiêu nào để phân tích.' 
        : 'No expenses to analyze.'
      );
    }

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const categoryTotals = this.calculateCategoryTotals(expenses);
    const topCategory = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)[0];

    const prompt = language === 'vi'
      ? `Tóm tắt ngắn gọn (tối đa 2 câu) về chi tiêu:
- Tổng chi: ${totalSpent.toLocaleString('vi-VN')} đ
- Số giao dịch: ${expenses.length}
- Danh mục nhiều nhất: ${topCategory[0]} (${topCategory[1].toLocaleString('vi-VN')} đ)
Không sử dụng markdown, chỉ trả về văn bản thuần.`
      : `Briefly summarize (max 2 sentences) the spending:
- Total: ${totalSpent.toLocaleString('vi-VN')} VND
- Transactions: ${expenses.length}
- Top category: ${topCategory[0]} (${topCategory[1].toLocaleString('vi-VN')} VND)
No markdown, return plain text only.`;

    return this.chat([{ role: 'user', content: prompt }]);
  }

  /**
   * Get spending advice based on expenses and budgets
   */
  getSpendingAdvice(
    expenses: Expense[], 
    budgets: CategoryBudget[],
    language: 'vi' | 'en' = 'vi'
  ): Observable<string[]> {
    const categoryTotals = this.calculateCategoryTotals(expenses);
    
    const overBudget: string[] = [];
    for (const budget of budgets) {
      const spent = categoryTotals[budget.category] || 0;
      if (spent > budget.amount) {
        overBudget.push(`${budget.category}: vượt ${((spent - budget.amount)).toLocaleString('vi-VN')} đ`);
      }
    }

    const prompt = language === 'vi'
      ? `Đưa ra 3 lời khuyên ngắn gọn (mỗi lời tối đa 1 câu):
${overBudget.length > 0 ? `- Vượt ngân sách: ${overBudget.join(', ')}` : '- Chưa vượt ngân sách'}
- Tổng chi: ${expenses.reduce((s, e) => s + e.amount, 0).toLocaleString('vi-VN')} đ

Trả về JSON array: ["lời khuyên 1", "lời khuyên 2", "lời khuyên 3"]`
      : `Give 3 brief tips (max 1 sentence each):
${overBudget.length > 0 ? `- Over budget: ${overBudget.join(', ')}` : '- No budget exceeded'}
- Total: ${expenses.reduce((s, e) => s + e.amount, 0).toLocaleString('vi-VN')} VND

Return JSON array: ["tip 1", "tip 2", "tip 3"]`;

    return this.chat([{ role: 'user', content: prompt }]).pipe(
      map(response => {
        try {
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('Error parsing advice:', e);
        }
        return [response];
      })
    );
  }

  /**
   * Analyze spending patterns
   */
  analyzePatterns(expenses: Expense[], language: 'vi' | 'en' = 'vi'): Observable<string> {
    if (expenses.length < 10) {
      return of(language === 'vi'
        ? 'Cần ít nhất 10 giao dịch để phân tích xu hướng.'
        : 'Need at least 10 transactions to analyze patterns.'
      );
    }

    const dayOfWeekTotals: Record<number, number> = {};
    const dayNames = language === 'vi'
      ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (const expense of expenses) {
      const date = new Date(expense.date);
      const day = date.getDay();
      dayOfWeekTotals[day] = (dayOfWeekTotals[day] || 0) + expense.amount;
    }

    const prompt = language === 'vi'
      ? `Phân tích xu hướng chi tiêu (tối đa 3 câu):
${Object.entries(dayOfWeekTotals).map(([day, total]) => 
  `- ${dayNames[parseInt(day)]}: ${total.toLocaleString('vi-VN')} đ`
).join('\n')}

Không markdown, văn bản thuần.`
      : `Analyze spending patterns (max 3 sentences):
${Object.entries(dayOfWeekTotals).map(([day, total]) => 
  `- ${dayNames[parseInt(day)]}: ${total.toLocaleString('vi-VN')} VND`
).join('\n')}

No markdown, plain text only.`;

    return this.chat([{ role: 'user', content: prompt }]);
  }

  /**
   * Ask a custom question about expenses
   */
  askAboutExpenses(
    question: string, 
    expenses: Expense[],
    language: 'vi' | 'en' = 'vi'
  ): Observable<string> {
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const categoryTotals = this.calculateCategoryTotals(expenses);

    const context = language === 'vi'
      ? `Dữ liệu chi tiêu:
- Tổng chi: ${totalSpent.toLocaleString('vi-VN')} đ
- Số giao dịch: ${expenses.length}
- Theo danh mục:
${Object.entries(categoryTotals).map(([cat, total]) => 
  `  + ${cat}: ${total.toLocaleString('vi-VN')} đ`
).join('\n')}

20 giao dịch gần nhất:
${expenses.slice(0, 20).map(e => 
  `- ${e.date}: ${e.content} - ${e.amount.toLocaleString('vi-VN')} đ (${e.category})`
).join('\n')}

Câu hỏi: ${question}

Trả lời ngắn gọn, không markdown.`
      : `Expense data:
- Total: ${totalSpent.toLocaleString('vi-VN')} VND
- Transactions: ${expenses.length}
- By category:
${Object.entries(categoryTotals).map(([cat, total]) => 
  `  + ${cat}: ${total.toLocaleString('vi-VN')} VND`
).join('\n')}

Latest 20 transactions:
${expenses.slice(0, 20).map(e => 
  `- ${e.date}: ${e.content} - ${e.amount.toLocaleString('vi-VN')} VND (${e.category})`
).join('\n')}

Question: ${question}

Answer briefly, no markdown.`;

    return this.chat([{ role: 'user', content: context }]);
  }
}
