import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AppointmentService } from '../../../../services/appointment.service';
import { LoadingService } from '../../../../services/loading.service';
import { Provider } from '../../../../models/provider.model';
import { Appointment } from '../../../../models/appointment.model';
import { AppointmentDetailComponent } from './appointment-detail/appointment-detail.component';

// Define a type that includes the document ID with the Appointment model
type AppointmentWithId = Appointment & { id: string };

@Component({
  selector: 'app-appointment-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    AppointmentDetailComponent
  ],
  templateUrl: './appointment-list.component.html',
  styleUrls: ['./appointment-list.component.css']
})
export class AppointmentListComponent implements OnInit, OnDestroy {
  @Input() provider: Provider & { providerId: string } | null = null;

  // All appointments with their IDs
  allAppointments: AppointmentWithId[] = [];
  // Filtered appointments for the table
  filteredAppointments: AppointmentWithId[] = [];
  // Selected appointment for detail view
  selectedAppointment: AppointmentWithId | null = null;

  // Filter and sorting variables
  statusFilter: string = 'all';
  dateFilter: string = 'all';
  searchQuery: string = '';
  sortField: string = 'date';
  sortDirection: string = 'asc';

  private subscriptions: Subscription[] = [];

  private appointmentService = inject(AppointmentService);
  private loadingService = inject(LoadingService);

  ngOnInit(): void {
    if (this.provider) {
      this.loadAllAppointments();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadAllAppointments(): void {
    if (!this.provider) {
      console.error('Provider ist null in loadAllAppointments!');
      return;
    }
  
    this.loadingService.setLoading(true, 'Lade Termine...');
    console.log('Provider-ID für loadAllAppointments:', this.provider.providerId);
  
    // Use the correct method for provider appointments
    const appointmentsSub = this.appointmentService
      .getAppointmentsByProvider(this.provider.providerId)
      .subscribe({
        next: (appointments) => {
          console.log('Alle geladenen Termine:', appointments);
          // The appointments from the service already have IDs attached
          this.allAppointments = appointments as AppointmentWithId[];
          this.filterAppointments();
          this.loadingService.setLoading(false);
          
          // Debug output if no appointments were found
          if (this.allAppointments.length === 0) {
            console.warn('Keine Termine für providerId', this.provider?.providerId, 'gefunden. Bitte prüfe, ob Termine in der Datenbank vorhanden sind.');
          }
        },
        error: (error) => {
          this.loadingService.setLoading(false);
          console.error('Fehler beim Laden der Termine:', error);
          alert('Fehler beim Laden der Termine. Bitte versuchen Sie es später erneut.');
        }
      });
  
    this.subscriptions.push(appointmentsSub);
  }

  // Filters appointments based on current filter settings
  filterAppointments(): void {
    if (!this.allAppointments) return;
  
    let filtered = [...this.allAppointments];
  
    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === this.statusFilter);
    }
  
    // Apply date filter
    if (this.dateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
  
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
  
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
  
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
  
      filtered = filtered.filter(a => {
        const appointmentDate = new Date(a.startTime);
        appointmentDate.setHours(0, 0, 0, 0);
  
        switch (this.dateFilter) {
          case 'today':
            return appointmentDate.getTime() === today.getTime();
          case 'tomorrow':
            return appointmentDate.getTime() === tomorrow.getTime();
          case 'week':
            return appointmentDate >= today && appointmentDate < nextWeek;
          case 'month':
            return appointmentDate >= today && appointmentDate < nextMonth;
          default:
            return true;
        }
      });
    }
  
    // Apply search filter
    if (this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(a =>
        (a.customerName && a.customerName.toLowerCase().includes(query)) ||
        (a.serviceName && a.serviceName.toLowerCase().includes(query))
      );
    }
  
    // Apply sorting
    this.sortAppointmentsArray(filtered);
  
    this.filteredAppointments = filtered;
  }
  
