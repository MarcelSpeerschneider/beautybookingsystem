import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Provider } from '../../../../models/provider.model';
import { AppointmentService, AppointmentWithId } from '../../../../services/appointment.service';
import { LoadingService } from '../../../../services/loading.service';
import { Subscription } from 'rxjs';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
}

interface CalendarAppointment {
  id: string;
  title: string;
  customerName: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'canceled' | 'completed';
  color: string;
  notes?: string;
  originalAppointment: AppointmentWithId; // Reference to the original appointment for actions
}

// Define the type that includes provider ID
type ProviderWithId = Provider & { providerId: string };

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css'],
})
export class CalendarComponent implements OnInit, OnDestroy {
  @Input() provider: ProviderWithId | null = null;
  
  currentDate: Date = new Date();
  viewMode: 'day' | 'week' | 'month' = 'week';
  weekDays: Date[] = [];
  timeSlots: Date[] = [];
  monthDays: CalendarDay[] = [];
  
  // Real appointments from database
  appointments: CalendarAppointment[] = [];
  private subscriptions: Subscription[] = [];
  private allAppointments: AppointmentWithId[] = [];
  
  // Constants for time slot calculations
  private readonly TIME_SLOT_HEIGHT = 4; // 4rem per hour
  private readonly START_HOUR = 8; // Calendar starts at 8:00
  private readonly END_HOUR = 20; // Calendar ends at 20:00
  
  // Status colors
  private statusColors = {
    pending: '#F9A826',    // Orange
    confirmed: '#4A8CFF',  // Blue
    completed: '#4CAF50',  // Green
    canceled: '#F44336'    // Red
  };

  constructor(
    private appointmentService: AppointmentService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.generateWeekDays();
    this.generateTimeSlots();
    this.generateMonthDays();
    
    if (this.provider) {
      this.loadRealAppointments();
    }
    
    // Log provider to verify it's being passed correctly
    console.log('Calendar component received provider:', this.provider);
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
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
    // For real appointments, we should either reload or filter existing ones
    this.updateCalendarAppointments();
  }
  
  // Load real appointments from the database
  loadRealAppointments(): void {
    if (!this.provider || !this.provider.providerId) {
      console.error('Provider info missing, cannot load appointments');
      return;
    }
    
    this.loadingService.setLoading(true, 'Lade Termine...');
    
    const appointmentSub = this.appointmentService
      .getAppointmentsByProvider(this.provider.providerId)
      .subscribe({
        next: (appointments) => {
          console.log('Loaded appointments:', appointments);
          this.allAppointments = appointments;
          this.updateCalendarAppointments();
          this.loadingService.setLoading(false);
        },
        error: (error) => {
          console.error('Error loading appointments:', error);
          this.loadingService.setLoading(false);
        }
      });
      
    this.subscriptions.push(appointmentSub);
  }
  
  // Convert database appointments to calendar format
  updateCalendarAppointments(): void {
    // Convert all appointments to the calendar format
    this.appointments = this.allAppointments.map(appointment => {
      // Get appropriate color based on status
      const color = this.statusColors[appointment.status] || this.statusColors.confirmed;
      
      // Ensure dates are valid Date objects
      const startTime = appointment.startTime instanceof Date ? 
                        appointment.startTime : 
                        new Date(appointment.startTime);
                        
      const endTime = appointment.endTime instanceof Date ? 
                      appointment.endTime : 
                      new Date(appointment.endTime);
      
      // Create calendar appointment format
      return {
        id: appointment.id,
        title: appointment.serviceName || 'Termin', // Use service name as title
        customerName: appointment.customerName || 'Kunde',
        startTime: startTime,
        endTime: endTime,
        status: appointment.status,
        color: color,
        notes: appointment.notes,
        originalAppointment: appointment // Store original for reference
      };
    });
    
    console.log('Calendar appointments updated:', this.appointments.length);
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
    for (let hour = this.START_HOUR; hour < this.END_HOUR; hour++) {
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

  getAppointmentsForDay(date: Date): CalendarAppointment[] {
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

  getAppointmentPosition(appointment: CalendarAppointment): { top: string; height: string } {
    // Get accurate time values
    const startHour = appointment.startTime.getHours();
    const startMinutes = appointment.startTime.getMinutes();
    const endHour = appointment.endTime.getHours();
    const endMinutes = appointment.endTime.getMinutes();
    
    // Calculate position based on time slots
    // Each hour is TIME_SLOT_HEIGHT rem tall, and we start at START_HOUR
    
    // Calculate how many hours and minutes from the start of the calendar
    const hoursFromStart = startHour - this.START_HOUR;
    
    // Calculate the top position in rem (4rem per hour, proportional for minutes)
    const topRem = (hoursFromStart * this.TIME_SLOT_HEIGHT) + ((startMinutes / 60) * this.TIME_SLOT_HEIGHT);
    
    // Calculate the duration in hours and minutes
    const durationHours = endHour - startHour;
    const durationMinutes = endMinutes - startMinutes;
    const totalDurationInHours = durationHours + (durationMinutes / 60);
    
    // Calculate the height in rem
    const heightRem = totalDurationInHours * this.TIME_SLOT_HEIGHT;
    
    // Return the values with rem units for precise layout
    return {
      top: `${topRem}rem`,
      height: `${heightRem}rem`
    };
  }

  createAppointment(): void {
    alert('Funktion zum Erstellen eines neuen Termins wird implementiert.');
  }

  onAppointmentClick(appointment: CalendarAppointment): void {
    console.log('Appointment clicked:', appointment);
    // You can implement detailed view or edit functionality here
    alert(`Termin: ${appointment.title} für ${appointment.customerName} (${this.formatTime(appointment.startTime)} - ${this.formatTime(appointment.endTime)})`);
  }

  // Methods to handle appointment actions
  confirmAppointment(appointmentId: string): void {
    this.loadingService.setLoading(true, 'Bestätige Termin...');
    this.appointmentService.confirmAppointment(appointmentId)
      .then(() => {
        this.loadingService.setLoading(false);
        // Reload appointments after confirmation
        this.loadRealAppointments();
      })
      .catch(error => {
        console.error('Error confirming appointment:', error);
        this.loadingService.setLoading(false);
      });
  }
  
  completeAppointment(appointmentId: string): void {
    this.loadingService.setLoading(true, 'Markiere Termin als erledigt...');
    this.appointmentService.completeAppointment(appointmentId)
      .then(() => {
        this.loadingService.setLoading(false);
        // Reload appointments after marking as complete
        this.loadRealAppointments();
      })
      .catch(error => {
        console.error('Error completing appointment:', error);
        this.loadingService.setLoading(false);
      });
  }
  
  cancelAppointment(appointmentId: string): void {
    if (confirm('Möchten Sie diesen Termin wirklich stornieren?')) {
      this.loadingService.setLoading(true, 'Storniere Termin...');
      this.appointmentService.cancelAppointment(appointmentId)
        .then(() => {
          this.loadingService.setLoading(false);
          // Reload appointments after cancellation
          this.loadRealAppointments();
        })
        .catch(error => {
          console.error('Error canceling appointment:', error);
          this.loadingService.setLoading(false);
        });
    }
  }
}