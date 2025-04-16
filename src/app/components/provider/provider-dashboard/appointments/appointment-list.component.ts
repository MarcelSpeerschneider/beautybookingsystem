import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AppointmentService } from '../../../../services/appointment.service';
import { LoadingService } from '../../../../services/loading.service';
import { Provider } from '../../../../models/provider.model';
import { Appointment } from '../../../../models/appointment.model';
import { AppointmentDetailComponent } from './appointment-detail/appointment-detail.component';

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
  @Input() provider: Provider | null = null;

  // Alle Termine
  allAppointments: Appointment[] = [];
  // Gefilterte Termine für die Tabelle
  filteredAppointments: Appointment[] = [];
  // Ausgewählter Termin für Detailansicht
  selectedAppointment: Appointment | null = null;

  // Filter- und Sortierungsvariablen
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
    console.log('Provider-ID für loadAllAppointments:', this.provider.id);
  
    // Verwende die korrekte Methode für Provider-Termine
    const appointmentsSub = this.appointmentService
      .getAppointmentsByProvider(this.provider.id)
      .subscribe({
        next: (appointments) => {
          console.log('Alle geladenen Termine:', appointments);
          this.allAppointments = appointments;
          this.filterAppointments();
          this.loadingService.setLoading(false);
          
          // Debug-Ausgabe, falls keine Termine gefunden wurden
          if (this.allAppointments.length === 0) {
            console.warn('Keine Termine für providerId', this.provider?.id, 'gefunden. Bitte prüfe, ob Termine in der Datenbank vorhanden sind.');
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

  // Filtert die Termine basierend auf den aktuellen Filtereinstellungen
  filterAppointments(): void {
    if (!this.allAppointments) return;
  
    let filtered = [...this.allAppointments];
  
    // Statusfilter anwenden
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === this.statusFilter);
    }
  
    // Datumsfilter anwenden
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
  
    // Suchfilter anwenden
    if (this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(a =>
        (a.customerName && a.customerName.toLowerCase().includes(query)) ||
        (a.serviceName && a.serviceName.toLowerCase().includes(query))
      );
    }
  
    // Sortierung anwenden
    this.sortAppointmentsArray(filtered);
  
    this.filteredAppointments = filtered;
  }
  
  // Private Methode zur Sortierung der Termine
  private sortAppointmentsArray(appointments: Appointment[]): void {
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
  
  // Sortierung umschalten
  sortAppointments(field: string): void {
    if (this.sortField === field) {
      // Wenn das gleiche Feld angeklickt wird, Sortierrichtung umschalten
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Neues Feld, standardmäßig aufsteigend sortieren
      this.sortField = field;
      this.sortDirection = 'asc';
    }
  
    this.filterAppointments();
  }
  
  // Filter zurücksetzen
  resetFilters(): void {
    this.statusFilter = 'all';
    this.dateFilter = 'all';
    this.searchQuery = '';
    this.filterAppointments();
  }
  
  // Suche löschen
  clearSearch(): void {
    this.searchQuery = '';
    this.filterAppointments();
  }
  
  // Termin-Details anzeigen
  viewAppointmentDetails(appointment: Appointment): void {
    this.selectedAppointment = appointment;
  }
  
  // Detailansicht schließen
  closeAppointmentDetails(): void {
    this.selectedAppointment = null;
  }

  // Format-Hilfsfunktionen
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

  // Terminaktionen
  confirmAppointment(appointmentId: string): void {
    this.loadingService.setLoading(true, 'Bestätige Termin...');
    this.appointmentService.confirmAppointment(appointmentId)
      .subscribe({
        next: () => {
          this.loadingService.setLoading(false);
          alert('Termin wurde bestätigt.');
          this.loadAllAppointments();
          
          // Schließe Detailansicht, falls geöffnet
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
            
            // Schließe Detailansicht, falls geöffnet
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
            
            // Schließe Detailansicht, falls geöffnet
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
          
          // Schließe Detailansicht, falls geöffnet
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
