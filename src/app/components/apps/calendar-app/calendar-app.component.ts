import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName?: string;
  lunarDay: number;
  lunarMonth: number;
  lunarYear: number;
  zodiac?: string;
  canChi?: string;
}

interface Holiday {
  month: number;
  day: number;
  name: string;
  isLunar: boolean;
}

@Component({
  selector: 'app-calendar-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-app.component.html',
  styleUrl: './calendar-app.component.scss'
})
export class CalendarAppComponent {
  currentDate = signal(new Date());
  selectedTab = signal<'calendar' | 'zodiac' | 'calculate' | 'settings'>('calendar');
  viewMode = signal<'month' | 'day'>('month');
  showZodiacDetail = signal(false);
  selectedZodiacDetail = signal<any>(null);
  
  // Date calculation
  startDate = signal('');
  endDate = signal('');
  addDays = signal(0);
  yearToCheck = signal(new Date().getFullYear());
  
  // Settings
  showLunarCalendar = signal(true);
  highlightHolidays = signal(true);
  firstDayOfWeek = signal<0 | 1>(1); // 0 = Sunday, 1 = Monday
  themeColor = signal<string>('blue'); // Theme color

  // Available theme colors
  themeColors = [
    { id: 'gold', name: 'Vàng', primary: '#ffd700', secondary: '#f4a300', light: '#fffef7' },
    { id: 'red', name: 'Đỏ', primary: '#ff4444', secondary: '#cc0000', light: '#fff5f5' },
    { id: 'blue', name: 'Xanh Dương', primary: '#2196F3', secondary: '#1976D2', light: '#E3F2FD' },
    { id: 'green', name: 'Xanh Lá', primary: '#4CAF50', secondary: '#388E3C', light: '#E8F5E9' },
    { id: 'purple', name: 'Tím', primary: '#9C27B0', secondary: '#7B1FA2', light: '#F3E5F5' },
    { id: 'orange', name: 'Cam', primary: '#FF9800', secondary: '#F57C00', light: '#FFF3E0' },
    { id: 'pink', name: 'Hồng', primary: '#E91E63', secondary: '#C2185B', light: '#FCE4EC' },
    { id: 'teal', name: 'Xanh Ngọc', primary: '#009688', secondary: '#00796B', light: '#E0F2F1' },
    { id: 'indigo', name: 'Chàm', primary: '#3F51B5', secondary: '#303F9F', light: '#E8EAF6' },
    { id: 'brown', name: 'Nâu', primary: '#795548', secondary: '#5D4037', light: '#EFEBE9' },
    { id: 'grey', name: 'Xám', primary: '#607D8B', secondary: '#455A64', light: '#ECEFF1' },
    { id: 'black', name: 'Đen', primary: '#212121', secondary: '#000000', light: '#F5F5F5' }
  ];
  
  // Good/Bad days detailed
  goodDayReasons = [
    'Khai trương', 'Động thổ', 'Xuất hành', 'Cưới hỏi', 'Ký kết hợp đồng'
  ];
  
  badDayReasons = [
    'Kiện tụng', 'Tang lễ', 'Phá thổ', 'Nhập trạch'
  ];
  
  // Vietnamese holidays
  holidays: Holiday[] = [
    // Solar calendar holidays
    { month: 1, day: 1, name: 'Tết Dương Lịch', isLunar: false },
    { month: 2, day: 14, name: 'Valentine', isLunar: false },
    { month: 3, day: 8, name: 'Quốc tế Phụ nữ', isLunar: false },
    { month: 4, day: 30, name: 'Giải phóng Miền Nam', isLunar: false },
    { month: 5, day: 1, name: 'Quốc tế Lao động', isLunar: false },
    { month: 6, day: 1, name: 'Quốc tế Thiếu nhi', isLunar: false },
    { month: 9, day: 2, name: 'Quốc khánh', isLunar: false },
    { month: 10, day: 20, name: 'Ngày Phụ nữ Việt Nam', isLunar: false },
    { month: 11, day: 20, name: 'Ngày Nhà giáo Việt Nam', isLunar: false },
    { month: 12, day: 24, name: 'Giáng sinh', isLunar: false },
    { month: 12, day: 25, name: 'Giáng sinh', isLunar: false },
    
    // Lunar calendar holidays
    { month: 1, day: 1, name: 'Tết Nguyên Đán', isLunar: true },
    { month: 1, day: 2, name: 'Mùng 2 Tết', isLunar: true },
    { month: 1, day: 3, name: 'Mùng 3 Tết', isLunar: true },
    { month: 1, day: 10, name: 'Rằm tháng Giêng', isLunar: true },
    { month: 1, day: 15, name: 'Rằm tháng Giêng', isLunar: true },
    { month: 3, day: 10, name: 'Giỗ Tổ Hùng Vương', isLunar: true },
    { month: 4, day: 15, name: 'Phật Đản', isLunar: true },
    { month: 5, day: 5, name: 'Tết Đoan Ngọ', isLunar: true },
    { month: 7, day: 15, name: 'Vu Lan', isLunar: true },
    { month: 8, day: 15, name: 'Tết Trung Thu', isLunar: true },
    { month: 12, day: 23, name: 'Ông Táo chầu trời', isLunar: true },
  ];
  
