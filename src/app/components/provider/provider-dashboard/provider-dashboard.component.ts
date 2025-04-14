import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticationService } from '../../../services/authentication.service';
import { ProviderService } from '../../../services/provider.service';
import { AppointmentService } from '../../../services/appointment.service';
import { ServiceService } from '../../../services/service.service';
import { Provider } from '../../../models/provider.model';
import { Appointment } from '../../../models/appointment.model';
import { Service } from '../../../models/service.model';
import { LoadingService } from '../../../services/loading.service';
import { convertToDate, safeFormatDate } from '../../../utils/date-utils';

@Component({
  selector: 'app-provider-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './provider-dashboard.component.html',
  styleUrls: ['./provider-dashboard.component.css']
})
export class ProviderDashboardComponent implements OnInit, OnDestroy {
  provider: Provider | null = null;
  today: Date = new Date();
  todayAppointments: Appointment[] = [];
  services: Service[] = [];
  pendingAppointments: number = 0;
  todayRevenue: number = 0;

  // Alle Termine (nicht nur heute)
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

  currentTab: string = 'dashboard';
  showAddServiceForm: boolean = false;
  newService: Service = {
    id: '',
    userId: '',
    name: '', 
    price: 0, 
    duration: 0, 
    image: '',
    description: '' // Hinzugefügt, da dies im Interface benötigt wird
  };

  private subscriptions: Subscription[] = [];

  private authService = inject(AuthenticationService);
  private providerService = inject(ProviderService);
  private appointmentService = inject(AppointmentService);
  private serviceService = inject(ServiceService);
  private router = inject(Router);
  private loadingService = inject(LoadingService);


  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Dashboard...');

    // Check if user is authenticated and is a provider
    const userSub = this.authService.user.subscribe(userWithCustomer => {
      if (!userWithCustomer.user) {
        this.router.navigate(['/provider-login']);
        return;
      }

      // Get provider info
      const providerSub = this.providerService.getProviderByUserId(userWithCustomer.user.uid)
        .subscribe(provider => {
          if (provider) {
            this.provider = provider;
            this.newService.userId = userWithCustomer.user!.uid;

            // Load today's appointments
            this.loadTodayAppointments();

            // Load services
            this.loadServices();
          } else {
            // User is not a provider, redirect to provider registration
            this.router.navigate(['/provider-registration']);
          }

          this.loadingService.setLoading(false);
        });

      this.subscriptions.push(providerSub);
    });

