import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { forkJoin } from 'rxjs';

// PrimeNG imports
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';

import {
  ProductiveCalendarEvent,
  ProductiveTimeEntry,
  TimesheetService,
  TimesheetEntry,
  TimesheetConfig,
  TimesheetSubmissionResult,
} from '../../services/timesheet.service';

type TimesheetTab = 'log' | 'submit' | 'detail';

interface TimesheetCalendarDay {
  date: string;
  dayNumber: number;
  weekday: string;
  gridColumnStart?: number;
  isWeekend: boolean;
  isOutsideRange: boolean;
  isSubmitted: boolean;
  isApproved: boolean;
  totalMinutes: number;
  billableMinutes: number;
  entries: ProductiveTimeEntry[];
  events: ProductiveCalendarEvent[];
  isHoliday: boolean;
}

@Component({
  selector: 'app-my-timesheet',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    HttpClientModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    InputTextarea,
    CheckboxModule,
    ToastModule,
    ProgressBarModule,
    TableModule,
    TagModule,
  ],
  providers: [MessageService],
  template: `
    <div class="app-container">
      <!-- Hero Header -->
      <div class="hero-section">
        <div class="hero-content">
          <div class="hero-icon">⏰</div>
          <h1 class="hero-title">My Timesheet</h1>
          <p class="hero-subtitle">Submit your time entries to Productive.io with style</p>
        </div>
        <div class="hero-decoration">
          <div class="decoration-circle circle-1"></div>
          <div class="decoration-circle circle-2"></div>
          <div class="decoration-circle circle-3"></div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="main-content">
        <div class="content-grid">
          <!-- Configuration Panel -->
          <div class="config-panel">
            <div class="panel-card config-card">
              <div class="card-header">
                <div class="card-icon">🔐</div>
                <div>
                  <h3 class="card-title">API Configuration</h3>
                  <p class="card-subtitle">Setup your connection settings</p>
                </div>
              </div>

              <div class="card-content">
                <div class="input-group">
                  <label class="input-label">
                    <i class="pi pi-key"></i>
                    Auth Token *
                  </label>
                  <div class="input-wrapper">
                    <input
                      pInputText
                      [(ngModel)]="config.authToken"
                      placeholder="Enter your authentication token"
                      class="styled-input"
                      type="password"
                    />
                  </div>
                </div>

                <div class="input-group">
                  <label class="input-label">
                    <i class="pi pi-building"></i>
                    Organization ID *
                  </label>
                  <div class="input-wrapper">
                    <input
                      pInputText
                      [(ngModel)]="config.organizationId"
                      placeholder="e.g., 47405"
                      class="styled-input"
                    />
                  </div>
                </div>

                <div class="input-group">
                  <label class="input-label">
                    <i class="pi pi-user"></i>
                    Person ID *
                  </label>
                  <div class="input-wrapper">
                    <input
                      pInputText
                      [(ngModel)]="config.personId"
                      placeholder="e.g., 1265977"
                      class="styled-input"
                    />
                  </div>
                </div>

                <div class="input-group">
                  <label class="input-label">
                    <i class="pi pi-briefcase"></i>
                    Service ID *
                  </label>
                  <div class="input-wrapper">
                    <input
                      pInputText
                      [(ngModel)]="config.serviceId"
                      placeholder="e.g., 14437926"
                      class="styled-input"
                    />
                  </div>
                </div>

                <div class="input-group">
                  <label class="input-label">
                    <i class="pi pi-calendar-plus"></i>
                    Calendar Integration ID
                  </label>
                  <div class="input-wrapper">
                    <input
                      pInputText
                      [(ngModel)]="config.calendarIntegrationId"
                      placeholder="e.g., 98330"
                      class="styled-input"
                    />
                  </div>
                </div>

                <div class="input-group">
                  <label class="input-label">
                    <i class="pi pi-calendar"></i>
                    Client Date
                  </label>
                  <div class="input-wrapper">
                    <input
                      type="date"
                      [(ngModel)]="clientDate"
                      class="styled-input native-date-input"
                    />
                  </div>
                </div>

                <button
                  pButton
                  (click)="saveConfig()"
                  class="save-config-btn"
                  label="Save Configuration"
                  icon="pi pi-save"
                  [disabled]="!isConfigValid()"
                ></button>
              </div>
            </div>
          </div>

          <!-- Main Panel -->
          <div class="main-panel">
            <div class="tabs-card">
              <button
                type="button"
                class="tab-button"
                [class.active]="activeTab === 'log'"
                (click)="setActiveTab('log')"
              >
                <i class="pi pi-clock"></i>
                <span>Log timesheet</span>
              </button>
              <button
                type="button"
                class="tab-button"
                [class.active]="activeTab === 'submit'"
                (click)="setActiveTab('submit')"
              >
                <i class="pi pi-send"></i>
                <span>Submit timesheet</span>
              </button>
              <button
                type="button"
                class="tab-button"
                [class.active]="activeTab === 'detail'"
                (click)="setActiveTab('detail')"
              >
                <i class="pi pi-calendar"></i>
                <span>Timesheet detail</span>
              </button>
            </div>

            <!-- Date Range Selection -->
            <div class="panel-card date-range-card" *ngIf="activeTab !== 'detail'">
              <div class="card-header">
                <div class="card-icon">📆</div>
                <div>
                  <h3 class="card-title">Select Date Range</h3>
                  <p class="card-subtitle">Pick the days you want to log</p>
                </div>
              </div>

              <div class="card-content">
                <div class="range-shell">
                  <div class="range-picker-card">
                    <div class="range-field">
                      <span class="range-field-icon"><i class="pi pi-calendar"></i></span>
                      <label for="timesheetStartDate">From</label>
                      <input
                        id="timesheetStartDate"
                        type="date"
                        [(ngModel)]="startDate"
                        class="range-date-input"
                      />
                    </div>

                    <div class="range-arrow" aria-hidden="true">
                      <i class="pi pi-arrow-right"></i>
                    </div>

                    <div class="range-field">
                      <span class="range-field-icon"><i class="pi pi-calendar"></i></span>
                      <label for="timesheetEndDate">To</label>
                      <input
                        id="timesheetEndDate"
                        type="date"
                        [(ngModel)]="endDate"
                        class="range-date-input"
                      />
                    </div>
                  </div>

                  <div class="range-actions">
                    <div class="quick-buttons">
                      <button type="button" class="quick-btn" (click)="setThisWeek()">
                        This week
                      </button>
                      <button type="button" class="quick-btn" (click)="setLastWeek()">
                        Last week
                      </button>
                      <button type="button" class="quick-btn" (click)="setThisMonth()">
                        This month
                      </button>
                    </div>

                    <div class="workday-toggle">
                      <p-checkbox
                        [(ngModel)]="businessDaysOnly"
                        binary="true"
                        inputId="businessDays"
                      ></p-checkbox>
                      <label for="businessDays">
                        <span>Business days only</span>
                        <small>Skip Saturday and Sunday</small>
                      </label>
                    </div>
                  </div>

                  <div class="range-footer">
                    <div class="range-preview" [class.empty-preview]="!startDate || !endDate">
                      <i class="pi pi-info-circle"></i>
                      <span>{{
                        getDateRangePreview() || 'Select both dates to preview generated entries.'
                      }}</span>
                    </div>

                    <button
                      *ngIf="activeTab === 'log'"
                      pButton
                      (click)="generateDateEntries()"
                      label="Generate entries"
                      icon="pi pi-plus-circle"
                      [disabled]="!startDate || !endDate"
                      class="generate-entries-btn"
                    ></button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bulk Settings -->
            <ng-container *ngIf="activeTab === 'log'">
              <div class="panel-card bulk-settings-card" *ngIf="dateEntries.length > 0">
                <div class="card-header">
                  <div class="card-icon">⚙️</div>
                  <div>
                    <h3 class="card-title">Bulk Settings</h3>
                    <p class="card-subtitle">Apply settings to all entries</p>
                  </div>
                </div>

                <div class="card-content">
                  <div class="bulk-grid">
                    <div class="input-group">
                      <label class="input-label">Default Hours</label>
                      <input
                        type="number"
                        [(ngModel)]="bulkHours"
                        min="0"
                        max="24"
                        step="0.5"
                        placeholder="8.0"
                        class="styled-input number-input"
                      />
                    </div>

                    <div class="input-group">
                      <label class="input-label">Default Note</label>
                      <input
                        pInputText
                        [(ngModel)]="bulkNote"
                        placeholder="Daily work tasks"
                        class="styled-input"
                      />
                    </div>

                    <button
                      pButton
                      (click)="applyBulkSettings()"
                      label="Apply to All"
                      icon="pi pi-copy"
                      class="apply-bulk-btn"
                    ></button>
                  </div>
                </div>
              </div>

              <!-- Time Entries Table -->
              <div class="panel-card entries-card" *ngIf="dateEntries.length > 0">
                <div class="card-header">
                  <div class="card-icon">📊</div>
                  <div>
                    <h3 class="card-title">Time Entries</h3>
                    <p class="card-subtitle">Review and edit your timesheet</p>
                  </div>
                </div>

                <div class="card-content">
                  <div class="table-wrapper">
                    <p-table
                      [value]="dateEntries"
                      styleClass="modern-table"
                      [scrollable]="true"
                      scrollHeight="360px"
                    >
                      <ng-template pTemplate="header">
                        <tr>
                          <th class="date-col">Date</th>
                          <th class="hours-col">Hours</th>
                          <th class="hours-col">Billable</th>
                          <th class="note-col">Description</th>
                          <th class="status-col">Status</th>
                        </tr>
                      </ng-template>
                      <ng-template pTemplate="body" let-entry let-i="rowIndex">
                        <tr class="table-row">
                          <td class="date-col date-cell">
                            <div class="date-display">{{ entry.date | date: 'EEE, MMM d' }}</div>
                            <div class="date-small">{{ entry.date }}</div>
                          </td>
                          <td class="hours-col">
                            <input
                              type="number"
                              [(ngModel)]="entry.hours"
                              (ngModelChange)="updateEntryTime(i)"
                              min="0"
                              max="24"
                              step="0.5"
                              placeholder="8.0"
                              class="table-input"
                            />
                          </td>
                          <td class="hours-col">
                            <input
                              type="number"
                              [(ngModel)]="entry.billableHours"
                              (ngModelChange)="updateEntryBillableTime(i)"
                              min="0"
                              max="24"
                              step="0.5"
                              placeholder="8.0"
                              class="table-input"
                            />
                          </td>
                          <td class="note-col">
                            <textarea
                              pInputTextarea
                              [(ngModel)]="entry.note"
                              rows="2"
                              class="note-input"
                              placeholder="Describe your work..."
                            ></textarea>
                          </td>
                          <td class="status-col">
                            <p-tag
                              [value]="getEntryStatus(entry)"
                              [severity]="getEntryStatusSeverity(entry)"
                              styleClass="status-tag"
                            ></p-tag>
                          </td>
                        </tr>
                      </ng-template>
                    </p-table>
                  </div>

                  <div class="table-footer">
                    <div class="summary-stats">
                      <div class="stat-item">
                        <span class="stat-value">{{ dateEntries.length }}</span>
                        <span class="stat-label">Days</span>
                      </div>
                      <div class="stat-divider"></div>
                      <div class="stat-item">
                        <span class="stat-value">{{ getTotalHours() }}h</span>
                        <span class="stat-label">Total Hours</span>
                      </div>
                      <div class="stat-divider"></div>
                      <div class="stat-item">
                        <span class="stat-value">{{ getTotalBillableHours() }}h</span>
                        <span class="stat-label">Billable</span>
                      </div>
                    </div>

                    <div class="action-buttons">
                      <button
                        pButton
                        (click)="clearAll()"
                        label="Clear All"
                        icon="pi pi-trash"
                        severity="secondary"
                        [disabled]="submitting"
                        class="clear-btn"
                      ></button>

                      <button
                        pButton
                        (click)="submitTimesheet()"
                        label="Submit Timesheet"
                        icon="pi pi-send"
                        [loading]="submitting"
                        [disabled]="!canSubmit()"
                        class="submit-btn"
                      ></button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Progress & Results -->
              <div class="panel-card results-card" *ngIf="submitting || lastResult">
                <div class="card-header">
                  <div class="card-icon">📈</div>
                  <div>
                    <h3 class="card-title">Submission Progress</h3>
                    <p class="card-subtitle">Track your submission status</p>
                  </div>
                </div>

                <div class="card-content">
                  <div *ngIf="submitting" class="progress-section">
                    <p class="progress-text">Submitting your timesheet entries...</p>
                    <p-progressBar
                      [value]="submissionProgress"
                      styleClass="modern-progress"
                    ></p-progressBar>
                  </div>

                  <div *ngIf="lastResult" class="results-section">
                    <div class="results-grid">
                      <div class="result-card total-card">
                        <div class="result-icon">📊</div>
                        <div class="result-number">{{ lastResult.summary.total }}</div>
                        <div class="result-label">Total Entries</div>
                      </div>
                      <div class="result-card success-card">
                        <div class="result-icon">✅</div>
                        <div class="result-number">{{ lastResult.summary.successful }}</div>
                        <div class="result-label">Successful</div>
                      </div>
                      <div class="result-card error-card">
                        <div class="result-icon">❌</div>
                        <div class="result-number">{{ lastResult.summary.failed }}</div>
                        <div class="result-label">Failed</div>
                      </div>
                    </div>

                    <div *ngIf="lastResult.errors.length > 0" class="errors-section">
                      <h4 class="errors-title">Failed Submissions</h4>
                      <div class="errors-list">
                        <div *ngFor="let error of lastResult.errors" class="error-item">
                          <div class="error-date">{{ error.date }}</div>
                          <div class="error-message">{{ error.error }}</div>
                          <div *ngIf="error.status" class="error-status">
                            Status: {{ error.status }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <div class="panel-card submit-timesheet-card" *ngIf="activeTab === 'submit'">
              <div class="card-header">
                <div class="card-icon">📤</div>
                <div>
                  <h3 class="card-title">Submit Timesheet</h3>
                  <p class="card-subtitle">Create Productive timesheets for selected dates</p>
                </div>
              </div>

              <div class="card-content">
                <div class="submit-summary">
                  <div class="submit-summary-item">
                    <span class="summary-label">Date range</span>
                    <strong>{{ getDateRangePreview() || 'No range selected' }}</strong>
                  </div>
                  <div class="submit-summary-item">
                    <span class="summary-label">Person ID</span>
                    <strong>{{ config.personId || '-' }}</strong>
                  </div>
                </div>

                <button
                  pButton
                  (click)="submitTimesheets()"
                  label="Submit selected timesheets"
                  icon="pi pi-send"
                  [loading]="timesheetSubmitting"
                  [disabled]="!canSubmitTimesheets()"
                  class="submit-btn submit-timesheets-btn"
                ></button>

                <div class="results-section submit-result" *ngIf="timesheetSubmitResult">
                  <div class="results-grid">
                    <div class="result-card total-card">
                      <div class="result-number">{{ timesheetSubmitResult.summary.total }}</div>
                      <div class="result-label">Total dates</div>
                    </div>
                    <div class="result-card success-card">
                      <div class="result-number">
                        {{ timesheetSubmitResult.summary.successful }}
                      </div>
                      <div class="result-label">Submitted</div>
                    </div>
                    <div class="result-card error-card">
                      <div class="result-number">{{ timesheetSubmitResult.summary.failed }}</div>
                      <div class="result-label">Failed</div>
                    </div>
                  </div>

                  <div *ngIf="timesheetSubmitResult.errors.length > 0" class="errors-section">
                    <h4 class="errors-title">Failed submissions</h4>
                    <div class="errors-list">
                      <div *ngFor="let error of timesheetSubmitResult.errors" class="error-item">
                        <div class="error-date">{{ error.date }}</div>
                        <div class="error-message">{{ error.error }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="panel-card detail-card" *ngIf="activeTab === 'detail'">
              <div class="card-header">
                <div class="card-icon">🗓️</div>
                <div>
                  <h3 class="card-title">Timesheet Calendar</h3>
                  <p class="card-subtitle">View logged time entries by day</p>
                </div>
              </div>

              <div class="card-content">
                <div class="detail-toolbar">
                  <div class="month-picker-field">
                    <button
                      type="button"
                      class="month-nav-btn"
                      aria-label="Previous month"
                      (click)="changeDetailMonth(-1)"
                    >
                      <i class="pi pi-chevron-left"></i>
                    </button>

                    <label for="detailMonth">
                      <i class="pi pi-calendar"></i>
                      Detail month
                    </label>
                    <input
                      id="detailMonth"
                      type="month"
                      [(ngModel)]="detailMonth"
                      (ngModelChange)="onDetailMonthChange()"
                      class="styled-input native-date-input"
                    />

                    <button
                      type="button"
                      class="month-nav-btn"
                      aria-label="Next month"
                      (click)="changeDetailMonth(1)"
                    >
                      <i class="pi pi-chevron-right"></i>
                    </button>
                  </div>

                  <button
                    pButton
                    (click)="loadTimesheetDetails()"
                    label="Load timesheet detail"
                    icon="pi pi-refresh"
                    [loading]="detailLoading"
                    [disabled]="!canLoadDetails()"
                    class="generate-entries-btn"
                  ></button>

                  <div class="detail-total" *ngIf="calendarDays.length > 0">
                    <strong>{{ minutesToHours(getCalendarTotalMinutes()) }}</strong>
                    <span>logged in {{ getDetailMonthLabel() }}</span>
                  </div>
                </div>

                <div class="calendar-grid" *ngIf="calendarDays.length > 0">
                  <div class="calendar-weekday" *ngFor="let day of calendarWeekdays">{{ day }}</div>
                  <div
                    class="calendar-day"
                    *ngFor="let day of calendarDays"
                    [class.weekend]="day.isWeekend"
                    [class.outside]="day.isOutsideRange"
                    [class.has-entry]="day.entries.length > 0"
                    [class.submitted]="day.isSubmitted"
                    [class.approved]="day.isApproved"
                    [class.holiday]="day.isHoliday"
                    [style.grid-column-start]="day.gridColumnStart || null"
                  >
                    <div class="calendar-day-header">
                      <span>{{ day.dayNumber }}</span>
                      <small>{{ day.weekday }}</small>
                    </div>

                    <div class="holiday-banner" *ngIf="day.isHoliday">
                      <i class="pi pi-flag"></i>
                      <div>
                        <strong>Vietnam holiday</strong>
                        <span>{{ getHolidayTitles(day).join(', ') }}</span>
                      </div>
                    </div>

                    <div class="calendar-day-total" *ngIf="day.entries.length > 0">
                      {{ minutesToHours(day.totalMinutes) }}
                    </div>

                    <div class="calendar-status-row" *ngIf="day.isSubmitted || day.isApproved">
                      <span class="calendar-status approved-status" *ngIf="day.isApproved"
                        >Approved</span
                      >
                      <span
                        class="calendar-status submitted-status"
                        *ngIf="!day.isApproved && day.isSubmitted"
                        >Submitted</span
                      >
                    </div>

                    <div class="calendar-event-list" *ngIf="day.events.length > 0">
                      <div
                        class="calendar-event"
                        *ngFor="let event of day.events"
                        [class.holiday-event]="isHolidayEvent(event)"
                      >
                        <i
                          class="pi"
                          [class.pi-flag]="isHolidayEvent(event)"
                          [class.pi-calendar]="!isHolidayEvent(event)"
                        ></i>
                        <span>{{ getCalendarEventTitle(event) }}</span>
                      </div>
                    </div>

                    <div class="calendar-entry-list">
                      <div
                        class="calendar-entry"
                        *ngFor="let entry of day.entries"
                        [class.entry-approved]="entry.attributes.approved"
                        [class.entry-submitted]="
                          entry.attributes.submitted && !entry.attributes.approved
                        "
                      >
                        <strong>{{ minutesToHours(entry.attributes.time || 0) }}</strong>
                        <span>{{ entry.attributes.note || 'No note' }}</span>
                        <em *ngIf="entry.attributes.approved">Approved</em>
                        <em *ngIf="!entry.attributes.approved && entry.attributes.submitted"
                          >Submitted</em
                        >
                      </div>
                    </div>
                  </div>
                </div>

                <div class="empty-calendar" *ngIf="!detailLoading && calendarDays.length === 0">
                  Select a month and click "Load timesheet detail".
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p-toast></p-toast>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        font-family:
          'Inter',
          -apple-system,
          BlinkMacSystemFont,
          sans-serif;
        overflow-x: hidden;
      }

      /* App Container */
      .app-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
      }

      /* Hero Section */
      .hero-section {
        position: relative;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 28px 40px;
        text-align: center;
        color: white;
        overflow: hidden;
        flex: 0 0 auto;
      }

      .hero-content {
        position: relative;
        z-index: 2;
      }

      .hero-icon {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
        display: block;
        animation: bounce 2s infinite;
      }

      .hero-title {
        font-size: 2.5rem;
        font-weight: 800;
        margin: 0 0 0.5rem 0;
        text-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      }

      .hero-subtitle {
        font-size: 1rem;
        opacity: 0.9;
        margin: 0;
        font-weight: 400;
      }

      .hero-decoration {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
      }

      .decoration-circle {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        animation: float 6s ease-in-out infinite;
      }

      .circle-1 {
        width: 200px;
        height: 200px;
        top: -100px;
        left: -100px;
        animation-delay: 0s;
      }

      .circle-2 {
        width: 150px;
        height: 150px;
        top: 50%;
        right: -75px;
        animation-delay: 2s;
      }

      .circle-3 {
        width: 100px;
        height: 100px;
        bottom: -50px;
        left: 50%;
        animation-delay: 4s;
      }

      @keyframes bounce {
        0%,
        20%,
        53%,
        80%,
        100% {
          transform: translateY(0);
        }
        40%,
        43% {
          transform: translateY(-15px);
        }
        70% {
          transform: translateY(-10px);
        }
        90% {
          transform: translateY(-4px);
        }
      }

      @keyframes float {
        0%,
        100% {
          transform: translateY(0px) rotate(0deg);
        }
        50% {
          transform: translateY(-20px) rotate(180deg);
        }
      }

      /* Main Content */
      .main-content {
        background: #f8fafc;
        flex: 1 1 auto;
        min-height: 0;
        padding: 24px;
      }

      .content-grid {
        display: grid;
        grid-template-columns: 400px 1fr;
        gap: 30px;
        max-width: 1400px;
        margin: 0 auto;
        align-items: start;
      }

      @media (max-width: 1200px) {
        .content-grid {
          grid-template-columns: 1fr;
          gap: 20px;
        }
        .main-content {
          padding: 20px;
        }
      }

      .main-panel {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .tabs-card {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        padding: 8px;
        border: 1px solid #dbe4f0;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.86);
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        backdrop-filter: blur(10px);
      }

      .tab-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 46px;
        padding: 10px 14px;
        border: 0;
        border-radius: 14px;
        color: #475569;
        background: transparent;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .tab-button:hover {
        color: #4338ca;
        background: #eef2ff;
      }

      .tab-button.active {
        color: white;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        box-shadow: 0 10px 24px rgba(99, 102, 241, 0.28);
      }

      /* Panel Cards */
      .panel-card {
        background: white;
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        transition: all 0.3s ease;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .panel-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
      }

      .card-header {
        padding: 18px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .card-icon {
        font-size: 1.6rem;
        line-height: 1;
      }

      .card-title {
        font-size: 1.25rem;
        font-weight: 700;
        margin: 0 0 4px 0;
      }

      .card-subtitle {
        font-size: 0.95rem;
        opacity: 0.9;
        margin: 0;
        font-weight: 400;
      }

      .card-content {
        padding: 22px;
      }

      /* Configuration Panel */
      .config-panel {
        height: fit-content;
      }

      .config-card {
        position: sticky;
        top: 20px;
      }

      /* Input Groups */
      .input-group {
        margin-bottom: 16px;
      }

      .input-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 8px;
        font-size: 0.95rem;
      }

      .input-wrapper {
        position: relative;
      }

      .styled-input {
        width: 100%;
        padding: 12px 14px;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        font-size: 1rem;
        transition: all 0.3s ease;
        background: #fafbfc;
      }

      .styled-input:focus {
        border-color: #667eea;
        background: white;
        box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        outline: none;
      }

      .styled-input::placeholder {
        color: #9ca3af;
      }

      .native-date-input {
        color-scheme: light;
        min-height: 46px;
      }

      .number-input {
        appearance: textfield;
        min-height: 46px;
        font-weight: 700;
        color: #0f172a;
      }

      .number-input::-webkit-outer-spin-button,
      .number-input::-webkit-inner-spin-button,
      .table-input::-webkit-outer-spin-button,
      .table-input::-webkit-inner-spin-button {
        margin: 0;
        appearance: none;
      }

      .native-date-input::-webkit-calendar-picker-indicator,
      .range-date-input::-webkit-calendar-picker-indicator {
        cursor: pointer;
        opacity: 0.75;
        transform: scale(1.15);
      }

      /* Buttons */
      ::ng-deep .p-button .p-button-icon-left {
        margin-right: 0.65rem;
      }

      ::ng-deep .p-button .p-button-icon-right {
        margin-left: 0.65rem;
      }

      ::ng-deep .p-button .p-button-label {
        line-height: 1;
      }

      .save-config-btn {
        width: 100%;
        padding: 14px;
        font-weight: 600;
        border-radius: 12px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        border: none;
        color: white;
        font-size: 1rem;
        transition: all 0.3s ease;
      }

      .save-config-btn:enabled:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
      }

      .save-config-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* Date range */
      .range-shell {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .range-picker-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 52px minmax(0, 1fr);
        align-items: center;
        gap: 16px;
        padding: 18px;
        border: 1px solid #dbe4f0;
        border-radius: 24px;
        background: linear-gradient(135deg, #f8fbff 0%, #eef4ff 100%);
      }

      .range-field {
        position: relative;
        display: grid;
        gap: 8px;
        padding: 16px;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        background: white;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      }

      .range-field label {
        padding-left: 40px;
        color: #64748b;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .range-field-icon {
        position: absolute;
        top: 18px;
        left: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 10px;
        color: #4f46e5;
        background: #eef2ff;
      }

      .range-date-input {
        width: 100%;
        height: 42px;
        padding: 0;
        border: 0;
        outline: none;
        color: #0f172a;
        background: transparent;
        font: inherit;
        font-size: 1.18rem;
        font-weight: 750;
        color-scheme: light;
      }

      .range-field:focus-within {
        border-color: #818cf8;
        box-shadow:
          0 0 0 4px rgba(99, 102, 241, 0.12),
          0 14px 28px rgba(15, 23, 42, 0.08);
      }

      .range-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 999px;
        color: white;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        box-shadow: 0 12px 24px rgba(99, 102, 241, 0.28);
      }

      .range-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .quick-buttons {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .quick-btn {
        padding: 10px 16px;
        border: 1px solid #dbe4f0;
        border-radius: 999px;
        color: #334155;
        background: white;
        font-size: 0.85rem;
        font-weight: 750;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .quick-btn:hover {
        border-color: #667eea;
        color: #667eea;
        background: #f8fafc;
        transform: translateY(-1px);
      }

      .workday-toggle {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 16px;
        background: #fffbeb;
        border: 1px solid #fde68a;
      }

      .workday-toggle label {
        cursor: pointer;
        display: flex;
        flex-direction: column;
      }

      .workday-toggle span {
        font-weight: 600;
        color: #92400e;
        font-size: 0.95rem;
        line-height: 1.2;
      }

      .workday-toggle small {
        font-size: 0.8rem;
        color: #a16207;
        font-weight: 400;
      }

      ::ng-deep .workday-toggle .p-checkbox {
        display: inline-flex;
        position: relative;
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
      }

      ::ng-deep .workday-toggle .p-checkbox input,
      ::ng-deep .workday-toggle .p-hidden-accessible,
      ::ng-deep .workday-toggle .p-hidden-accessible input {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .range-footer {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
      }

      .range-preview {
        display: flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        padding: 12px 20px;
        border-radius: 12px;
        border: 1px solid #3b82f6;
        color: #1e40af;
        font-weight: 600;
        font-size: 0.9rem;
      }

      .empty-preview {
        background: #f8fafc;
        border-color: #e2e8f0;
      }

      .empty-preview .preview-info,
      .empty-preview {
        color: #64748b;
      }

      .preview-info {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #1e40af;
        font-weight: 600;
        font-size: 0.9rem;
      }

      .generate-entries-btn {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
        border: none !important;
        color: white !important;
        padding: 14px 24px !important;
        font-weight: 700 !important;
        border-radius: 14px !important;
        font-size: 1rem !important;
        transition: all 0.3s ease !important;
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3) !important;
        white-space: nowrap;
      }

      .generate-entries-btn:enabled:hover {
        transform: translateY(-3px) !important;
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4) !important;
      }

      .generate-entries-btn:disabled {
        opacity: 0.6 !important;
        cursor: not-allowed !important;
        transform: none !important;
        box-shadow: none !important;
      }

      /* Bulk Settings */
      .bulk-grid {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 20px;
        align-items: end;
      }

      .apply-bulk-btn {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        border: none;
        color: white;
        padding: 14px 20px;
        font-weight: 600;
        border-radius: 12px;
        transition: all 0.3s ease;
        white-space: nowrap;
      }

      .apply-bulk-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4);
      }

      /* Table Styles */
      .table-wrapper {
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid #e5e7eb;
        margin-bottom: 24px;
        background: white;
      }

      .date-col {
        width: 150px;
        min-width: 150px;
        max-width: 150px;
      }

      .hours-col {
        width: 112px;
        min-width: 112px;
        max-width: 112px;
        text-align: center;
      }

      .note-col {
        min-width: 320px;
      }

      .status-col {
        width: 126px;
        min-width: 126px;
        max-width: 126px;
        text-align: center;
      }

      .date-cell {
        padding: 16px !important;
      }

      .date-display {
        font-weight: 600;
        color: #374151;
        font-size: 0.95rem;
      }

      .date-small {
        font-size: 0.8rem;
        color: #6b7280;
        margin-top: 2px;
      }

      .table-input {
        width: 76px;
        height: 38px;
        padding: 0 10px;
        border: 1px solid #dbe4f0;
        border-radius: 12px;
        text-align: center;
        font: inherit;
        font-weight: 800;
        color: #0f172a;
        background: #f8fafc;
        appearance: textfield;
        transition: all 0.2s ease;
      }

      .table-input:focus {
        border-color: #6366f1;
        background: white;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.14);
        outline: none;
      }

      .table-input:hover {
        border-color: #94a3b8;
        background: white;
      }

      .note-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        resize: vertical;
        font-family: inherit;
        min-height: 50px;
      }

      .note-input:focus {
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        outline: none;
      }

      .status-tag {
        font-weight: 600;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
      }

      /* Table Footer */
      .table-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 0;
        border-top: 1px solid #e5e7eb;
      }

      .summary-stats {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .stat-item {
        text-align: center;
      }

      .stat-value {
        display: block;
        font-size: 1.5rem;
        font-weight: 700;
        color: #374151;
        line-height: 1.2;
      }

      .stat-label {
        display: block;
        font-size: 0.85rem;
        color: #6b7280;
        font-weight: 500;
      }

      .stat-divider {
        width: 1px;
        height: 40px;
        background: #e5e7eb;
      }

      .action-buttons {
        display: flex;
        gap: 12px;
      }

      .clear-btn {
        background: #6b7280;
        border: none;
        color: white;
        padding: 12px 20px;
        font-weight: 600;
        border-radius: 10px;
        transition: all 0.3s ease;
      }

      .clear-btn:enabled:hover {
        background: #4b5563;
        transform: translateY(-1px);
      }

      .submit-btn {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        border: none;
        color: white;
        padding: 12px 24px;
        font-weight: 600;
        border-radius: 10px;
        transition: all 0.3s ease;
      }

      .submit-btn:enabled:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
      }

      .submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .submit-summary {
        display: grid;
        grid-template-columns: 1fr 180px;
        gap: 16px;
        margin-bottom: 20px;
      }

      .submit-summary-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 16px;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        background: #f8fafc;
      }

      .summary-label {
        color: #64748b;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .submit-timesheets-btn {
        min-width: 240px;
      }

      .submit-result {
        margin-top: 24px;
      }

      .detail-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 20px;
      }

      .month-picker-field {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        background: #f8fafc;
      }

      .month-nav-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border: 1px solid #dbe4f0;
        border-radius: 12px;
        color: #475569;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .month-nav-btn:hover {
        color: white;
        border-color: #6366f1;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        box-shadow: 0 8px 18px rgba(99, 102, 241, 0.24);
      }

      .month-picker-field label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #334155;
        font-size: 0.85rem;
        font-weight: 900;
        white-space: nowrap;
      }

      .month-picker-field input {
        width: 170px;
        min-height: 42px;
        padding: 10px 12px;
        background: white;
      }

      .detail-total {
        display: flex;
        align-items: baseline;
        gap: 8px;
        color: #475569;
      }

      .detail-total strong {
        color: #0f172a;
        font-size: 1.5rem;
        font-weight: 900;
      }

      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(118px, 1fr));
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 8px;
      }

      .calendar-weekday {
        padding: 10px 12px;
        color: #64748b;
        background: #f8fafc;
        border-radius: 12px;
        font-size: 0.78rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-align: center;
        text-transform: uppercase;
      }

      .calendar-day {
        min-height: 132px;
        padding: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        background: white;
      }

      .calendar-day.weekend {
        background: #fff7ed;
      }

      .calendar-day.outside {
        opacity: 0.45;
      }

      .calendar-day.has-entry {
        border-color: #93c5fd;
        background: #eff6ff;
      }

      .calendar-day.submitted {
        border-color: #fbbf24;
        background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      }

      .calendar-day.approved {
        border-color: #34d399;
        background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      }

      .calendar-day.holiday {
        border-color: #fb7185;
        background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
      }

      .holiday-banner {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
        padding: 8px;
        border: 1px solid #fb7185;
        border-radius: 12px;
        color: #9f1239;
        background: rgba(255, 255, 255, 0.78);
      }

      .holiday-banner i {
        margin-top: 2px;
        color: #e11d48;
      }

      .holiday-banner div {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      .holiday-banner strong {
        font-size: 0.72rem;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .holiday-banner span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.76rem;
        font-weight: 800;
      }

      .calendar-day-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        color: #334155;
        font-weight: 900;
      }

      .calendar-day-header small {
        color: #94a3b8;
        font-size: 0.72rem;
        text-transform: uppercase;
      }

      .calendar-day-total {
        display: inline-flex;
        margin-bottom: 8px;
        padding: 4px 8px;
        border-radius: 999px;
        color: #1d4ed8;
        background: white;
        font-size: 0.78rem;
        font-weight: 900;
      }

      .calendar-status-row {
        margin-bottom: 8px;
      }

      .calendar-status {
        display: inline-flex;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 0.68rem;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .submitted-status {
        color: #92400e;
        background: #fde68a;
      }

      .approved-status {
        color: #065f46;
        background: #a7f3d0;
      }

      .calendar-entry-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .calendar-event-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 8px;
      }

      .calendar-event {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border-radius: 10px;
        color: #475569;
        background: rgba(255, 255, 255, 0.75);
        font-size: 0.72rem;
        font-weight: 800;
      }

      .calendar-event.holiday-event {
        color: #be123c;
        background: #ffe4e6;
      }

      .calendar-entry {
        display: grid;
        gap: 2px;
        padding: 8px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.82);
        color: #334155;
        font-size: 0.78rem;
      }

      .calendar-entry.entry-submitted {
        border-left: 3px solid #f59e0b;
      }

      .calendar-entry.entry-approved {
        border-left: 3px solid #10b981;
      }

      .calendar-entry strong {
        color: #0f172a;
      }

      .calendar-entry em {
        color: #64748b;
        font-size: 0.68rem;
        font-style: normal;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .calendar-entry span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .empty-calendar {
        padding: 28px;
        border: 1px dashed #cbd5e1;
        border-radius: 16px;
        color: #64748b;
        background: #f8fafc;
        text-align: center;
        font-weight: 700;
      }

      /* Progress & Results */
      .progress-section {
        margin-bottom: 24px;
      }

      .progress-text {
        font-weight: 500;
        color: #374151;
        margin-bottom: 12px;
      }

      .results-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        margin-bottom: 24px;
      }

      .result-card {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        padding: 24px;
        border-radius: 16px;
        text-align: center;
        border: 1px solid #e5e7eb;
        transition: all 0.3s ease;
      }

      .result-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
      }

      .total-card {
        border-left: 4px solid #3b82f6;
      }

      .success-card {
        border-left: 4px solid #10b981;
      }

      .error-card {
        border-left: 4px solid #ef4444;
      }

      .result-icon {
        font-size: 2rem;
        margin-bottom: 8px;
      }

      .result-number {
        font-size: 2.5rem;
        font-weight: 800;
        margin-bottom: 4px;
        color: #374151;
      }

      .result-label {
        font-size: 0.9rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .errors-section {
        border-top: 1px solid #e5e7eb;
        padding-top: 24px;
      }

      .errors-title {
        font-size: 1.2rem;
        font-weight: 700;
        color: #ef4444;
        margin-bottom: 16px;
      }

      .errors-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .error-item {
        background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        padding: 16px;
        border-radius: 12px;
        border-left: 4px solid #ef4444;
      }

      .error-date {
        font-weight: 600;
        color: #374151;
        margin-bottom: 4px;
      }

      .error-message {
        color: #dc2626;
        margin-bottom: 4px;
      }

      .error-status {
        font-size: 0.85rem;
        color: #6b7280;
      }

      /* PrimeNG Overrides */
      ::ng-deep .p-button {
        transition: all 0.3s ease;
      }

      ::ng-deep .p-button:enabled:hover {
        transform: translateY(-1px);
      }

      ::ng-deep .p-inputtext {
        transition: all 0.3s ease;
      }

      ::ng-deep .p-checkbox .p-checkbox-box {
        border: 2px solid #d97706 !important;
        border-radius: 6px !important;
        width: 20px !important;
        height: 20px !important;
        transition: all 0.3s ease !important;
      }

      ::ng-deep .p-checkbox .p-checkbox-box.p-highlight {
        background: #f59e0b !important;
        border-color: #f59e0b !important;
      }

      ::ng-deep .p-checkbox .p-checkbox-box .p-checkbox-icon {
        color: white !important;
        font-size: 12px !important;
      }

      ::ng-deep .modern-table .p-datatable-wrapper {
        max-height: 360px !important;
        overflow-y: auto !important;
        overflow-x: auto !important;
        scrollbar-color: #94a3b8 #f1f5f9;
        scrollbar-width: thin;
      }

      ::ng-deep .modern-table .p-datatable-wrapper::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      ::ng-deep .modern-table .p-datatable-wrapper::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 999px;
      }

      ::ng-deep .modern-table .p-datatable-wrapper::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
        border: 2px solid #f1f5f9;
        border-radius: 999px;
      }

      ::ng-deep .modern-table .p-datatable-wrapper::-webkit-scrollbar-thumb:hover {
        background: #475569;
      }

      ::ng-deep .modern-table table {
        table-layout: fixed;
        min-width: 820px;
      }

      ::ng-deep .modern-table .p-datatable-thead > tr > th,
      ::ng-deep .modern-table .p-datatable-scrollable-header th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #f8fafc !important;
        color: #334155;
        font-weight: 800;
        padding: 14px 16px;
        border: 0;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: inset 0 -1px 0 #e2e8f0;
      }

      ::ng-deep .modern-table .p-datatable-tbody > tr > td {
        padding: 14px 16px;
        border-bottom: 1px solid #f3f4f6;
        vertical-align: middle;
        background: white;
      }

      ::ng-deep .modern-table .p-datatable-tbody > tr:hover {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      }

      ::ng-deep .modern-progress .p-progressbar {
        height: 12px;
        border-radius: 6px;
        background: #f3f4f6;
        overflow: hidden;
      }

      ::ng-deep .modern-progress .p-progressbar-value {
        background: linear-gradient(90deg, #10b981 0%, #059669 100%);
        transition: width 0.5s ease;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .hero-section {
          padding: 40px 20px;
        }

        .hero-title {
          font-size: 2.5rem;
        }

        .tabs-card {
          grid-template-columns: 1fr;
        }

        .range-picker-card {
          grid-template-columns: 1fr;
          gap: 20px;
        }

        .range-arrow {
          width: 44px;
          height: 44px;
          margin: 0 auto;
          transform: rotate(90deg);
        }

        .range-actions,
        .range-footer {
          align-items: stretch;
          flex-direction: column;
        }

        .quick-buttons,
        .workday-toggle {
          justify-content: center;
        }

        .bulk-grid {
          grid-template-columns: 1fr;
          gap: 16px;
        }

        .results-grid {
          grid-template-columns: 1fr;
        }

        .submit-summary,
        .detail-toolbar {
          grid-template-columns: 1fr;
          align-items: stretch;
          flex-direction: column;
        }

        .month-picker-field {
          align-items: stretch;
          display: grid;
          grid-template-columns: 42px 1fr 42px;
        }

        .month-picker-field input {
          width: 100%;
          grid-column: 1 / -1;
        }

        .month-picker-field label {
          justify-content: center;
          grid-column: 1 / -1;
        }

        .table-footer {
          flex-direction: column;
          gap: 20px;
          align-items: stretch;
        }

        .action-buttons {
          justify-content: stretch;
        }

        .action-buttons button {
          flex: 1;
        }

        .summary-stats {
          justify-content: space-around;
        }
      }
    `,
  ],
})
export class MyTimesheetComponent implements OnInit, OnDestroy {
  // Configuration
  config: TimesheetConfig = {
    authToken: '',
    organizationId: '',
    personId: '',
    serviceId: '',
    calendarIntegrationId: '98330',
    clientDate: '',
  };

