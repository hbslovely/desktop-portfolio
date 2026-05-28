import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, throwError, timeout } from 'rxjs';

export interface TimesheetEntry {
  date: string;
  time: number; // Minutes
  billableTime: number; // Minutes
  note: string;
}

export interface TimesheetConfig {
  authToken: string;
  organizationId: string;
  personId: string;
  serviceId: string;
  clientDate: string;
}

export interface TimesheetSubmissionResult {
  success: boolean;
  results: Array<{
    date: string;
    success: boolean;
    data?: any;
  }>;
  errors: Array<{
    date: string;
    success: boolean;
    error: string;
    status?: number;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface ProductiveTimeEntry {
  id: string;
  type: string;
  attributes: {
    date: string;
    time?: number;
    billable_time?: number;
    note?: string;
    submitted?: boolean;
    approved?: boolean;
    rejected?: boolean;
  };
  relationships?: Record<string, unknown>;
}

export interface ProductiveListResponse<T> {
  data: T[];
  included?: any[];
  meta?: any;
  links?: any;
}

@Injectable({
  providedIn: 'root'
})
export class TimesheetService {
  constructor(private http: HttpClient) {}

  submitTimesheet(config: TimesheetConfig, dateEntries: TimesheetEntry[]): Observable<TimesheetSubmissionResult> {
    return new Observable<TimesheetSubmissionResult>((observer) => {
      void this.submitEntriesSequentially(config, dateEntries)
        .then((result) => {
          observer.next(result);
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  submitTimesheets(config: TimesheetConfig, dates: string[]): Observable<TimesheetSubmissionResult> {
    return new Observable<TimesheetSubmissionResult>((observer) => {
      void this.submitTimesheetsBulk(config, dates)
        .then((result) => {
          observer.next(result);
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  listTimeEntries(
    config: TimesheetConfig,
    startDate: string,
    endDate: string
  ): Observable<ProductiveListResponse<ProductiveTimeEntry>> {
    const params = new URLSearchParams({
      'filter[person_id]': config.personId,
      'filter[after]': startDate,
      'filter[before]': endDate,
      include: 'person.manager,approver,rejecter,updater,service.deal.company,service.deal.responsible,service.deal.contract,service.deal.project,service.deal.time_approval_workflow.approvers,service.section,task.project,approval_statuses.approver,approval_statuses.actual_approver,approval_statuses.approval_workflow.approval_policy',
      page: '1',
      per_page: '200'
    });

    return this.http
      .get<ProductiveListResponse<ProductiveTimeEntry>>(
        `/api/productive/api/v2/time_entries?${params.toString()}`,
        { headers: this.createHeaders(config, 'timetracking-manager') }
      )
      .pipe(
        timeout(30000),
        map((response) => ({
          ...response,
          data: Array.isArray(response?.data) ? response.data : []
        })),
        catchError((error) => throwError(() => new Error(this.extractHttpErrorMessage(error))))
      );
  }

  private async submitTimesheetsBulk(
    config: TimesheetConfig,
    dates: string[]
  ): Promise<TimesheetSubmissionResult> {
    const response = await fetch('/api/productive/api/v2/timesheets', {
      method: 'POST',
      headers: this.createHeaders(config, 'time-week-table', true),
      body: JSON.stringify({
        data: dates.map((date) => this.createTimesheetPayload(config, date))
      })
    });

    const responseBody = await response.json().catch(() => null);

    if (response.ok) {
      return {
        success: true,
        results: dates.map((date) => ({ date, success: true, data: responseBody })),
        errors: [],
        summary: {
          total: dates.length,
          successful: dates.length,
          failed: 0
        }
      };
    }

    return {
      success: false,
      results: [],
      errors: dates.map((date) => ({
        date,
        success: false,
        error: this.extractErrorMessage(responseBody),
        status: response.status
      })),
      summary: {
        total: dates.length,
        successful: 0,
        failed: dates.length
      }
    };
  }

  private async submitEntriesSequentially(
    config: TimesheetConfig,
    dateEntries: TimesheetEntry[]
  ): Promise<TimesheetSubmissionResult> {
    const results: TimesheetSubmissionResult['results'] = [];
    const errors: TimesheetSubmissionResult['errors'] = [];

    for (const entry of dateEntries) {
      try {
        const response = await fetch(
          '/api/productive/api/v2/time_entries?include=creator,person,task,service.deal.project.company,approval_statuses.approver,approval_statuses.actual_approver,approval_statuses.approval_workflow',
          {
            method: 'POST',
            headers: this.createHeaders(config),
            body: JSON.stringify(this.createTimeEntryPayload(config, entry))
          }
        );

        const responseBody = await response.json().catch(() => null);

        if (response.ok) {
          results.push({
            date: entry.date,
            success: true,
            data: responseBody
          });
        } else {
          errors.push({
            date: entry.date,
            success: false,
            error: this.extractErrorMessage(responseBody),
            status: response.status
          });
        }
      } catch (error) {
        errors.push({
          date: entry.date,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      summary: {
        total: dateEntries.length,
        successful: results.length,
        failed: errors.length
      }
    };
  }

  private createHeaders(config: TimesheetConfig, context = 'time-week-table', bulk = false): Record<string, string> {
    return {
      'Accept': bulk ? 'application/vnd.api+json; ext=bulk' : 'application/vnd.api+json',
      'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
      'Content-Type': bulk ? 'application/vnd.api+json; ext=bulk' : 'application/vnd.api+json',
      'X-Auth-Token': config.authToken,
      'X-Client-Branch': 'stable',
      'X-Client-Context': context,
      'X-Client-Date': config.clientDate,
      'X-Client-Source': 'app',
      'X-Client-Version': '0.2.0+26-05-27|08:00+a182c1a663',
      'X-Feature-Flags': 'displayAICredits,automationNewJsonSchema,importFieldErrorCodes',
      'X-Organization-Id': config.organizationId
    };
  }

  private createTimesheetPayload(config: TimesheetConfig, date: string) {
    return {
      attributes: {
        date,
        created_at: null,
        updated_at: null
      },
      relationships: {
        person: {
          data: {
            type: 'people',
            id: config.personId
          }
        }
      },
      type: 'timesheets'
    };
  }

  private createTimeEntryPayload(config: TimesheetConfig, entry: TimesheetEntry) {
    return {
      data: {
        attributes: {
          date: entry.date,
          created_at: null,
          time: entry.time,
          billable_time: entry.billableTime,
          note: entry.note,
          approved: false,
          approved_at: null,
          rejected: false,
          rejected_at: null,
          rejected_reason: null,
          timer_started_at: null,
          timer_stopped_at: null,
          started_at: null,
          track_method_id: null,
          updated_at: null,
          invoiced: false,
          calendar_event_id: null,
          calendar_event_recurring_id: null,
          overhead: false,
          last_activity_at: null,
          submitted: false,
          currency: null,
          currency_default: null,
          currency_normalized: null,
          cost: null,
          cost_default: null,
          cost_normalized: null,
          jira_issue_id: null,
          jira_issue_summary: null,
          jira_issue_status: null,
          jira_organization: null,
          jira_worklog_id: null
        },
        relationships: {
          person: {
            data: {
              type: 'people',
              id: config.personId
            }
          },
          service: {
            data: {
              type: 'services',
              id: config.serviceId
            }
          }
        },
        type: 'time-entries'
      }
    };
  }

  private extractErrorMessage(responseBody: any): string {
    if (!responseBody) {
      return 'Productive API returned an empty error response';
    }

    if (Array.isArray(responseBody.errors)) {
      const productiveErrors: Array<{ detail?: string; title?: string }> = responseBody.errors;

      return productiveErrors
        .map((productiveError) => productiveError.detail || productiveError.title || JSON.stringify(productiveError))
        .join(', ');
    }

    return responseBody.error || responseBody.message || JSON.stringify(responseBody);
  }

  private extractHttpErrorMessage(error: any): string {
    if (error?.name === 'TimeoutError') {
      return 'Loading timesheet detail timed out';
    }

    if (error?.error) {
      return this.extractErrorMessage(error.error);
    }

    return error?.message || 'Unable to load timesheet detail';
  }

  // Utility function to generate date range
  generateDateRange(startDate: Date, endDate: Date): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      dates.push(this.formatLocalDate(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  // Utility function to get business days only (exclude weekends)
  getBusinessDays(startDate: Date, endDate: Date): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      // 1-5 are Monday to Friday (business days)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        dates.push(this.formatLocalDate(current));
      }
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  // Convert minutes to hours display
  minutesToHours(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  // Convert hours to minutes
  hoursToMinutes(hours: number): number {
    return Math.round(hours * 60);
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}