  // Zodiac animals in Vietnamese
  zodiacAnimals = [
    { name: 'Tý (Chuột)', years: '2020, 2008, 1996, 1984, 1972, 1960', traits: 'Thông minh, linh hoạt, nhanh nhẹn' },
    { name: 'Sửu (Trâu)', years: '2021, 2009, 1997, 1985, 1973, 1961', traits: 'Chăm chỉ, kiên nhẫn, trung thực' },
    { name: 'Dần (Hổ)', years: '2022, 2010, 1998, 1986, 1974, 1962', traits: 'Dũng cảm, tự tin, quyết đoán' },
    { name: 'Mão (Mèo)', years: '2023, 2011, 1999, 1987, 1975, 1963', traits: 'Nhẹ nhàng, khéo léo, cẩn thận' },
    { name: 'Thìn (Rồng)', years: '2024, 2012, 2000, 1988, 1976, 1964', traits: 'Mạnh mẽ, quyền lực, may mắn' },
    { name: 'Tỵ (Rắn)', years: '2025, 2013, 2001, 1989, 1977, 1965', traits: 'Thông thái, bí ẩn, quyến rũ' },
    { name: 'Ngọ (Ngựa)', years: '2026, 2014, 2002, 1990, 1978, 1966', traits: 'Năng động, nhiệt tình, tự do' },
    { name: 'Mùi (Dê)', years: '2027, 2015, 2003, 1991, 1979, 1967', traits: 'Hiền lành, nghệ thuật, nhạy cảm' },
    { name: 'Thân (Khỉ)', years: '2028, 2016, 2004, 1992, 1980, 1968', traits: 'Lanh lợi, hoạt bát, sáng tạo' },
    { name: 'Dậu (Gà)', years: '2029, 2017, 2005, 1993, 1981, 1969', traits: 'Cẩn thận, tỉ mỉ, tự hào' },
    { name: 'Tuất (Chó)', years: '2030, 2018, 2006, 1994, 1982, 1970', traits: 'Trung thành, chân thành, đáng tin' },
    { name: 'Hợi (Lợn)', years: '2031, 2019, 2007, 1995, 1983, 1971', traits: 'Hào phóng, chân thật, may mắn' }
  ];

  calendarDays = computed(() => this.generateCalendar());
  currentMonthName = computed(() => this.getMonthName());
  currentYear = computed(() => this.currentDate().getFullYear());
  currentMonthIndex = computed(() => this.currentDate().getMonth());
  todayInfo = computed(() => this.getTodayInfo());
  daysBetween = computed(() => this.calculateDaysBetween());
  dateAfterDays = computed(() => this.calculateDateAfterDays());
  yearCanChi = computed(() => this.getYearCanChi());
  selectedDayDetails = computed(() => this.getSelectedDayDetails());

  getMonthName(): string {
    const months = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    return months[this.currentDate().getMonth()];
  }

  getDayName(dayIndex: number): string {
    const days = this.firstDayOfWeek() === 0 
      ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
      : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    return days[dayIndex];
  }

