import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AppointmentService } from '../../../../services/appointment.service';
import { LoadingService } from '../../../../services/loading.service';
import { Provider } from '../../../../models/provider.model';
import { Appointment } from '../../../../models/appointment.model';
import { convertToDate, convertAppointmentDates, safeFormatDate } from '../../../../utils/date-utils';

// Custom Pipes
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'appointmentFilter',
  standalone: true
})
export class AppointmentFilterPipe implements PipeTransform {
  transform(appointments: AppointmentWithId[], date: Date): AppointmentWithId[] {
    if (!appointments || !date) {
      return [];
    }
    
    // Filtere Termine für diesen Tag
    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.startTime);
      return appointmentDate.getDate() === date.getDate() && 
             appointmentDate.getMonth() === date.getMonth() && 
             appointmentDate.getFullYear() === date.getFullYear();
    });
  }
}

@Pipe({
  name: 'length',
  standalone: true
})
export class LengthPipe implements PipeTransform {
  transform(value: any[]): number {
    return value ? value.length : 0;
  }
}

// Define a type that includes the document ID with the Appointment model
type AppointmentWithId = Appointment & { id: string };

// Interface for day data in month view
interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  appointments?: AppointmentWithId[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, AppointmentFilterPipe, LengthPipe],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit, OnDestroy {
  @Input() provider: Provider & { providerId: string } | null = null;
  
  // Kalenderansicht: 'day', 'week', 'month'
  viewMode: 'day' | 'week' | 'month' = 'week';
  currentDate: Date = new Date();
  todayDate: Date = new Date(); 
  appointments: AppointmentWithId[] = [];
  
  // Kalender-Strukturdaten
  timeSlots: Date[] = [];
  weekDays: Date[] = [];
  monthDays: CalendarDay[] = [];
  
  // Für Wochennavigation
  weekStart: Date = new Date();
  weekEnd: Date = new Date();
  
  private subscriptions: Subscription[] = [];
  private appointmentService = inject(AppointmentService);
  private loadingService = inject(LoadingService);
  
  ngOnInit(): void {
    this.generateTimeSlots();
    this.generateWeekDays();
    this.generateMonthDays();
    
    if (this.provider) {
      this.loadAppointments();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  // Termine aus dem Service laden
  loadAppointments(): void {
    if (!this.provider) return;
    
    this.loadingService.setLoading(true, 'Lade Termine...');
    
    const appointmentsSub = this.appointmentService
      .getAppointmentsByProvider(this.provider.providerId)
      .subscribe({
        next: (appointments) => {
          this.appointments = appointments as AppointmentWithId[];
          this.loadingService.setLoading(false);
        },
        error: (error) => {
          console.error('Fehler beim Laden der Termine:', error);
          this.loadingService.setLoading(false);
        }
      });
      
    this.subscriptions.push(appointmentsSub);
  }
  
  // Ändere die Kalenderansicht
  changeViewMode(mode: 'day' | 'week' | 'month'): void {
    this.viewMode = mode;
    this.updateCalendar();
  }
  
  // Zum vorherigen/nächsten Zeitraum navigieren
  navigatePeriod(direction: number): void {
    const newDate = new Date(this.currentDate);
    
    if (this.viewMode === 'day') {
      // Vorheriger/nächster Tag
      newDate.setDate(newDate.getDate() + direction);
    } else if (this.viewMode === 'week') {
      // Vorherige/nächste Woche
      newDate.setDate(newDate.getDate() + (7 * direction));
    } else {
      // Vorheriger/nächster Monat
      newDate.setMonth(newDate.getMonth() + direction);
    }
    
    this.currentDate = newDate;
    this.updateCalendar();
    this.loadAppointments();
  }
  
  // Zum heutigen Tag gehen
  goToToday(): void {
    this.currentDate = new Date();
    this.updateCalendar();
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
    const startOfWeek = new Date(this.currentDate);
    
    // Zum Wochenanfang (Montag) anpassen
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    this.weekStart = new Date(startOfWeek);
    
    // 7 Tage generieren (Montag bis Sonntag)
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      this.weekDays.push(date);
    }
    
    // Setze Wochenende-Datum
    this.weekEnd = new Date(this.weekDays[6]);
  }
  
  // Tage für die Monatsansicht generieren
  generateMonthDays(): void {
    this.monthDays = [];
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // Erster Tag des Monats
    const firstDay = new Date(year, month, 1);
    // Letzter Tag des Monats
    const lastDay = new Date(year, month + 1, 0);
    
    // Wochentag des ersten Tags (0 = Sonntag, 1 = Montag, usw.)
    let firstDayOfWeek = firstDay.getDay();
    // Anpassung für Wochenbeginn am Montag (0 = Montag, 6 = Sonntag)
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    // Tage aus dem Vormonat hinzufügen
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    
    for (let i = prevMonthDays - firstDayOfWeek + 1; i <= prevMonthDays; i++) {
      const date = new Date(year, month - 1, i);
      this.monthDays.push({
        date: date,
        isCurrentMonth: false
      });
    }
    
    // Tage des aktuellen Monats hinzufügen
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      this.monthDays.push({
        date: date,
        isCurrentMonth: true
      });
    }
    
    // Tage aus dem nächsten Monat hinzufügen um das Raster zu vervollständigen (6 Zeilen x 7 Tage = 42 Zellen insgesamt)
    const daysToAdd = 42 - this.monthDays.length;
    for (let i = 1; i <= daysToAdd; i++) {
      const date = new Date(year, month + 1, i);
      this.monthDays.push({
        date: date,
        isCurrentMonth: false
      });
    }
  }
  
  // Aktualisiere Kalenderdaten bei Navigation oder Ansichtsänderung
  updateCalendar(): void {
    this.generateWeekDays();
    this.generateMonthDays();
  }
  
  // Prüft, ob ein Datum heute ist
  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  }
  
  // Format date as weekday and day (e.g., "Mo 12.")
  formatDate(date: Date): string {
    if (!date) return '';
    
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  }
  
  // Format date for header display (e.g., "April 2025")
  formatMonthYear(date: Date): string {
    if (!date) return '';
    
    return date.toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric'
    });
  }
  
  // Format time (e.g., "10:00")
  formatTime(date: Date): string {
    if (!date) return '';
    
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
  
  // Formatiert Tag kurz (Mo, Di, etc.)
  formatDayShort(date: Date): string {
    if (!date) return '';
    const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    return weekdays[date.getDay()];
  }
  
  // Check if appointment is on specific day
  isAppointmentOnDay(appointment: any, date: Date): boolean {
    if (!appointment || !appointment.startTime || !date) return false;
    
    const appointmentDate = new Date(appointment.startTime);
    return appointmentDate.getDate() === date.getDate() && 
           appointmentDate.getMonth() === date.getMonth() && 
           appointmentDate.getFullYear() === date.getFullYear();
  }
  
  // Filtert Termine für einen bestimmten Tag
  getAppointmentsForDay(date: Date): AppointmentWithId[] {
    if (!this.appointments || !date) return [];
    
    return this.appointments.filter(appointment => 
      this.isAppointmentOnDay(appointment, date)
    );
  }
  
  // Berechnet Position eines Termins für die Tag/Wochenansicht
  getAppointmentPosition(appointment: any): { top: number, height: number } {
    if (!appointment || !appointment.startTime || !appointment.endTime) {
      return { top: 0, height: 0 };
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
      top: startPosition,
      height: duration
    };
  }
  
  // Termin hinzufügen
  addAppointment(): void {
    alert('Funktion zum Hinzufügen eines Termins wird implementiert.');
  }
}