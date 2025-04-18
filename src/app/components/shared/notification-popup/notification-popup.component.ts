// src/app/components/shared/notification-popup/notification-popup.component.ts

import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotificationService, AppointmentWithId } from '../../../services/notification.service';
import { AppointmentService } from '../../../services/appointment.service';
import { LoadingService } from '../../../services/loading.service';
import { AppointmentNotificationPopupComponent } from '../appointment-notification-popup/appointment-notification-popup.component';

@Component({
  selector: 'app-notification-popup',
  standalone: true,
  imports: [CommonModule, RouterModule, AppointmentNotificationPopupComponent],
  templateUrl: './notification-popup.component.html',
  styleUrls: ['./notification-popup.component.css']
})
export class NotificationPopupComponent implements OnInit {
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  
  notifications: AppointmentWithId[] = [];
  
  // New property to handle the appointment details popup
  selectedAppointment: AppointmentWithId | null = null;
  isAppointmentDetailsOpen: boolean = false;
  
  private notificationService = inject(NotificationService);
  private appointmentService = inject(AppointmentService);
  private loadingService = inject(LoadingService);
  
  ngOnInit(): void {
    this.notificationService.unreadNotifications$.subscribe(notifications => {
      this.notifications = notifications;
    });
  }
  
  closePopup(): void {
    this.close.emit();
  }
  
  // Opens the appointment details popup
  openAppointmentDetails(appointment: AppointmentWithId): void {
    this.selectedAppointment = appointment;
    this.isAppointmentDetailsOpen = true;
  }
  
  // Closes the appointment details popup
  closeAppointmentDetails(): void {
    this.isAppointmentDetailsOpen = false;
    this.selectedAppointment = null;
  }
  
  formatDate(date: any): string {
    try {
      const validDate = date instanceof Date ? date : new Date(date);
      if (isNaN(validDate.getTime())) {
        return 'Ungültiges Datum';
      }
      return validDate.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
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
  
  confirmAppointment(appointmentId: string): void {
    this.loadingService.setLoading(true, 'Bestätige Termin...');
    this.appointmentService.confirmAppointment(appointmentId).then(() => {
      this.loadingService.setLoading(false);
      // Close the detail view if open
      this.closeAppointmentDetails();
    }).catch((error: any) => {
      this.loadingService.setLoading(false);
      console.error('Error confirming appointment:', error);
      alert('Fehler bei der Bestätigung des Termins.');
    });
  }
  
  rejectAppointment(appointmentId: string): void {
    if (confirm('Möchten Sie diesen Termin wirklich ablehnen?')) {
      this.loadingService.setLoading(true, 'Termin wird abgelehnt...');
      this.appointmentService.cancelAppointment(appointmentId).then(() => {
        this.loadingService.setLoading(false);
        // Close the detail view if open
        this.closeAppointmentDetails();
      }).catch((error: any) => {
        this.loadingService.setLoading(false);
        console.error('Fehler beim Ablehnen des Termins:', error);
        alert('Fehler beim Ablehnen des Termins.');
      });
    }
  }
}