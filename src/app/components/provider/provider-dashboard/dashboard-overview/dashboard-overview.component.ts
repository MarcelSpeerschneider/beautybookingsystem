import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AppointmentService } from '../../../../services/appointment.service';
import { ServiceService } from '../../../../services/service.service';
import { LoadingService } from '../../../../services/loading.service';
import { Provider } from '../../../../models/provider.model';
import { Appointment } from '../../../../models/appointment.model';
import { Service } from '../../../../models/service.model';

// Define a type that includes the document ID with the Appointment model
type AppointmentWithId = Appointment & { id: string };

// Define the extended Provider type with providerId
type ProviderWithId = Provider & { providerId: string };

@Component({
  selector: 'app-dashboard-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-overview.component.html',
  styleUrls: ['./dashboard-overview.component.css']
})
export class DashboardOverviewComponent implements OnInit, OnDestroy {
  @Input() provider: ProviderWithId | null = null;

  today: Date = new Date();
  todayAppointments: AppointmentWithId[] = [];
  services: Service[] = [];
  pendingAppointments: number = 0;
  todayRevenue: number = 0;

  private subscriptions: Subscription[] = [];

  private appointmentService = inject(AppointmentService);
  private serviceService = inject(ServiceService);
  private loadingService = inject(LoadingService);

  ngOnInit(): void {
    if (this.provider) {
      this.loadTodayAppointments();
      this.loadServices();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadTodayAppointments(): void {
    if (!this.provider) {
      console.error('Provider ist null in loadTodayAppointments!');
      return;
    }

    this.loadingService.setLoading(true, 'Lade heutige Termine...');
    console.log('Provider-ID für loadTodayAppointments:', this.provider.providerId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // WICHTIG: Parameter 'true' hinzugefügt, um als Provider zu filtern
    const appointmentsSub = this.appointmentService
      .getAppointmentsByUserAndDate(this.provider.providerId, today, true)
      .subscribe({
        next: (appointments) => {
          console.log('Geladene Termine für heute:', appointments);
          // The appointments from the service already have IDs attached
          this.todayAppointments = appointments as AppointmentWithId[];

          // Count pending appointments
          this.pendingAppointments = appointments.filter(a => a.status === 'pending').length;

          // Calculate today's revenue
          this.calculateTodayRevenue();
          this.loadingService.setLoading(false);
        },
        error: (error) => {
          console.error('Error fetching appointments:', error);
          this.loadingService.setLoading(false);
        }
      });

    this.subscriptions.push(appointmentsSub);
  }

  loadServices(): void {
    if (!this.provider) return;

    const servicesSub = this.serviceService
      .getServicesByProvider(this.provider.providerId)
      .subscribe({
        next: (services: Service[]) => {
          this.services = services;
        },
        error: (error: any) => {
          console.error('Error loading services:', error);
        }
      });

    this.subscriptions.push(servicesSub);
  }

  calculateTodayRevenue(): void {
    this.todayRevenue = 0;

    // Calculate revenue from completed appointments
    this.todayAppointments
      .filter(appointment => appointment.status === 'completed')
      .forEach(appointment => {
        // Find the service for this appointment
        if (appointment.serviceIds && appointment.serviceIds.length > 0) {
          const service = this.services.find(s => s.id === appointment.serviceIds[0]);
          if (service) {
            this.todayRevenue += service.price;
          }
        }
      });
  }

  formatTime(date: any): string {
    try {
      // Prüfe, ob ein gültiges Datum oder ein String/Timestamp vorliegt
      const validDate = date instanceof Date ? date : new Date(date);

      // Prüfe, ob das Datum gültig ist
      if (isNaN(validDate.getTime())) {
        console.warn('Ungültiges Datum für formatTime:', date);
        return '--:--';
      }

      return validDate.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Fehler beim Formatieren der Uhrzeit:', error, date);
      return '--:--';
    }
  }

  formatDate(date: any): string {
    try {
      // Prüfe, ob ein gültiges Datum oder ein String/Timestamp vorliegt
      const validDate = date instanceof Date ? date : new Date(date);

      // Prüfe, ob das Datum gültig ist
      if (isNaN(validDate.getTime())) {
        console.warn('Ungültiges Datum für formatDate:', date);
        return 'Ungültiges Datum';
      }

      return validDate.toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Fehler beim Formatieren des Datums:', error, date);
      return 'Ungültiges Datum';
    }
  }

  getAppointmentDuration(appointment: Appointment): number {
    try {
      if (!appointment.startTime || !appointment.endTime) {
        console.warn('Start- oder Endzeit fehlt für die Dauerberechnung:', appointment);
        return 0;
      }

      // Sicherstellen, dass start- und endTime Date-Objekte sind
      const startTime = appointment.startTime instanceof Date ?
        appointment.startTime :
        new Date(appointment.startTime);

      const endTime = appointment.endTime instanceof Date ?
        appointment.endTime :
        new Date(appointment.endTime);

      // Überprüfen, ob die Daten gültig sind
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        console.warn('Ungültige Datumswerte für Dauerberechnung:',
          { start: appointment.startTime, end: appointment.endTime });
        return 0;
      }

      // Berechne die Dauer in Minuten
      const durationMs = endTime.getTime() - startTime.getTime();
      return Math.round(durationMs / (1000 * 60));
    } catch (error) {
      console.error('Fehler bei der Dauerberechnung:', error, appointment);
      return 0;
    }
  }

  confirmAppointment(appointmentId: string): void {
    this.loadingService.setLoading(true, 'Bestätige Termin...');
    this.appointmentService.confirmAppointment(appointmentId)
    .then(() => {
          this.loadingService.setLoading(false);
          alert('Termin wurde bestätigt.');
          this.loadTodayAppointments();
        })
        .catch((error: any) => {
          this.loadingService.setLoading(false);
          console.error('Error confirming appointment:', error);
          alert('Fehler bei der Bestätigung des Termins.');
        });
  }


  createAppointment(): void {
    alert('Funktion zum Erstellen eines neuen Termins wird implementiert.');
  }

  createBreak(): void {
    alert('Funktion zum Eintragen einer Pause wird implementiert.');
  }
}