import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Provider } from '../../../../models/provider.model';
import { Customer } from '../../../../models/customer.model';
import { Appointment } from '../../../../models/appointment.model';
import { CustomerService } from '../../../../services/customer.service';
import { LoadingService } from '../../../../services/loading.service';
import { AppointmentService } from '../../../../services/appointment.service';
import { CustomerDetailComponent } from './customer-detail/customer-detail.component';
import { ProviderCustomerService } from '../../../../services/provider-customer.service';
import { CustomerNotesComponent } from './customer-notes/customer-notes.component';

// Erweitertes Customer-Interface für lokale Verwendung
interface CustomerViewModel extends Customer {
  relationId?: string;
  notes?: string;
  lastVisit?: Date | null;
  visitCount?: number;
  totalSpent?: number;
  tags?: string[];
}

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CustomerDetailComponent,
    CustomerNotesComponent
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
  
  // Filter- und Sortierungsvariablen
  searchQuery: string = '';
  statusFilter: string = 'all';
  sortField: string = 'name';
  sortDirection: string = 'asc';
  
  // Statistik-Variablen
  totalCustomers: number = 0;
  newCustomersThisMonth: number = 0;
  regularCustomers: number = 0;
  
  // UI-Steuerung
  isEditingNotes: boolean = false;
  selectedCustomerId: string | null = null;
  
  private subscriptions: Subscription[] = [];
  
  private customerService = inject(CustomerService);
  private appointmentService = inject(AppointmentService);
  private providerCustomerService = inject(ProviderCustomerService);
  private loadingService = inject(LoadingService);
  
  ngOnInit(): void {
    if (this.provider) {
      this.loadCustomersWithRelations();
    }
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  loadCustomersWithRelations(): void {
    if (!this.provider) {
      console.error('Provider ist null!');
      return;
    }
    
    this.loadingService.setLoading(true, 'Lade Kundendaten...');
    
    // 1. Lade alle Kundenbeziehungen dieses Providers
    const relationsSub = this.providerCustomerService
      .getCustomerRelationsByProvider(this.provider.userId)
      .pipe(
        // 2. Für jede Beziehung die vollständigen Kundendaten laden
        switchMap(relations => {
          if (relations.length === 0) {
            // Keine Kundenbeziehungen gefunden, versuche über Termine
            return this.loadCustomersFromAppointments();
          }
          
          // Kunden-IDs extrahieren
          const customerIds = relations.map(rel => rel.customerId);
          
          // Für jeden Kunden vollständige Daten laden und mit Beziehungsdaten kombinieren
          return forkJoin(
            customerIds.map(id => 
              this.customerService.getCustomer(id).pipe(
                map(customer => {
                  if (!customer) return null;
                  
                  // Finde zugehörige Beziehungsdaten
                  const relation = relations.find(rel => rel.customerId === id);
                  
                  // Kombiniere Kunden- und Beziehungsdaten
                  return {
                    ...customer,
                    relationId: relation?.relationId,
                    notes: relation?.notes || '',
                    lastVisit: relation?.lastVisit,
                    visitCount: relation?.visitCount || 0,
                    totalSpent: relation?.totalSpent || 0,
                    tags: relation?.tags || []
                  } as CustomerViewModel;
                })
              )
            )
          ).pipe(
            // Nicht-existierende Kunden herausfiltern
            map(customers => customers.filter(c => c !== null) as CustomerViewModel[])
          );
        })
      )
      .subscribe({
        next: (customers) => {
          this.allCustomers = customers;
          this.totalCustomers = customers.length;
          
          // Statistiken berechnen
          this.calculateStatistics();
          
          // Kunden filtern und anzeigen
          this.filterCustomers();
          
          this.loadingService.setLoading(false);
        },
        error: (error) => {
          console.error('Fehler beim Laden der Kunden:', error);
          this.loadingService.setLoading(false);
        }
      });
      
    this.subscriptions.push(relationsSub);
  }
  
  // Fallback-Methode: Kunden über Termine laden (falls keine expliziten Beziehungen vorhanden)
  loadCustomersFromAppointments(): Observable<CustomerViewModel[]> {
    if (!this.provider) return of([]);
    
    return this.appointmentService.getAppointmentsByProvider(this.provider.userId).pipe(
      map(appointments => {
        if (appointments.length === 0) return [];
        
        // Eindeutige Kunden-IDs aus Terminen extrahieren
        const customerIds = [...new Set(appointments.map(a => a.customerId))];
        
        // Termine nach Kunden gruppieren
        const appointmentsByCustomer = customerIds.reduce((acc, id) => {
          acc[id] = appointments.filter(a => a.customerId === id);
          return acc;
        }, {} as {[customerId: string]: Appointment[]});
        
        // Kunden mit ihren Terminen laden
        return forkJoin(
          customerIds.map(id => 
            this.customerService.getCustomer(id).pipe(
              map(customer => {
                if (!customer) return null;
                
                const customerAppointments = appointmentsByCustomer[id] || [];
                
                // Letzten Besuch ermitteln
                const sortedAppointments = [...customerAppointments].sort(
                  (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
                );
                
                const lastVisit = sortedAppointments.length > 0 ? 
                  new Date(sortedAppointments[0].startTime) : null;
                
                // Für jeden Kunden eine Beziehung erstellen oder aktualisieren
                if (sortedAppointments.length > 0) {
                  this.providerCustomerService.updateRelationAfterAppointment(
                    this.provider!.userId,
                    id,
                    lastVisit || new Date(),
                    0 // Betrag später ergänzen
                  ).catch(err => console.error('Fehler beim Erstellen der Kundenbeziehung:', err));
                }
                
                // Kombinierte Daten zurückgeben
                return {
                  ...customer,
                  relationId: '',  // Wird später ergänzt
                  notes: '',
                  lastVisit,
                  visitCount: customerAppointments.length,
                  totalSpent: 0,  // Wird später berechnet
                  tags: []
                } as CustomerViewModel;
              })
            )
          )
        ).pipe(
          // Nicht-existierende Kunden herausfiltern
          map(customers => customers.filter(c => c !== null) as CustomerViewModel[])
        );
      })
    );
  }
  
  // Berechnet Statistiken basierend auf den geladenen Kunden
  calculateStatistics(): void {
    // Gesamtanzahl der Kunden
    this.totalCustomers = this.allCustomers.length;
    
    // Stammkunden (mit mehr als 3 Besuchen)
    this.regularCustomers = this.allCustomers.filter(
      customer => (customer.visitCount || 0) >= 3
    ).length;
    
    // Neue Kunden diesen Monat - basierend auf firstVisit
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.newCustomersThisMonth = this.allCustomers.filter(customer => {
      if (!customer.lastVisit) return false;
      
      const visitDate = new Date(customer.lastVisit);
      return visitDate >= firstDayOfMonth;
    }).length;
  }
  
  // Filtere Kunden basierend auf den aktuellen Filtereinstellungen
  filterCustomers(): void {
    if (!this.allCustomers) return;
    
    let filtered = [...this.allCustomers];
    
    // Status-Filter anwenden (aktiv = in den letzten 3 Monaten einen Termin)
    if (this.statusFilter !== 'all') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      filtered = filtered.filter(c => {
        if (this.statusFilter === 'active') {
          return c.lastVisit && new Date(c.lastVisit) >= threeMonthsAgo;
        } else {
          return !c.lastVisit || new Date(c.lastVisit) < threeMonthsAgo;
        }
      });
    }
    
    // Suchquery anwenden
    if (this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c => {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        const email = (c.email || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const notes = (c.notes || '').toLowerCase();
        
        return fullName.includes(query) || 
               email.includes(query) || 
               phone.includes(query) ||
               notes.includes(query);
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
          const nameA = `${a.firstName} ${a.lastName}`;
          const nameB = `${b.firstName} ${b.lastName}`;
          comparison = nameA.localeCompare(nameB);
          break;
          
        case 'email':
          const emailA = a.email || '';
          const emailB = b.email || '';
          comparison = emailA.localeCompare(emailB);
          break;
          
        case 'lastVisit':
          const aTime = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
          const bTime = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
          comparison = aTime - bTime;
          break;
          
        case 'visitCount':
          comparison = (a.visitCount || 0) - (b.visitCount || 0);
          break;
          
        default:
          const defaultNameA = `${a.firstName} ${a.lastName}`;
          const defaultNameB = `${b.firstName} ${b.lastName}`;
          comparison = defaultNameA.localeCompare(defaultNameB);
      }
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  // Sortierung umschalten
  sortCustomers(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
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
  
  // Notizen bearbeiten
  editCustomerNotes(customer: CustomerViewModel): void {
    this.selectedCustomer = customer;
    this.isEditingNotes = true;
  }
  
  // Notizen speichern
  saveCustomerNotes(customerId: string, notes: string): void {
    if (!this.provider) return;
    
    this.loadingService.setLoading(true, 'Speichere Notizen...');
    
    this.providerCustomerService.updateCustomerNotes(
      this.provider.userId, 
      customerId, 
      notes
    ).then(() => {
      this.loadingService.setLoading(false);
      
      // Lokales Update ohne neu zu laden
      const customerIndex = this.allCustomers.findIndex(c => c.customerId === customerId);
      if (customerIndex >= 0) {
        this.allCustomers[customerIndex].notes = notes;
        
        // Auch in gefilterten Kunden aktualisieren
        const filteredIndex = this.filteredCustomers.findIndex(c => c.customerId === customerId);
        if (filteredIndex >= 0) {
          this.filteredCustomers[filteredIndex].notes = notes;
        }
      }
      
      this.isEditingNotes = false;
      this.selectedCustomer = null;
    }).catch(error => {
      console.error('Fehler beim Speichern der Notizen:', error);
      this.loadingService.setLoading(false);
    });
  }
  
  // Detailansicht schließen
  closeCustomerDetails(): void {
    this.selectedCustomer = null;
    this.isEditingNotes = false;
  }
  
  // Notizen abbrechen
  cancelNotes(): void {
    this.isEditingNotes = false;
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
  getStatusText(customer: CustomerViewModel): string {
    if (!customer.lastVisit) return 'Neu';
    
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    return new Date(customer.lastVisit) >= threeMonthsAgo ? 'Aktiv' : 'Inaktiv';
  }
}