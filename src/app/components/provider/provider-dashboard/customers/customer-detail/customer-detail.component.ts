import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Customer } from '../../../../../models/customer.model';
import { Appointment } from '../../../../../models/appointment.model';
import { AppointmentService } from '../../../../../services/appointment.service';
import { LoadingService } from '../../../../../services/loading.service';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.css']
})
export class CustomerDetailComponent implements OnInit {
  @Input() customer!: Customer;
  @Output() close = new EventEmitter<void>();
  
  customerAppointments: Appointment[] = [];
  isEditingNotes: boolean = false;
  temporaryNotes: string = '';
  
  private appointmentService = inject(AppointmentService);
  private loadingService = inject(LoadingService);
  
  ngOnInit(): void {
    this.loadCustomerAppointments();
    this.temporaryNotes = this.customer.notes || '';
  }
  
  loadCustomerAppointments(): void {
    this.loadingService.setLoading(true, 'Lade Kundentermine...');
    
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
  
  startEditingNotes(): void {
    this.isEditingNotes = true;
    this.temporaryNotes = this.customer.notes || '';
  }
  
  saveNotes(): void {
    // In einem echten System würde hier ein Service-Call erfolgen
    // um die Notizen in der Datenbank zu aktualisieren
    
    // Für dieses Beispiel simulieren wir den Speichervorgang
    this.loadingService.setLoading(true, 'Speichere Kundennotizen...');
    
    setTimeout(() => {
      this.customer.notes = this.temporaryNotes;
      this.isEditingNotes = false;
      this.loadingService.setLoading(false);
    }, 500);
  }
  
  cancelEditingNotes(): void {
    this.isEditingNotes = false;
    this.temporaryNotes = this.customer.notes || '';
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