    this.subscriptions.push(userSub);
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadTodayAppointments(): void {
    if (!this.provider) {
      console.error('Provider ist null in loadTodayAppointments!');
      return;
    }

    console.log('Provider-ID für loadTodayAppointments:', this.provider.userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // WICHTIG: Parameter 'true' hinzugefügt, um als Provider zu filtern
    const appointmentsSub = this.appointmentService
      .getAppointmentsByUserAndDate(this.provider.userId, today, true)
      .subscribe({
        next: (appointments) => {
          console.log('Geladene Termine für heute:', appointments);
          this.todayAppointments = appointments;

          // Count pending appointments
          this.pendingAppointments = appointments.filter(a => a.status === 'pending').length;

          // Calculate today's revenue
          this.calculateTodayRevenue();
        },
        error: (error) => {
          console.error('Error fetching appointments:', error);
        }
      });

    this.subscriptions.push(appointmentsSub);
  }

  loadAllAppointments(): void {
    if (!this.provider) {
      console.error('Provider ist null in loadAllAppointments!');
      return;
    }
  
    this.loadingService.setLoading(true, 'Lade Termine...');
    console.log('Provider-ID für loadAllAppointments:', this.provider.userId);
  
    // Verwende die korrekte Methode für Provider-Termine
    const appointmentsSub = this.appointmentService
      .getAppointmentsByProvider(this.provider.userId)
      .subscribe({
        next: (appointments) => {
          console.log('Alle geladenen Termine:', appointments);
          this.allAppointments = appointments;
          this.filterAppointments();
          this.loadingService.setLoading(false);
          
          // Debug-Ausgabe, falls keine Termine gefunden wurden
          if (this.allAppointments.length === 0) {
            console.warn('Keine Termine für providerId', this.provider?.userId, 'gefunden. Bitte prüfe, ob Termine in der Datenbank vorhanden sind.');
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

  loadServices(): void {
    if (!this.provider) return;

    const servicesSub = this.serviceService
      .getServicesByUser(this.provider.userId)
      .subscribe((services) => {
        this.services = services;
        for (const service of this.services) {
          (service as any).isEditing = false;
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
        // Find the service for this appointment. Since serviceIds is an array, we use the first one here.
        const service = this.services.find(s => s.id === appointment.serviceIds[0]);
        if (service) {
          this.todayRevenue += service.price;
        }
      });
  }

  changeTab(tab: string): void {
    this.currentTab = tab;
    
    if (this.currentTab === 'services'){
      this.loadServices();
    } else if (this.currentTab === 'appointments') {
      this.loadAllAppointments();
    }
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

  createAppointment(): void {
    alert('Funktion zum Erstellen eines neuen Termins wird implementiert.');
  }

  createBreak(): void {
    alert('Funktion zum Eintragen einer Pause wird implementiert.');
  }

  confirmAppointment(appointmentId: string): void {
    this.loadingService.setLoading(true, 'Bestätige Termin...');
    this.appointmentService.confirmAppointment(appointmentId)
      .subscribe({
        next: () => {
          this.loadingService.setLoading(false);
          alert('Termin wurde bestätigt.');
          this.loadTodayAppointments();
          if (this.currentTab === 'appointments') {
            this.loadAllAppointments();
          }
          // Schließe Detailansicht, falls geöffnet
          if (this.selectedAppointment && this.selectedAppointment.appointmentId === appointmentId) {
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

  addNewService() {
    this.showAddServiceForm = true;
  }

  cancelAddService() {
    this.showAddServiceForm = false;
    this.newService = {
      id: '',
      userId: this.newService.userId,
      name: '',
      price: 0,
      duration: 0,
      image: '',
      description: ''
    };
  }

  submitService() {
    if (!this.newService) { return; }
    if (!this.newService.name || !this.newService.description || !this.newService.price || this.newService.price === 0 || !this.newService.duration) {
      alert('Bitte füllen Sie alle Felder aus.');
      return;
    }

    this.loadingService.setLoading(true, 'Speichere Dienstleistung...');

    this.newService.id = uuidv4();

    this.serviceService.createService(this.newService)
      .then(() => {
        this.loadingService.setLoading(false);
        alert('Dienstleistung wurde hinzugefügt.');
        this.loadServices();
        this.cancelAddService();
      })
      .catch((error) => {
        this.loadingService.setLoading(false);
        console.error('Error creating service:', error);
        alert('Fehler beim Hinzufügen der Dienstleistung.');
      })
      .finally(() => {
        this.loadingService.setLoading(false);
      });
  }

  logout(): void {
    this.authService.logout()
      .then(() => {
        this.router.navigate(['/provider-login']);
      });
  }

  private deepCopy<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  editService(service: Service): void {
    (service as any).serviceCopy = this.deepCopy(service);
    service.isEditing = true;
  }

  saveService(service: Service): void {
    if (!service.name || !service.description || !service.price || service.price === 0 || !service.duration) {
      alert('Bitte füllen Sie alle Felder aus.');
      return;
    }

    this.loadingService.setLoading(true, 'Speichere Dienstleistung...');

    this.serviceService.updateService(service)
      .then(() => {
        this.loadingService.setLoading(false);
        alert('Dienstleistung wurde gespeichert.');
        delete (service as any).serviceCopy;
        (service as any).isEditing = false;
      })
      .catch((error) => {
        this.loadingService.setLoading(false);
        console.error('Error updating service:', error);
        alert('Fehler beim Speichern der Dienstleistung.');
      });
  }

  cancelEdit(service: Service): void {
    if ((service as any).serviceCopy) {
      Object.assign(service, (service as any).serviceCopy);
    }

    (service as any).isEditing = false;
    delete (service as any).serviceCopy;
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
  
  // Statustext für Anzeige formatieren
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
  
  // Termin ablehnen
  rejectAppointment(appointmentId: string): void {
    if (confirm('Möchten Sie diesen Termin wirklich ablehnen?')) {
      this.loadingService.setLoading(true, 'Termin wird abgelehnt...');
      this.appointmentService.cancelAppointment(appointmentId)
        .subscribe({
          next: () => {
            this.loadingService.setLoading(false);
            alert('Termin wurde abgelehnt.');
            // Aktualisiere die Terminlisten
            if (this.currentTab === 'appointments') {
              this.loadAllAppointments();
            }
            this.loadTodayAppointments();
            
            // Schließe Detailansicht, falls geöffnet
            if (this.selectedAppointment && this.selectedAppointment.appointmentId === appointmentId) {
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
  
  // Termin stornieren (für bereits bestätigte Termine)
  cancelAppointment(appointmentId: string): void {
    if (confirm('Möchten Sie diesen Termin wirklich stornieren?')) {
      this.loadingService.setLoading(true, 'Termin wird storniert...');
      this.appointmentService.cancelAppointment(appointmentId)
        .subscribe({
          next: () => {
            this.loadingService.setLoading(false);
            alert('Termin wurde storniert.');
            // Aktualisiere die Terminlisten
            if (this.currentTab === 'appointments') {
              this.loadAllAppointments();
            }
            this.loadTodayAppointments();
            
            // Schließe Detailansicht, falls geöffnet
            if (this.selectedAppointment && this.selectedAppointment.appointmentId === appointmentId) {
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
  
  // Termin als erledigt markieren
  completeAppointment(appointmentId: string): void {
    this.loadingService.setLoading(true, 'Termin wird als erledigt markiert...');
    this.appointmentService.completeAppointment(appointmentId)
      .subscribe({
        next: () => {
          this.loadingService.setLoading(false);
          alert('Termin wurde als erledigt markiert.');
          // Aktualisiere die Terminlisten
          if (this.currentTab === 'appointments') {
            this.loadAllAppointments();
          }
          this.loadTodayAppointments();
          
          // Schließe Detailansicht, falls geöffnet
          if (this.selectedAppointment && this.selectedAppointment.appointmentId === appointmentId) {
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
  
  // Termin-Details anzeigen
  viewAppointmentDetails(appointment: Appointment): void {
    this.selectedAppointment = appointment;
  }
  
  // Detailansicht schließen
  closeAppointmentDetails(): void {
    this.selectedAppointment = null;
  }
}