  generateCalendar(): CalendarDay[] {
    const year = this.currentDate().getFullYear();
    const month = this.currentDate().getMonth();
    const today = new Date();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDay = firstDay.getDay();
    if (this.firstDayOfWeek() === 1) {
      startDay = startDay === 0 ? 6 : startDay - 1;
    }
    
    const days: CalendarDay[] = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      const lunar = this.convertSolarToLunar(date);
      const dayOfWeek = date.getDay();
      days.push({
        date,
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: this.isWeekend(date),
        isSaturday: dayOfWeek === 6,
        isSunday: dayOfWeek === 0,
        isHoliday: false,
        lunarDay: lunar.day,
        lunarMonth: lunar.month,
        lunarYear: lunar.year
      });
    }
    
    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const lunar = this.convertSolarToLunar(date);
      const isToday = this.isSameDay(date, today);
      const holiday = this.getHoliday(date, lunar);
      const dayOfWeek = date.getDay();
      
      days.push({
        date,
        day,
        isCurrentMonth: true,
        isToday,
        isWeekend: this.isWeekend(date),
        isSaturday: dayOfWeek === 6,
        isSunday: dayOfWeek === 0,
        isHoliday: !!holiday,
        holidayName: holiday?.name,
        lunarDay: lunar.day,
        lunarMonth: lunar.month,
        lunarYear: lunar.year,
        zodiac: this.getZodiac(lunar.year),
        canChi: this.getCanChi(date)
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length; // 6 rows × 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const lunar = this.convertSolarToLunar(date);
      const dayOfWeek = date.getDay();
      days.push({
        date,
        day,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: this.isWeekend(date),
        isSaturday: dayOfWeek === 6,
        isSunday: dayOfWeek === 0,
        isHoliday: false,
        lunarDay: lunar.day,
        lunarMonth: lunar.month,
        lunarYear: lunar.year
      });
    }
    
    return days;
  }

  // Vietnamese Lunar Calendar Algorithm
  convertSolarToLunar(date: Date): { day: number; month: number; year: number } {
    const dd = date.getDate();
    const mm = date.getMonth() + 1;
    const yy = date.getFullYear();
    
    const dayNumber = this.jdFromDate(dd, mm, yy);
    const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = this.getNewMoonDay(k + 1);
    
    if (monthStart > dayNumber) {
      monthStart = this.getNewMoonDay(k);
    }
    
    let a11 = this.getLunarMonth11(yy);
    let b11 = a11;
    let lunarYear: number;
    
    if (a11 >= monthStart) {
      lunarYear = yy;
      a11 = this.getLunarMonth11(yy - 1);
    } else {
      lunarYear = yy + 1;
      b11 = this.getLunarMonth11(yy + 1);
    }
    
    const lunarDay = dayNumber - monthStart + 1;
    const diff = Math.floor((monthStart - a11) / 29);
    let lunarLeap = 0;
    let lunarMonth = diff + 11;
    
    if (b11 - a11 > 365) {
      const leapMonthDiff = this.getLeapMonthOffset(a11);
      if (diff >= leapMonthDiff) {
        lunarMonth = diff + 10;
        if (diff === leapMonthDiff) {
          lunarLeap = 1;
        }
      }
    }
    
    if (lunarMonth > 12) {
      lunarMonth = lunarMonth - 12;
    }
    if (lunarMonth >= 11 && diff < 4) {
      lunarYear -= 1;
    }
    
    return { day: lunarDay, month: lunarMonth, year: lunarYear };
  }

  private jdFromDate(dd: number, mm: number, yy: number): number {
    let a = Math.floor((14 - mm) / 12);
    let y = yy + 4800 - a;
    let m = mm + 12 * a - 3;
    let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    return jd;
  }

  private getNewMoonDay(k: number): number {
    const T = k / 1236.85;
    const T2 = T * T;
    const T3 = T2 * T;
    const dr = Math.PI / 180;
    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    const deltat = (T < -11) ? (0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3) : (-0.000278 + 0.000265 * T + 0.000262 * T2);
    const JdNew = Jd1 + C1 - deltat;
    return Math.floor(JdNew + 0.5 + 7/24);
  }

  private getSunLongitude(jdn: number): number {
    const T = (jdn - 2451545.0) / 36525;
    const T2 = T * T;
    const dr = Math.PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    let L = L0 + DL;
    L = L * dr;
    L = L - Math.PI * 2 * (Math.floor(L / (Math.PI * 2)));
    return Math.floor(L / Math.PI * 6);
  }