  // Private method for sorting appointments
  private sortAppointmentsArray(appointments: AppointmentWithId[]): void {
    appointments.sort((a, b) => {
      let comparison = 0;
  
      switch (this.sortField) {
        case 'date':
          comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
          break;
        case 'time':
          const aTime = new Date(a.startTime).getHours() * 60 + new Date(a.startTime).getMinutes();
          const bTime = new Date(b.startTime).getHours() * 60 + new Date(b.startTime).getMinutes();
          comparison = aTime - bTime;
          break;
        case 'customer':
          comparison = (a.customerName || '').localeCompare(b.customerName || '');
          break;
        case 'service':
          comparison = (a.serviceName || '').localeCompare(b.serviceName || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        default:
          comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      }
  
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  // Toggle sorting
  sortAppointments(field: string): void {
    if (this.sortField === field) {
      // If the same field is clicked, toggle the sort direction
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New field, sort ascending by default
      this.sortField = field;
      this.sortDirection = 'asc';
    }
  
    this.filterAppointments();
  }
  
  // Reset filters
  resetFilters(): void {
    this.statusFilter = 'all';
    this.dateFilter = 'all';
    this.searchQuery = '';
    this.filterAppointments();
  }
  
  // Clear search
  clearSearch(): void {
    this.searchQuery = '';
    this.filterAppointments();
  }
  
  // View appointment details
  viewAppointmentDetails(appointment: AppointmentWithId): void {
    this.selectedAppointment = appointment;
  }
  
  // Close detail view
  closeAppointmentDetails(): void {
    this.selectedAppointment = null;
  }

  // Formatting helper functions
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

  // Appointment actions
  confirmAppointment(appointmentId: string): void {
    this.loadingService.setLoading(true, 'Bestätige Termin...');
    this.appointmentService.confirmAppointment(appointmentId)
      .subscribe({
        next: () => {
          this.loadingService.setLoading(false);
          alert('Termin wurde bestätigt.');
          this.loadAllAppointments();
          
          // Close detail view if open
          if (this.selectedAppointment && this.selectedAppointment.id === appointmentId) {
            this.selectedAppointment = null;
          }
        },
        error: (error) => {
          this.loadingService.setLoading(false);
          console.error('Error confirming appointment:', error);
          alert('Fehler bei der Bestätigung des Termins.');
        }
      });
  }

  rejectAppointment(appointmentId: string): void {
    if (confirm('Möchten Sie diesen Termin wirklich ablehnen?')) {
      this.loadingService.setLoading(true, 'Termin wird abgelehnt...');
      this.appointmentService.cancelAppointment(appointmentId)
        .subscribe({
          next: () => {
            this.loadingService.setLoading(false);
            alert('Termin wurde abgelehnt.');
            this.loadAllAppointments();
            
            // Close detail view if open
            if (this.selectedAppointment && this.selectedAppointment.id === appointmentId) {
              this.selectedAppointment = null;
            }
          },
          error: (error) => {
            this.loadingService.setLoading(false);
            console.error('Fehler beim Ablehnen des Termins:', error);
            alert('Fehler beim Ablehnen des Termins.');
          }
        });
    }
  }
  
  cancelAppointment(appointmentId: string): void {
    if (confirm('Möchten Sie diesen Termin wirklich stornieren?')) {
      this.loadingService.setLoading(true, 'Termin wird storniert...');
      this.appointmentService.cancelAppointment(appointmentId)
        .subscribe({
          next: () => {
            this.loadingService.setLoading(false);
            alert('Termin wurde storniert.');
            this.loadAllAppointments();
            
            // Close detail view if open
            if (this.selectedAppointment && this.selectedAppointment.id === appointmentId) {
              this.selectedAppointment = null;
            }
          },
          error: (error) => {
            this.loadingService.setLoading(false);
            console.error('Fehler beim Stornieren des Termins:', error);
            alert('Fehler beim Stornieren des Termins.');
          }
        });
    }
  }
  
  completeAppointment(appointmentId: string): void {
    this.loadingService.setLoading(true, 'Termin wird als erledigt markiert...');
    this.appointmentService.completeAppointment(appointmentId)
      .subscribe({
        next: () => {
          this.loadingService.setLoading(false);
          alert('Termin wurde als erledigt markiert.');
          this.loadAllAppointments();
          
          // Close detail view if open
          if (this.selectedAppointment && this.selectedAppointment.id === appointmentId) {
            this.selectedAppointment = null;
          }
        },
        error: (error) => {
          this.loadingService.setLoading(false);
          console.error('Fehler beim Markieren des Termins als erledigt:', error);
          alert('Fehler beim Markieren des Termins als erledigt.');
        }
      });
  }
}