  // Date range
  startDate: string = '';
  endDate: string = '';
  businessDaysOnly: boolean = true;
  clientDate: string = '';
  activeTab: TimesheetTab = 'log';
  calendarWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  detailMonth: string = '';

  // Bulk settings
  bulkHours: number = 8;
  bulkNote: string = '';

  // Date entries with display fields
  dateEntries: Array<
    TimesheetEntry & {
      hours: number;
      billableHours: number;
      submitted?: boolean;
      error?: string;
    }
  > = [];

  // Submission state
  submitting: boolean = false;
  submissionProgress: number = 0;
  lastResult: TimesheetSubmissionResult | null = null;
  timesheetSubmitting: boolean = false;
  timesheetSubmitResult: TimesheetSubmissionResult | null = null;
  detailLoading: boolean = false;
  detailEntries: ProductiveTimeEntry[] = [];
  calendarEvents: ProductiveCalendarEvent[] = [];
  holidayDates = new Set<string>();
  calendarDays: TimesheetCalendarDay[] = [];

  private previousBodyOverflow = '';
  private previousBodyOverflowY = '';
  private previousBodyHeight = '';
  private previousBodyWidth = '';
  private previousHtmlHeight = '';
  private previousHtmlOverflowY = '';

  constructor(
    private timesheetService: TimesheetService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit() {
    this.enableGlobalScroll();
    this.loadSavedConfig();
    this.clientDate = this.toDateInputValue(new Date());

    // Set default date range to current week business days
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday

    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() - today.getDay() + 5); // Friday

    this.startDate = this.toDateInputValue(startOfWeek);
    this.endDate = this.toDateInputValue(endOfWeek);
    this.detailMonth = this.toMonthInputValue(today);
  }