  private getLunarMonth11(yy: number): number {
    const off = this.jdFromDate(31, 12, yy) - 2415021;
    const k = Math.floor(off / 29.530588853);
    let nm = this.getNewMoonDay(k);
    const sunLong = this.getSunLongitude(nm);
    if (sunLong >= 9) {
      nm = this.getNewMoonDay(k - 1);
    }
    return nm;
  }

  private getLeapMonthOffset(a11: number): number {
    const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last = 0;
    let i = 1;
    let arc = this.getSunLongitude(this.getNewMoonDay(k + i));
    do {
      last = arc;
      i++;
      arc = this.getSunLongitude(this.getNewMoonDay(k + i));
    } while (arc !== last && i < 14);
    return i - 1;
  }

  getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  getHoliday(solarDate: Date, lunar: { day: number; month: number; year: number }): Holiday | null {
    if (!this.highlightHolidays()) return null;
    
    // Check solar holidays
    const solarHoliday = this.holidays.find(h => 
      !h.isLunar && 
      h.month === solarDate.getMonth() + 1 && 
      h.day === solarDate.getDate()
    );
    
    if (solarHoliday) return solarHoliday;
    
    // Check lunar holidays
    const lunarHoliday = this.holidays.find(h => 
      h.isLunar && 
      h.month === lunar.month && 
      h.day === lunar.day
    );
    
    return lunarHoliday || null;
  }

  getZodiac(lunarYear: number): string {
    const zodiacIndex = (lunarYear - 4) % 12;
    const zodiacs = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
    return zodiacs[zodiacIndex];
  }

  getCanChi(date: Date): string {
    const can = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
    const chi = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
    
    const year = date.getFullYear();
    const canIndex = (year - 4) % 10;
    const chiIndex = (year - 4) % 12;
    
    return `${can[canIndex]} ${chi[chiIndex]}`;
  }

  getDayCanChi(date: Date): string {
    const can = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
    const chi = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
    
    const jd = this.jdFromDate(date.getDate(), date.getMonth() + 1, date.getFullYear());
    const canIndex = (jd + 9) % 10;
    const chiIndex = (jd + 1) % 12;
    
    return `${can[canIndex]} ${chi[chiIndex]}`;
  }

