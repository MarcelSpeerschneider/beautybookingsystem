import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Provider } from '../../../../models/provider.model';
import { Customer } from '../../../../models/customer.model';
import { Appointment } from '../../../../models/appointment.model';
import { CustomerService } from '../../../../services/customer.service';
import { LoadingService } from '../../../../services/loading.service';
import { AppointmentService } from '../../../../services/appointment.service';
import { CustomerDetailComponent } from './customer-detail/customer-detail.component';

// Erweitertes Customer-Interface für lokale Verwendung
interface CustomerViewModel extends Customer {
  _lastVisitDate?: Date | null; // Nur für die Anzeige in dieser Komponente
  _visitCount?: number; // Nur für die Berechnung in dieser Komponente
}

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CustomerDetailComponent
  ],
  templateUrl: './customers-list.component.html',
  styleUrls: ['./customers-list.component.css']
})
export class CustomersListComponent implements OnInit, OnDestroy {
  @Input() provider: Provider | null = null;
  
  // Listen für Kunden und Termine
  allCustomers: CustomerViewModel[] = [];
  filteredCustomers: CustomerViewModel[] = [];
  selectedCustomer: CustomerViewModel | null = null;
  appointmentsCache: { [customerId: string]: Appointment[] } = {}; // Cache für Termine
  
  // Filter- und Sortierungsvariablen
  searchQuery: string = '';
  statusFilter: string = 'all';
  sortField: string = 'name';
  sortDirection: string = 'asc';
  
  // Statistik-Variablen
  totalCustomers: number = 0;
  newCustomersThisMonth: number = 0; // Werden wir anders berechnen müssen
  regularCustomers: number = 0; // Kunden mit mehr als 3 Terminen
  
  private subscriptions: Subscription[] = [];
  
  private customerService = inject(CustomerService);
  private appointmentService = inject(AppointmentService);
  private loadingService = inject(LoadingService);
  
  ngOnInit(): void {
    if (this.provider) {
      this.loadCustomersAndAppointments();
    }
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  loadCustomersAndAppointments(): void {
    if (!this.provider) {
      console.error('Provider ist null!');
      return;
    }
    
    this.loadingService.setLoading(true, 'Lade Kundendaten...');
    
    // 1. Verwende die vorhandene Methode zum Laden von Kunden
    // Ändere die aufgerufene Methode entsprechend deinem CustomerService
    const customersSub = this.customerService
      .getCustomers() // Oder die entsprechende Methode in deinem Service
      .subscribe({
        next: (customers) => {
          // Nur Kunden dieses Providers filtern (falls nicht schon durch die API gefiltert)
          const providerCustomers = customers.filter(
            c => c.providerId === this.provider?.userId
          );
          
          // Füge lokale Eigenschaften für die Anzeige hinzu
          this.allCustomers = providerCustomers.map(c => ({
            ...c,
            _lastVisitDate: null,
            _visitCount: 0
          }));
          
          // Statistiken berechnen und Anzeige aktualisieren
          this.totalCustomers = this.allCustomers.length;
          this.filterCustomers();
          
          // 2. Jetzt laden wir die Terminhistorie für die Besuche
          this.loadAppointmentHistory();
        },
        error: (error: any) => {
          this.loadingService.setLoading(false);
          console.error('Fehler beim Laden der Kunden:', error);
          alert('Fehler beim Laden der Kunden. Bitte versuchen Sie es später erneut.');
        }
      });
    
    this.subscriptions.push(customersSub);
  }
  
  loadAppointmentHistory(): void {
    if (!this.provider || this.allCustomers.length === 0) {
      this.loadingService.setLoading(false);
      return;
    }
    
    // Lade die Gesamtterminhistorie für diesen Provider
    // (Annahme: Es gibt eine Methode im AppointmentService, die Termine nach Provider filtert)
    const appointmentsSub = this.appointmentService
      .getAppointmentsByProvider(this.provider.userId) // Passe an deine vorhandene Methode an
      .subscribe({
        next: (appointments) => {
          // Gruppiere Termine nach Kunden-ID
          appointments.forEach(appointment => {
            if (!appointment.customerId) return;
            
            if (!this.appointmentsCache[appointment.customerId]) {
              this.appointmentsCache[appointment.customerId] = [];
            }
            
            this.appointmentsCache[appointment.customerId].push(appointment);
          });
          
          // Berechne Besuchsinformationen für jeden Kunden
          this.updateCustomerVisitData();
          
          // Statistiken aktualisieren und Anzeige filtern
          this.calculateCustomerStats();
          this.filterCustomers();
          
          this.loadingService.setLoading(false);
        },
        error: (error) => {
          console.error('Fehler beim Laden der Terminhistorie:', error);
          this.loadingService.setLoading(false);
          
          // Trotzdem Kunden anzeigen, auch ohne Terminhistorie
          this.filterCustomers();
        }
      });
    
    this.subscriptions.push(appointmentsSub);
  }
  
  updateCustomerVisitData(): void {
    // Durchlaufe alle Kunden und berechne ihre Besuchsdaten
    this.allCustomers.forEach(customer => {
      const customerAppointments = this.appointmentsCache[customer.id] || [];
      
      // Nur abgeschlossene Termine zählen
      const completedAppointments = customerAppointments.filter(
        a => a.status === 'completed'
      );
      
      // Setze Besuchszähler
      customer._visitCount = completedAppointments.length;
      
      // Finde das neueste Besuchsdatum
      if (completedAppointments.length > 0) {
        // Sortiere nach Datum (neueste zuerst)
        completedAppointments.sort((a, b) => {
          const dateA = new Date(a.startTime).getTime();
          const dateB = new Date(b.startTime).getTime();
          return dateB - dateA;
        });
        
        // Setze das letzte Besuchsdatum
        customer._lastVisitDate = new Date(completedAppointments[0].startTime);
      }
    });
  }
  
  calculateCustomerStats(): void {
    // Gesamtanzahl der Kunden
    this.totalCustomers = this.allCustomers.length;
    
    // Stammkunden (mit mehr als 3 Besuchen)
    this.regularCustomers = this.allCustomers.filter(
      customer => (customer._visitCount || 0) >= 3
    ).length;
    
    // Neue Kunden diesen Monat - statt createdAt verwenden wir das erste Termin-Datum
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.newCustomersThisMonth = this.allCustomers.filter(customer => {
      const customerAppointments = this.appointmentsCache[customer.id] || [];
      
      if (customerAppointments.length === 0) return false;
      
      // Sortiere Termine nach Datum (älteste zuerst)
      customerAppointments.sort((a, b) => {
        const dateA = new Date(a.startTime).getTime();
        const dateB = new Date(b.startTime).getTime();
        return dateA - dateB;
      });
      
      // Prüfe, ob der erste Termin in diesem Monat war
      const firstAppointmentDate = new Date(customerAppointments[0].startTime);
      return firstAppointmentDate >= firstDayOfMonth;
    }).length;
  }
  
  // Filtere Kunden basierend auf den aktuellen Filtereinstellungen
  filterCustomers(): void {
    if (!this.allCustomers) return;
    
    let filtered = [...this.allCustomers];
    
    // Status-Filter anwenden
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === this.statusFilter);
    }
    
