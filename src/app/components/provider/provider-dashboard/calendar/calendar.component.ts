// calendar.component.ts
import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Provider } from '../../../../models/provider.model';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
}

interface Appointment {
  id: string;
  title: string;
  customerName: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed';
  color: string;
  notes?: string;
}

// Define the type that includes provider ID
type ProviderWithId = Provider & { providerId: string };

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css'],
  // Add schemas to suppress unknown property warnings if needed
  schemas: []
})
export class CalendarComponent implements OnInit {
  @Input() provider: ProviderWithId | null = null;
  
  currentDate: Date = new Date();
  viewMode: 'day' | 'week' | 'month' = 'week';
  weekDays: Date[] = [];
  timeSlots: Date[] = [];
  monthDays: CalendarDay[] = [];
  appointments: Appointment[] = [];

  ngOnInit(): void {
    this.generateWeekDays();
    this.generateTimeSlots();
    this.generateMonthDays();
    this.generateMockAppointments();
    
    // Log provider to verify it's being passed correctly
    console.log('Calendar component received provider:', this.provider);
  }

  setViewMode(mode: 'day' | 'week' | 'month'): void {
    this.viewMode = mode;
  }

  goToToday(): void {
    this.currentDate = new Date();
    this.refreshCalendar();
  }

  navigatePeriod(direction: number): void {
    const newDate = new Date(this.currentDate);
    if (this.viewMode === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (this.viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (7 * direction));
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    this.currentDate = newDate;
    this.refreshCalendar();
  }

  refreshCalendar(): void {
    this.generateWeekDays();
    this.generateMonthDays();
    this.generateMockAppointments();
  }

  generateWeekDays(): void {
    const days: Date[] = [];
    const startDate = new Date(this.currentDate);
    
    // Adjust to start of week (Monday)
    const dayOfWeek = startDate.getDay();
    const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startDate.setDate(diff);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    
    this.weekDays = days;
  }

  generateTimeSlots(): void {
    const slots: Date[] = [];
    for (let hour = 8; hour < 20; hour++) {
      slots.push(new Date(new Date().setHours(hour, 0, 0)));
    }
    this.timeSlots = slots;
  }

  generateMonthDays(): void {
    const days: CalendarDay[] = [];
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Day of week for the first day (0 = Sunday, 1 = Monday, etc.)
    let firstDayOfWeek = firstDay.getDay();
    // Adjust for starting the week on Monday (0 = Monday, 6 = Sunday)
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    // Add days from previous month
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    
    for (let i = prevMonthDays - firstDayOfWeek + 1; i <= prevMonthDays; i++) {
      days.push({
        date: new Date(year, month - 1, i),
        isCurrentMonth: false
      });
    }
    
    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    // Add days from next month to complete the grid (6 rows x 7 days = 42 total cells)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    
    this.monthDays = days;
  }

  generateMockAppointments(): void {
    const mockAppointments: Appointment[] = [];
    
    // Generate appointments for each day in the current week
    for (const day of this.weekDays) {
      // 70% chance of having a morning appointment
      if (Math.random() > 0.3) {
        const morningStart = new Date(day);
        morningStart.setHours(9 + Math.floor(Math.random() * 3), 0, 0);
        const morningEnd = new Date(morningStart);
        morningEnd.setHours(morningStart.getHours() + 1);
        
        mockAppointments.push({
          id: `app-${day.getTime()}-1`,
          title: ['Haarschnitt', 'Maniküre', 'Pediküre', 'Gesichtsbehandlung', 'Färben'][Math.floor(Math.random() * 5)],
          customerName: ['Julia Weber', 'Thomas Müller', 'Anna Schmidt', 'Michael Becker', 'Christina Wolf'][Math.floor(Math.random() * 5)],
          startTime: morningStart,
          endTime: morningEnd,
          status: Math.random() > 0.8 ? 'pending' : 'confirmed',
          color: '#E5887D'
        });
      }
      
      // 60% chance of having an afternoon appointment
      if (Math.random() > 0.4) {
        const afternoonStart = new Date(day);
        afternoonStart.setHours(13 + Math.floor(Math.random() * 4), 0, 0);
        const afternoonEnd = new Date(afternoonStart);
        afternoonEnd.setMinutes(afternoonStart.getMinutes() + 60 + Math.floor(Math.random() * 60));
        
        mockAppointments.push({
          id: `app-${day.getTime()}-2`,
          title: ['Haarschnitt', 'Maniküre', 'Pediküre', 'Gesichtsbehandlung', 'Färben'][Math.floor(Math.random() * 5)],
          customerName: ['Julia Weber', 'Thomas Müller', 'Anna Schmidt', 'Michael Becker', 'Christina Wolf'][Math.floor(Math.random() * 5)],
          startTime: afternoonStart,
          endTime: afternoonEnd,
          status: Math.random() > 0.8 ? 'pending' : 'confirmed',
          color: '#E5887D',
          notes: Math.random() > 0.7 ? 'Kunde wünscht besondere Beratung' : undefined
        });
      }
    }
    
    this.appointments = mockAppointments;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('de-DE', { 
      weekday: 'short', 
      day: '2-digit', 
      month: 'short'
    });
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  }

  formatPeriod(): string {
    return this.currentDate.toLocaleDateString('de-DE', { 
      month: 'long', 
      year: 'numeric' 
    });
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  }

  getAppointmentsForDay(date: Date): Appointment[] {
    return this.appointments.filter(appt => 
      this.isSameDay(appt.startTime, date)
    );
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() && 
           date1.getMonth() === date2.getMonth() && 
           date1.getFullYear() === date2.getFullYear();
  }

  getTodayAppointmentsCount(): number {
    const today = new Date();
    return this.getAppointmentsForDay(today).length;
  }

  getAppointmentPosition(appointment: Appointment): { top: number; height: number } {
    const startHour = appointment.startTime.getHours();
    const startMinutes = appointment.startTime.getMinutes();
    const endHour = appointment.endTime.getHours();
    const endMinutes = appointment.endTime.getMinutes();
    
    // Calculate position based on time (8:00 is our first slot)
    const startPosition = ((startHour - 8) * 60) + startMinutes;
    const duration = ((endHour - startHour) * 60) + (endMinutes - startMinutes);
    
    return {
      top: startPosition,
      height: duration
    };
  }

  createAppointment(): void {
    alert('Funktion zum Erstellen eines neuen Termins wird implementiert.');
  }

  onAppointmentClick(appointment: Appointment): void {
    console.log('Appointment clicked:', appointment);
  }
}