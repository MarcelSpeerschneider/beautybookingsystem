// src/app/components/shared/appointment-notification-popup/appointment-notification-popup.component.ts

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppointmentWithId } from '../../../services/appointment.service';

@Component({
  selector: 'app-appointment-notification-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './appointment-notification-popup.component.html',
  styleUrls: ['./appointment-notification-popup.component.css']
})
export class AppointmentNotificationPopupComponent {
  @Input() appointment: AppointmentWithId | null = null;
  @Input() isOpen: boolean = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<string>();
  @Output() reject = new EventEmitter<string>();
  
  closePopup(): void {
    this.close.emit();
  }
  
  confirmAppointment(): void {
    if (this.appointment) {
      this.confirm.emit(this.appointment.id);
      this.closePopup();
    }
  }
  
  rejectAppointment(): void {
    if (this.appointment) {
      this.reject.emit(this.appointment.id);
      this.closePopup();
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
  
  getAppointmentDuration(appointment: AppointmentWithId): number {
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
}