    // Suchquery anwenden - mit expliziten null-checks
    if (this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c => {
        // Explizite null-checks für TypeScript
        const fullName = c.fullName || '';
        const email = c.email || '';
        const phone = c.phone || '';
        
        return fullName.toLowerCase().includes(query) ||
               email.toLowerCase().includes(query) ||
               phone.toLowerCase().includes(query);
      });
    }
    
    // Sortierung anwenden
    this.sortCustomersArray(filtered);
    
    this.filteredCustomers = filtered;
  }
  
  // Private Methode zur Sortierung der Kunden
  private sortCustomersArray(customers: CustomerViewModel[]): void {
    customers.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortField) {
        case 'name':
          // Strings mit Null-Check
          const nameA = a.fullName || '';
          const nameB = b.fullName || '';
          comparison = nameA.localeCompare(nameB);
          break;
          
        case 'email':
          // Strings mit Null-Check
          const emailA = a.email || '';
          const emailB = b.email || '';
          comparison = emailA.localeCompare(emailB);
          break;
          
        case 'lastVisit':
          // Jetzt verwenden wir unsere lokale _lastVisitDate Eigenschaft
          const aTime = a._lastVisitDate ? a._lastVisitDate.getTime() : 0;
          const bTime = b._lastVisitDate ? b._lastVisitDate.getTime() : 0;
          comparison = aTime - bTime;
          break;
          
        default:
          // Standardfall: Nach Namen sortieren
          const defaultNameA = a.fullName || '';
          const defaultNameB = b.fullName || '';
          comparison = defaultNameA.localeCompare(defaultNameB);
      }
      
      // Sortierrichtung berücksichtigen
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  // Sortierung umschalten
  sortCustomers(field: string): void {
    if (this.sortField === field) {
      // Wenn das gleiche Feld angeklickt wird, Sortierrichtung umschalten
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Neues Feld, standardmäßig aufsteigend sortieren
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    
    this.filterCustomers();
  }
  
  // Filter zurücksetzen
  resetFilters(): void {
    this.statusFilter = 'all';
    this.searchQuery = '';
    this.filterCustomers();
  }
  
  // Suche löschen
  clearSearch(): void {
    this.searchQuery = '';
    this.filterCustomers();
  }
  
  // Kundendetails anzeigen
  viewCustomerDetails(customer: CustomerViewModel): void {
    this.selectedCustomer = customer;
  }
  
  // Detailansicht schließen
  closeCustomerDetails(): void {
    this.selectedCustomer = null;
  }
  
  // Hilfsfunktionen für Datumsformatierung
  formatDate(date: any): string {
    try {
      if (!date) return 'Kein Datum';
      
      const validDate = date instanceof Date ? date : new Date(date);
      if (isNaN(validDate.getTime())) {
        return 'Kein Datum';
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
  
  // Kundenstatus-Text formatieren
  getStatusText(status: string): string {
    switch (status) {
      case 'active':
        return 'Aktiv';
      case 'inactive':
        return 'Inaktiv';
      default:
        return status;
    }
  }
  
  // Letzten Besuch formatiert zurückgeben
  getLastVisitDateFormatted(customer: CustomerViewModel): string {
    return customer._lastVisitDate ? this.formatDate(customer._lastVisitDate) : 'Noch kein Besuch';
  }
}