  getMonthCanChi(date: Date): string {
    const can = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
    const chi = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    const yearCanIndex = (year - 4) % 10;
    
    // Tháng Can Chi tính dựa vào năm Can và tháng
    // Công thức: Can tháng = (Can năm * 2 + tháng) % 10
    const monthCanIndex = (yearCanIndex * 2 + month) % 10;
    const monthChiIndex = (month + 1) % 12;
    
    return `${can[monthCanIndex]} ${chi[monthChiIndex]}`;
  }

  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  }

  getTodayInfo() {
    const today = this.currentDate();
    const lunar = this.convertSolarToLunar(today);
    const holiday = this.getHoliday(today, lunar);
    
    return {
      solar: `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`,
      lunar: `${lunar.day}/${lunar.month}/${lunar.year}`,
      zodiac: this.getZodiac(lunar.year),
      canChi: this.getCanChi(today),
      dayCanChi: this.getDayCanChi(today),
      monthCanChi: this.getMonthCanChi(today),
      yearCanChi: this.getCanChi(today),
      dayOfWeek: ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][today.getDay()],
      holiday: holiday?.name || 'Không có'
    };
  }

  previousMonth() {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  nextMonth() {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  goToToday() {
    this.currentDate.set(new Date());
  }

  previousYear() {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear() - 1, current.getMonth(), 1));
  }

  nextYear() {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear() + 1, current.getMonth(), 1));
  }

  // Day view navigation
  previousDay() {
    const current = this.currentDate();
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() - 1);
    this.currentDate.set(newDate);
  }

  nextDay() {
    const current = this.currentDate();
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() + 1);
    this.currentDate.set(newDate);
  }

  previousWeek() {
    const current = this.currentDate();
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() - 7);
    this.currentDate.set(newDate);
  }

  nextWeek() {
    const current = this.currentDate();
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() + 7);
    this.currentDate.set(newDate);
  }

  previousMonthDay() {
    const current = this.currentDate();
    const newDate = new Date(current);
    newDate.setMonth(newDate.getMonth() - 1);
    this.currentDate.set(newDate);
  }

  nextMonthDay() {
    const current = this.currentDate();
    const newDate = new Date(current);
    newDate.setMonth(newDate.getMonth() + 1);
    this.currentDate.set(newDate);
  }

  selectTab(tab: 'calendar' | 'zodiac' | 'calculate' | 'settings') {
    this.selectedTab.set(tab);
  }

  // Select a day and switch to day view
  selectDay(day: CalendarDay) {
    if (!day.isCurrentMonth) return; // Only allow selecting current month days
    this.currentDate.set(day.date);
    this.viewMode.set('day');
  }

  // Change month by index
  changeMonth(monthIndex: number) {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), monthIndex, 1));
  }

  // Change year
  changeYear(year: number) {
    const current = this.currentDate();
    this.currentDate.set(new Date(year, current.getMonth(), 1));
  }

  // Get current theme
  getCurrentTheme() {
    return this.themeColors.find(t => t.id === this.themeColor()) || this.themeColors[0];
  }

  // Change theme
  changeTheme(themeId: string) {
    this.themeColor.set(themeId);
  }

  // Get season name
  getSeasonName(): string {
    const date = this.currentDate();
    const month = date.getMonth() + 1;
    
    if (month >= 3 && month <= 5) return 'Xuân (Spring)';
    if (month >= 6 && month <= 8) return 'Hạ (Summer)';
    if (month >= 9 && month <= 11) return 'Thu (Autumn)';
    return 'Đông (Winter)';
  }

  // Show zodiac detail
  showZodiacInfo() {
    const lunar = this.convertSolarToLunar(this.currentDate());
    const zodiacName = this.getZodiac(lunar.year);
    const zodiacDetail = this.zodiacAnimals.find(z => z.name.includes(zodiacName));
    
    if (zodiacDetail) {
      this.selectedZodiacDetail.set(zodiacDetail);
      this.showZodiacDetail.set(true);
    }
  }

  closeZodiacDetail() {
    this.showZodiacDetail.set(false);
  }

  calculateDaysBetween(): number {
    if (!this.startDate() || !this.endDate()) return 0;
    
    const start = new Date(this.startDate());
    const end = new Date(this.endDate());
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  calculateDateAfterDays(): string {
    if (!this.startDate() || !this.addDays()) return '';
    
    const start = new Date(this.startDate());
    const result = new Date(start);
    result.setDate(result.getDate() + this.addDays());
    
    return result.toLocaleDateString('vi-VN');
  }

  isGoodDay(day: CalendarDay): boolean {
    // Simple logic for "good days" - full moon and new moon
    return day.lunarDay === 1 || day.lunarDay === 15;
  }

  isBadDay(day: CalendarDay): boolean {
    // Bad days - typically unlucky days
    return day.lunarDay === 5 || day.lunarDay === 14 || day.lunarDay === 23;
  }

  toggleViewMode() {
    this.viewMode.update(mode => mode === 'month' ? 'day' : 'month');
  }

  getYearCanChi(): string {
    const year = this.yearToCheck();
    const can = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
    const chi = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
    
    const canIndex = (year - 4) % 10;
    const chiIndex = (year - 4) % 12;
    
    return `${can[canIndex]} ${chi[chiIndex]}`;
  }

  getSelectedDayDetails() {
    const today = this.currentDate();
    const lunar = this.convertSolarToLunar(today);
    const isGood = this.isGoodDay({ lunarDay: lunar.day } as CalendarDay);
    const isBad = this.isBadDay({ lunarDay: lunar.day } as CalendarDay);
    
    let goodThings: string[] = [];
    let badThings: string[] = [];
    
    if (isGood) {
      // Good days have more good activities
      goodThings = this.goodDayReasons.slice(0, 3);
      badThings = this.badDayReasons.slice(0, 1);
    } else if (isBad) {
      // Bad days have more bad activities
      goodThings = this.goodDayReasons.slice(0, 1);
      badThings = this.badDayReasons.slice(0, 3);
    } else {
      // Normal days
      goodThings = this.goodDayReasons.slice(0, 2);
      badThings = this.badDayReasons.slice(0, 2);
    }
    
    return {
      isGood,
      isBad,
      goodThings,
      badThings,
      rating: isGood ? 'Tốt' : isBad ? 'Xấu' : 'Trung bình'
    };
  }
}