  ngOnDestroy(): void {
    this.restoreGlobalScroll();
  }

  isConfigValid(): boolean {
    return !!(
      this.config.authToken &&
      this.config.organizationId &&
      this.config.personId &&
      this.config.serviceId
    );
  }

  saveConfig() {
    if (this.isConfigValid()) {
      this.config.clientDate = this.clientDate || this.toDateInputValue(new Date());
      localStorage.setItem('timesheet_config', JSON.stringify(this.config));
      this.messageService.add({
        severity: 'success',
        summary: 'Configuration Saved',
        detail: 'Your configuration has been saved locally',
      });
    }
  }

  setActiveTab(tab: TimesheetTab): void {
    this.activeTab = tab;

    if (tab === 'detail') {
      if (!this.detailMonth) {
        this.detailMonth = this.toMonthInputValue(new Date());
      }

      this.loadTimesheetDetails();
    }
  }

  changeDetailMonth(offset: number): void {
    const [year, month] = (this.detailMonth || this.toMonthInputValue(new Date()))
      .split('-')
      .map(Number);
    const nextMonth = new Date(year, month - 1 + offset, 1);
    this.detailMonth = this.toMonthInputValue(nextMonth);
    this.loadTimesheetDetails();
  }

  onDetailMonthChange(): void {
    if (this.activeTab === 'detail') {
      this.loadTimesheetDetails();
    }
  }

