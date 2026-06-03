import { Injectable } from '@angular/core';

export interface MedicalHistoryError {
  type: 'network' | 'validation' | 'permission' | 'data' | 'unknown';
  message: string;
  userMessage: string;
  actionable: boolean;
  retryable: boolean;
}

/**
 * Service to handle and categorize medical history related errors
 */
@Injectable({
  providedIn: 'root'
})
export class MedicalErrorHandlerService {

  /**
   * Convert generic errors to user-friendly medical history errors
   */
  handleError(error: any): MedicalHistoryError {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';

    // Network/API errors
    if (errorMessage.includes('Google Sheets API key not configured')) {
      return {
        type: 'permission',
        message: errorMessage,
        userMessage: 'Ứng dụng chưa được cấu hình để truy cập Google Sheets. Vui lòng liên hệ quản trị viên.',
        actionable: false,
        retryable: false
      };
    }

    if (errorMessage.includes('Access denied to Google Sheets')) {
      return {
        type: 'permission',
        message: errorMessage,
        userMessage: 'Không có quyền truy cập Google Sheets. Vui lòng kiểm tra quyền chia sẻ.',
        actionable: true,
        retryable: true
      };
    }

    if (errorMessage.includes('Google Sheet not found')) {
      return {
        type: 'data',
        message: errorMessage,
        userMessage: 'Không tìm thấy bảng dữ liệu y tế. Vui lòng kiểm tra liên kết Google Sheets.',
        actionable: true,
        retryable: true
      };
    }

    if (errorMessage.includes('Sheet with GID') && errorMessage.includes('not found')) {
      return {
        type: 'data',
        message: errorMessage,
        userMessage: 'Không tìm thấy trang dữ liệu y tế trong Google Sheets. Vui lòng kiểm tra cấu hình.',
        actionable: false,
        retryable: false
      };
    }

    if (errorMessage.includes('Invalid request to Google Sheets API')) {
      return {
        type: 'network',
        message: errorMessage,
        userMessage: 'Yêu cầu không hợp lệ tới Google Sheets. Vui lòng thử lại sau.',
        actionable: false,
        retryable: true
      };
    }

    // Validation errors
    if (errorMessage.includes('Validation failed:')) {
      return {
        type: 'validation',
        message: errorMessage,
        userMessage: 'Dữ liệu không hợp lệ: ' + errorMessage.replace('Validation failed:', '').trim(),
        actionable: true,
        retryable: false
      };
    }

    if (errorMessage.includes('Date must be in YYYY-MM-DD format')) {
      return {
        type: 'validation',
        message: errorMessage,
        userMessage: 'Định dạng ngày không đúng. Vui lòng nhập theo định dạng DD/MM/YYYY.',
        actionable: true,
        retryable: false
      };
    }

    // Network connectivity errors
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('Network error') ||
        errorMessage.includes('ERR_NETWORK')) {
      return {
        type: 'network',
        message: errorMessage,
        userMessage: 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối Internet và thử lại.',
        actionable: true,
        retryable: true
      };
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return {
        type: 'network',
        message: errorMessage,
        userMessage: 'Yêu cầu bị hết thời gian chờ. Vui lòng thử lại sau.',
        actionable: false,
        retryable: true
      };
    }

    // Generic fallback
    return {
      type: 'unknown',
      message: errorMessage,
      userMessage: 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.',
      actionable: false,
      retryable: true
    };
  }

  /**
   * Get user-friendly suggestions based on error type
   */
  getErrorSuggestions(error: MedicalHistoryError): string[] {
    const suggestions: string[] = [];

    switch (error.type) {
      case 'network':
        suggestions.push('Kiểm tra kết nối Internet');
        suggestions.push('Thử tải lại trang');
        if (error.retryable) {
          suggestions.push('Thử lại sau vài phút');
        }
        break;

      case 'permission':
        suggestions.push('Đảm bảo Google Sheets được chia sẻ công khai hoặc với ứng dụng');
        suggestions.push('Kiểm tra quyền truy cập của tài khoản');
        break;

      case 'validation':
        suggestions.push('Kiểm tra lại thông tin đã nhập');
        suggestions.push('Đảm bảo tất cả trường bắt buộc đã được điền');
        break;

      case 'data':
        suggestions.push('Kiểm tra liên kết Google Sheets');
        suggestions.push('Đảm bảo cấu trúc dữ liệu đúng định dạng');
        break;

      default:
        suggestions.push('Tải lại trang và thử lại');
        suggestions.push('Liên hệ hỗ trợ kỹ thuật nếu vấn đề tiếp tục');
        break;
    }

    return suggestions;
  }

  /**
   * Check if error is recoverable through user action
   */
  isRecoverable(error: MedicalHistoryError): boolean {
    return error.actionable && (error.type === 'validation' || error.type === 'permission');
  }

  /**
   * Get appropriate retry delay based on error type
   */
  getRetryDelay(error: MedicalHistoryError, attemptCount: number): number {
    if (!error.retryable) return 0;

    const baseDelay = {
      network: 2000,
      permission: 5000,
      data: 3000,
      validation: 0,
      unknown: 3000
    };

    // Exponential backoff with jitter
    const delay = baseDelay[error.type] * Math.pow(1.5, attemptCount - 1);
    const jitter = Math.random() * 1000;
    
    return Math.min(delay + jitter, 30000); // Max 30 seconds
  }
}