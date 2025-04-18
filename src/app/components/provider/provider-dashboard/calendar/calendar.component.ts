import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppointmentService } from '../../../../services/appointment.service';
import { LoadingService } from '../../../../services/loading.service';
import { Subscription } from 'rxjs';
import { Provider } from '../../../../models/provider.model';
import { Appointment } from '../../../../models/appointment.model';
import { convertToDate, convertAppointmentDates, safeFormatDate } from '../../../../utils/date-utils';

// Define a type that includes the document ID with the Appointment model
type AppointmentWithId = Appointment & { id: string };

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit, OnDestroy {
  @Input() provider: Provider & { providerId: string } | null = null;
  
  // Kalenderansicht: 'day', 'week', 'month'
  viewMode: string = 'week';
  currentDate: Date = new Date();
  todayDate: Date = new Date(); 
  appointments: AppointmentWithId[] = [];
  
  // Zeitslots generieren für den Tag
  timeSlots: Date[] = [];
  weekDays: Date[] = [];
  
  private subscriptions: Subscription[] = [];
  private appointmentService = inject(AppointmentService);
  private loadingService = inject(LoadingService);

  ngOnInit(): void {
    this.generateTimeSlots();
    this.generateWeekDays();
    
    if (this.provider) {
      this.loadAppointments();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  // Ändere die Kalenderansicht
  changeViewMode(mode: string): void {
    this.viewMode = mode;
  }
  
  // Zum vorherigen/nächsten Zeitraum navigieren
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
    this.generateWeekDays();
    this.loadAppointments();
  }
  
  // Zum heutigen Tag gehen
  goToToday(): void {
    this.currentDate = new Date();
    this.generateWeekDays();
    this.loadAppointments();
  }
  
  // Zeitslots für den Tag generieren
  generateTimeSlots(): void {
    this.timeSlots = [];
    for (let hour = 8; hour < 20; hour++) {
      const date = new Date();
      date.setHours(hour, 0, 0, 0);
      this.timeSlots.push(date);
    }
  }
  
  // Tage für die Wochenansicht generieren
  generateWeekDays(): void {
    this.weekDays = [];
    const startDate = new Date(this.currentDate);
    // Zum Wochenanfang (Montag) anpassen
    const dayOfWeek = startDate.getDay();
    const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startDate.setDate(diff);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      this.weekDays.push(date);
    }
  }
  
  // Termine aus dem Service laden
  loadAppointments(): void {
    if (!this.provider) return;
    
    this.loadingService.setLoading(true, 'Lade Termine...');
    
    // Je nach Ansicht unterschiedliche Termine laden
    const appointmentsSub = this.appointmentService
      .getAppointmentsByProvider(this.provider.providerId)
      .subscribe({
        next: (appointments) => {
          this.appointments = appointments;
          this.loadingService.setLoading(false);
        },
        error: (error) => {
          console.error('Fehler beim Laden der Termine:', error);
          this.loadingService.setLoading(false);
        }
      });
      
    this.subscriptions.push(appointmentsSub);
  }
  
  // Hilfsmethode für Formatierung
  formatDate(date: Date): string {
    if (!date) return '';
    return date.toLocaleDateString('de-DE');
  }
  
  formatTime(date: Date): string {
    if (!date) return '';
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }
  
  formatDayShort(date: Date): string {
    if (!date) return '';
    const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    return weekdays[date.getDay()];
  }
  
  // Prüft, ob ein Termin an einem bestimmten Tag stattfindet
  isAppointmentOnDay(appointment: AppointmentWithId, date: Date): boolean {
    if (!appointment || !appointment.startTime || !date) return false;
    
    const appointmentDate = new Date(appointment.startTime);
    return appointmentDate.getDate() === date.getDate() && 
           appointmentDate.getMonth() === date.getMonth() && 
           appointmentDate.getFullYear() === date.getFullYear();
  }
  
  // Prüft, ob ein Datum heute ist
  isToday(date: Date): boolean {
    if (!date) return false;
    
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  }
  
  // Filtert Termine für einen bestimmten Tag
  getAppointmentsForDay(date: Date): AppointmentWithId[] {
    if (!this.appointments || !date) return [];
    
    return this.appointments.filter(appointment => 
      this.isAppointmentOnDay(appointment, date)
    );
  }
  
  // Berechnet Position eines Termins für die Tag/Wochenansicht
  getAppointmentPosition(appointment: AppointmentWithId): { top: string, height: string } {
    if (!appointment || !appointment.startTime || !appointment.endTime) {
      return { top: '0px', height: '0px' };
    }
    
    const startTime = new Date(appointment.startTime);
    const endTime = new Date(appointment.endTime);
    
    const startHour = startTime.getHours();
    const startMinutes = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinutes = endTime.getMinutes();
    
    // Position basierend auf der Zeit berechnen (8:00 ist unser erster Slot)
    const startPosition = ((startHour - 8) * 60) + startMinutes;
    const duration = ((endHour - startHour) * 60) + (endMinutes - startMinutes);
    
    return {
      top: `${startPosition}px`,
      height: `${duration}px`
    };
  }
}