  loadSavedConfig() {
    const saved = localStorage.getItem('timesheet_config');
    if (saved) {
      try {
        const savedConfig = JSON.parse(saved);
        this.config = {
          ...this.config,
          ...savedConfig,
          calendarIntegrationId:
            savedConfig.calendarIntegrationId || this.config.calendarIntegrationId || '98330',
        };
        if (this.config.clientDate) {
          this.clientDate = this.config.clientDate;
        }
      } catch (e) {
        console.error('Failed to load saved config:', e);
      }
    }
  }

  async generateDateEntries() {
    if (!this.startDate || !this.endDate) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Missing Dates',
        detail: 'Please select both start and end dates',
      });
      return;
    }

    const startDate = this.parseDateInput(this.startDate);
    const endDate = this.parseDateInput(this.endDate);

    if (startDate > endDate) {
      this.messageService.add({
        severity: 'error',
        summary: 'Invalid Range',
        detail: 'Start date must be before end date',
      });
      return;
    }

    const dates = this.businessDaysOnly
      ? this.timesheetService.getBusinessDays(startDate, endDate)
      : this.timesheetService.generateDateRange(startDate, endDate);
    const holidayDates = await this.loadHolidayDatesForRange(this.startDate, this.endDate);
    const workingDates = this.timesheetService.filterOutDates(dates, holidayDates);

    this.dateEntries = workingDates.map((date) => ({
      date,
      time: 480, // 8 hours in minutes
      billableTime: 480,
      note: '',
      hours: 8,
      billableHours: 8,
    }));

    this.messageService.add({
      severity: 'info',
      summary: 'Entries Generated',
      detail: `Generated ${workingDates.length} entries${holidayDates.size ? `, skipped ${holidayDates.size} Vietnam holiday date(s)` : ''}`,
    });
  }

  applyBulkSettings() {
    this.dateEntries.forEach((entry, i) => {
      entry.hours = this.bulkHours;
      entry.billableHours = this.bulkHours;
      entry.note = this.bulkNote;
      this.updateEntryTime(i);
      this.updateEntryBillableTime(i);
    });

    this.messageService.add({
      severity: 'success',
      summary: 'Bulk Applied',
      detail: 'Settings applied to all entries',
    });
  }

  updateEntryTime(index: number) {
    const entry = this.dateEntries[index];
    entry.time = this.timesheetService.hoursToMinutes(entry.hours || 0);
  }

  updateEntryBillableTime(index: number) {
    const entry = this.dateEntries[index];
    entry.billableTime = this.timesheetService.hoursToMinutes(entry.billableHours || 0);
  }

  getEntryStatus(entry: any): string {
    if (entry.submitted) return 'Submitted';
    if (entry.error) return 'Error';
    if (entry.hours > 0) return 'Ready';
    return 'Empty';
  }

  getEntryStatusSeverity(
    entry: any
  ): 'danger' | 'warn' | 'success' | 'info' | 'secondary' | 'contrast' | undefined {
    if (entry.submitted) return 'success';
    if (entry.error) return 'danger';
    if (entry.hours > 0) return 'info';
    return 'warn';
  }

  getTotalHours(): number {
    return this.dateEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  }

  getTotalBillableHours(): number {
    return this.dateEntries.reduce((sum, entry) => sum + (entry.billableHours || 0), 0);
  }

  canSubmit(): boolean {
    return (
      this.isConfigValid() &&
      this.dateEntries.length > 0 &&
      this.dateEntries.some((entry) => entry.hours > 0) &&
      !this.submitting
    );
  }

  canSubmitTimesheets(): boolean {
    return this.isConfigValid() && !!this.startDate && !!this.endDate && !this.timesheetSubmitting;
  }

  canLoadDetails(): boolean {
    return this.isConfigValid() && !!this.detailMonth && !this.detailLoading;
  }

  async submitTimesheet() {
    if (!this.canSubmit()) return;

    this.submitting = true;
    this.submissionProgress = 0;
    this.lastResult = null;

    // Filter entries with hours > 0
    const validEntries = this.dateEntries
      .filter((entry) => entry.hours > 0)
      .map((entry) => ({
        date: entry.date,
        time: entry.time,
        billableTime: entry.billableTime,
        note: entry.note,
      }));

    try {
      // Update config with current client date
      this.config.clientDate = this.clientDate || this.toDateInputValue(new Date());

      this.timesheetService.submitTimesheet(this.config, validEntries).subscribe({
        next: (result) => {
          this.lastResult = result;
          this.submissionProgress = 100;

          // Update entry statuses
          this.dateEntries.forEach((entry) => {
            const resultEntry = result.results.find((r) => r.date === entry.date);
            const errorEntry = result.errors.find((e) => e.date === entry.date);

            if (resultEntry?.success) {
              entry.submitted = true;
              entry.error = undefined;
            } else if (errorEntry) {
              entry.submitted = false;
              entry.error = errorEntry.error;
            }
          });

          this.messageService.add({
            severity: result.success ? 'success' : 'warn',
            summary: 'Submission Complete',
            detail: `${result.summary.successful}/${result.summary.total} entries submitted successfully`,
          });

          this.submitting = false;
        },
        error: (error) => {
          console.error('Submission error:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Submission Failed',
            detail: error.message || 'An unexpected error occurred',
          });
          this.submitting = false;
        },
      });
    } catch (error) {
      console.error('Submission error:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Submission Failed',
        detail: 'An unexpected error occurred',
      });
      this.submitting = false;
    }
  }

  clearAll() {
    this.dateEntries = [];
    this.lastResult = null;
    this.messageService.add({
      severity: 'info',
      summary: 'Cleared',
      detail: 'All entries have been cleared',
    });
  }

  async submitTimesheets() {
    if (!this.canSubmitTimesheets()) {
      return;
    }

    this.timesheetSubmitting = true;
    this.timesheetSubmitResult = null;

    const selectedDates = this.getSelectedDates();
    const holidayDates = await this.loadHolidayDatesForRange(this.startDate, this.endDate);
    const dates = this.timesheetService.filterOutDates(selectedDates, holidayDates);

    if (dates.length === 0) {
      this.timesheetSubmitting = false;
      this.messageService.add({
        severity: 'warn',
        summary: 'No Dates',
        detail: 'No dates available for selected range',
      });
      return;
    }

    this.config.clientDate = this.clientDate || this.toDateInputValue(new Date());

    this.timesheetService.submitTimesheets(this.config, dates).subscribe({
      next: (result) => {
        this.timesheetSubmitResult = result;
        this.timesheetSubmitting = false;
        this.messageService.add({
          severity: result.success ? 'success' : 'warn',
          summary: 'Timesheet Submit Complete',
          detail: `${result.summary.successful}/${result.summary.total} dates submitted`,
        });
      },
      error: (error) => {
        this.timesheetSubmitting = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Timesheet Submit Failed',
          detail: error instanceof Error ? error.message : 'Unable to submit timesheets',
        });
      },
    });
  }

  loadTimesheetDetails() {
    if (!this.canLoadDetails()) {
      return;
    }

    this.detailLoading = true;
    this.calendarDays = [];
    this.detailEntries = [];
    this.calendarEvents = [];
    this.holidayDates = new Set<string>();
    this.config.clientDate = this.clientDate || this.toDateInputValue(new Date());
    const { startDate, endDate } = this.getDetailMonthRange();
    this.cdr.detectChanges();

    forkJoin({
      timeEntries: this.timesheetService.listTimeEntries(this.config, startDate, endDate),
      calendarEvents: this.timesheetService.listCalendarEvents(this.config, startDate, endDate),
    }).subscribe({
      next: ({ timeEntries, calendarEvents }) => {
        try {
          this.detailEntries = Array.isArray(timeEntries?.data) ? timeEntries.data : [];
          this.calendarEvents = Array.isArray(calendarEvents?.data) ? calendarEvents.data : [];
          this.holidayDates = this.buildHolidayDates(this.calendarEvents);
          this.calendarDays = this.buildCalendarDays(this.detailEntries, this.calendarEvents);
        } catch (error) {
          this.detailEntries = [];
          this.calendarEvents = [];
          this.holidayDates = new Set<string>();
          this.calendarDays = this.buildCalendarDays([], []);
          this.messageService.add({
            severity: 'error',
            summary: 'Render Failed',
            detail: error instanceof Error ? error.message : 'Unable to render timesheet calendar',
          });
        } finally {
          this.detailLoading = false;
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        this.detailLoading = false;
        this.calendarDays = this.buildCalendarDays([], []);
        this.messageService.add({
          severity: 'error',
          summary: 'Load Failed',
          detail: error instanceof Error ? error.message : 'Unable to load timesheet detail',
        });
        this.cdr.detectChanges();
      },
    });
  }

  minutesToHours(minutes: number): string {
    return this.timesheetService.minutesToHours(minutes);
  }

  getCalendarTotalMinutes(): number {
    return this.calendarDays.reduce((total, day) => total + day.totalMinutes, 0);
  }

  getDetailMonthLabel(): string {
    if (!this.detailMonth) {
      return 'selected month';
    }

    const [year, month] = this.detailMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }

  isHolidayEvent(event: ProductiveCalendarEvent): boolean {
    return this.timesheetService.isVietnamHolidayEvent(event);
  }

  getCalendarEventTitle(event: ProductiveCalendarEvent): string {
    return this.timesheetService.getCalendarEventTitle(event);
  }

  getHolidayTitles(day: TimesheetCalendarDay): string[] {
    const titles = day.events
      .filter((event) => this.isHolidayEvent(event))
      .map((event) => this.getCalendarEventTitle(event));

    return titles.length > 0 ? titles : ['Vietnam holiday'];
  }

  // Quick date selection methods
  setThisWeek() {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
    startOfWeek.setDate(diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday

    this.startDate = this.toDateInputValue(startOfWeek);
    this.endDate = this.toDateInputValue(endOfWeek);
  }

  setLastWeek() {
    const today = new Date();
    const lastWeekStart = new Date(today);
    const day = lastWeekStart.getDay();
    const diff = lastWeekStart.getDate() - day - 6; // Last Monday
    lastWeekStart.setDate(diff);

    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 4); // Last Friday

    this.startDate = this.toDateInputValue(lastWeekStart);
    this.endDate = this.toDateInputValue(lastWeekEnd);
  }

  setThisMonth() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    this.startDate = this.toDateInputValue(startOfMonth);
    this.endDate = this.toDateInputValue(endOfMonth);
  }

  getDateRangePreview(): string {
    if (!this.startDate || !this.endDate) return '';

    const startDate = this.parseDateInput(this.startDate);
    const endDate = this.parseDateInput(this.endDate);

    const dates = this.businessDaysOnly
      ? this.timesheetService.getBusinessDays(startDate, endDate)
      : this.timesheetService.generateDateRange(startDate, endDate);

    const dayType = this.businessDaysOnly ? 'business days' : 'days';
    return `${dates.length} ${dayType} selected (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
  }

  private getSelectedDates(): string[] {
    if (!this.startDate || !this.endDate) {
      return [];
    }

    const startDate = this.parseDateInput(this.startDate);
    const endDate = this.parseDateInput(this.endDate);

    if (startDate > endDate) {
      return [];
    }

    return this.businessDaysOnly
      ? this.timesheetService.getBusinessDays(startDate, endDate)
      : this.timesheetService.generateDateRange(startDate, endDate);
  }

  private async loadHolidayDatesForRange(startDate: string, endDate: string): Promise<Set<string>> {
    this.config.clientDate = this.clientDate || this.toDateInputValue(new Date());
    this.config.calendarIntegrationId = (this.config.calendarIntegrationId || '98330').trim();

    try {
      return await this.timesheetService.getVietnamHolidayDates(this.config, startDate, endDate);
    } catch (error) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Holiday Load Failed',
        detail: error instanceof Error ? error.message : 'Unable to load Vietnam holidays',
      });
      return new Set<string>();
    }
  }

  private buildHolidayDates(events: ProductiveCalendarEvent[]): Set<string> {
    const holidayDates = new Set<string>();

    events
      .filter((event) => this.timesheetService.isVietnamHolidayEvent(event))
      .forEach((event) => {
        this.timesheetService
          .getCalendarEventDates(event)
          .forEach((date) => holidayDates.add(date));
      });

    return holidayDates;
  }

  private buildCalendarDays(
    entries: ProductiveTimeEntry[],
    events: ProductiveCalendarEvent[]
  ): TimesheetCalendarDay[] {
    const { start, end } = this.getDetailMonthDateRange();

    const entriesByDate = entries.reduce<Record<string, ProductiveTimeEntry[]>>((acc, entry) => {
      const date = entry.attributes.date;
      acc[date] = acc[date] || [];
      acc[date].push(entry);
      return acc;
    }, {});
    const eventsByDate = events.reduce<Record<string, ProductiveCalendarEvent[]>>((acc, event) => {
      this.timesheetService.getCalendarEventDates(event).forEach((date) => {
        acc[date] = acc[date] || [];
        acc[date].push(event);
      });
      return acc;
    }, {});

    const days: TimesheetCalendarDay[] = [];
    const current = new Date(start);
    let index = 0;

    while (current <= end) {
      const date = this.toDateInputValue(current);
      const dayEntries = entriesByDate[date] || [];
      const dayEvents = eventsByDate[date] || [];
      const isApproved = dayEntries.some((entry) => !!entry.attributes.approved);
      const isSubmitted = dayEntries.some((entry) => !!entry.attributes.submitted);

      days.push({
        date,
        dayNumber: current.getDate(),
        weekday: this.calendarWeekdays[(current.getDay() + 6) % 7],
        gridColumnStart: index === 0 ? (current.getDay() === 0 ? 7 : current.getDay()) : undefined,
        isWeekend: current.getDay() === 0 || current.getDay() === 6,
        isOutsideRange: false,
        isSubmitted,
        isApproved,
        isHoliday: dayEvents.some((event) => this.timesheetService.isVietnamHolidayEvent(event)),
        totalMinutes: dayEntries.reduce((total, entry) => total + (entry.attributes.time || 0), 0),
        billableMinutes: dayEntries.reduce(
          (total, entry) => total + (entry.attributes.billable_time || 0),
          0
        ),
        entries: dayEntries,
        events: dayEvents,
      });

      current.setDate(current.getDate() + 1);
      index++;
    }

    return days;
  }

  private getDetailMonthRange(): { startDate: string; endDate: string } {
    const { start, end } = this.getDetailMonthDateRange();

    return {
      startDate: this.toDateInputValue(start),
      endDate: this.toDateInputValue(end),
    };
  }

  private getDetailMonthDateRange(): { start: Date; end: Date } {
    const [year, month] = this.detailMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    return { start, end };
  }

  private enableGlobalScroll(): void {
    const body = this.document.body;
    const html = this.document.documentElement;

    this.previousBodyOverflow = body.style.overflow;
    this.previousBodyOverflowY = body.style.overflowY;
    this.previousBodyHeight = body.style.height;
    this.previousBodyWidth = body.style.width;
    this.previousHtmlHeight = html.style.height;
    this.previousHtmlOverflowY = html.style.overflowY;

    html.style.height = 'auto';
    html.style.overflowY = 'auto';
    body.style.height = 'auto';
    body.style.width = '100%';
    body.style.overflow = 'visible';
    body.style.overflowY = 'auto';
  }

  private restoreGlobalScroll(): void {
    const body = this.document.body;
    const html = this.document.documentElement;

    body.style.overflow = this.previousBodyOverflow;
    body.style.overflowY = this.previousBodyOverflowY;
    body.style.height = this.previousBodyHeight;
    body.style.width = this.previousBodyWidth;
    html.style.height = this.previousHtmlHeight;
    html.style.overflowY = this.previousHtmlOverflowY;
  }

  private parseDateInput(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toMonthInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }
}
