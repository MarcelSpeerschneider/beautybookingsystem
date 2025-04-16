import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Appointment } from '../../../../../models/appointment.model';

// Define a type that includes the document ID with the Appointment model
type AppointmentWithId = Appointment & { id: string };

@Component({
  selector: 'app-appointment-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './appointment-detail.component.html',
  styleUrls: ['./appointment-detail.component.css']
})
export class AppointmentDetailComponent {
  @Input() appointment!: AppointmentWithId;
  
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<string>();
  @Output() reject = new EventEmitter<string>();
  @Output() complete = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<string>();

  closeModal(): void {
    this.close.emit();
  }

  confirmAppointment(): void {
    this.confirm.emit(this.appointment.id);
  }

  rejectAppointment(): void {
    this.reject.emit(this.appointment.id);
  }

  completeAppointment(): void {
    this.complete.emit(this.appointment.id);
  }

  cancelAppointment(): void {
    this.cancel.emit(this.appointment.id);
  }
  
  formatTime(date: any): string {
    try {
      const validDate = date instanceof Date ? date : new Date(date);
      if (isNaN(validDate.getTime())) {
        return '--:--';
      }
      return validDate.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '--:--';
    }
  }

  formatDate(date: any): string {
    try {
      const validDate = date instanceof Date ? date : new Date(date);
      if (isNaN(validDate.getTime())) {
        return 'Ungültiges Datum';
      }
      return validDate.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return 'Ungültiges Datum';
    }
  }

  getAppointmentDuration(appointment: Appointment): number {
    try {
      if (!appointment.startTime || !appointment.endTime) {
        return 0;
      }
      
      const startTime = appointment.startTime instanceof Date ? 
                      appointment.startTime : 
                      new Date(appointment.startTime);
      
      const endTime = appointment.endTime instanceof Date ? 
                    appointment.endTime : 
                    new Date(appointment.endTime);
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return 0;
      }
      
      const durationMs = endTime.getTime() - startTime.getTime();
      return Math.round(durationMs / (1000 * 60));
    } catch (error) {
      return 0;
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Anfrage';
      case 'confirmed':
        return 'Bestätigt';
      case 'completed':
        return 'Erledigt';
      case 'canceled':
        return 'Storniert';
      default:
        return 'Unbekannt';
    }
  }
}