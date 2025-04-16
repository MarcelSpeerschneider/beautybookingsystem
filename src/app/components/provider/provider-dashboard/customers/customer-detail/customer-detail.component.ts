import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppointmentService } from '../../../../../services/appointment.service';
import { LoadingService } from '../../../../../services/loading.service';
import { Appointment } from '../../../../../models/appointment.model';

interface CustomerViewModel {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes?: string;
  lastVisit?: Date | null;
  visitCount?: number;
}

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.css']
})
export class CustomerDetailComponent implements OnInit {
  @Input() customer!: CustomerViewModel;
  @Output() close = new EventEmitter<void>();
  @Output() editNotes = new EventEmitter<void>();
  
  customerAppointments: Appointment[] = [];
  
  private appointmentService = inject(AppointmentService);
  private loadingService = inject(LoadingService);
  
  ngOnInit(): void {
    this.loadCustomerAppointments();
  }
  
  loadCustomerAppointments(): void {
    this.loadingService.setLoading(true, 'Lade Kundentermine...');
    
    // Verwende die neue id-Eigenschaft, um Termine für diesen Kunden zu laden
    this.appointmentService.getAppointmentsByCustomer(this.customer.id)
      .subscribe({
        next: (appointments) => {
          // Sortieren nach Datum absteigend (neueste zuerst)
          this.customerAppointments = appointments.sort(
            (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
          this.loadingService.setLoading(false);
        },
        error: (error) => {
          console.error('Fehler beim Laden der Kundentermine:', error);
          this.loadingService.setLoading(false);
        }
      });
  }
  
  closeModal(): void {
    this.close.emit();
  }
  
  openNotesEditor(): void {
    this.editNotes.emit();
  }
  
  getAppointmentStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Anfrage';
      case 'confirmed':
        return 'Bestätigt';
      case 'completed':
        return 'Abgeschlossen';
      case 'canceled':
        return 'Storniert';
      default:
        return status;
    }
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
}