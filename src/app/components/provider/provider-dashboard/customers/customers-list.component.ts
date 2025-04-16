import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Provider } from '../../../../models/provider.model';
import { Customer } from '../../../../models/customer.model';
import { CustomerService } from '../../../../services/customer.service';
import { LoadingService } from '../../../../services/loading.service';
import { CustomerDetailComponent } from './customer-detail/customer-detail.component';
import { ProviderCustomerService } from '../../../../services/provider-customer.service';
import { CustomerNotesComponent } from './customer-notes/customer-notes.component';
import { CustomerAddComponent } from './customer-add/customer-add.component';

// Erweiterter Provider-Typ für die Dokument-ID
type ProviderWithId = Provider & { providerId: string };

// Extended Customer interface for UI display
interface CustomerViewModel {
  id: string;            // Diese ID entspricht der Firestore Document-ID
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
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
    CustomerNotesComponent,
    CustomerAddComponent
  ],
  templateUrl: './customers-list.component.html',
  styleUrls: ['./customers-list.component.css']
})
export class CustomersListComponent implements OnInit, OnDestroy {
  @Input() provider: ProviderWithId | null = null;

  // Customer data
  allCustomers: CustomerViewModel[] = [];
  filteredCustomers: CustomerViewModel[] = [];
  selectedCustomer: CustomerViewModel | null = null;
  
  // Maps für die effiziente Datenzuordnung
  customerMap = new Map<string, Customer>();
  relationMap = new Map<string, any>();

  // Filters and sorting
  searchQuery: string = '';
  statusFilter: string = 'all';
  sortField: string = 'name';
  sortDirection: string = 'asc';

  // Statistics
  totalCustomers: number = 0;
  newCustomersThisMonth: number = 0;
  regularCustomers: number = 0;

  // UI state
  isEditingNotes: boolean = false;
  showAddCustomerForm = false;

  private subscriptions: Subscription[] = [];
  private customerService = inject(CustomerService);
  private providerCustomerService = inject(ProviderCustomerService);
  private loadingService = inject(LoadingService);

  ngOnInit(): void {
    if (this.provider) {
      this.loadCustomerRelations();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Überarbeitete Methode - lädt nur die Kunden, die über eine Relation verbunden sind
  loadCustomerRelations(): void {
    if (!this.provider) return;
    
    this.loadingService.setLoading(true, 'Lade Kundendaten...');
    
    // GEÄNDERT: Nur Provider-Customer Relations laden, nicht alle Kunden
    const relationSub = this.providerCustomerService
      .getCustomerRelationsByProvider(this.provider.providerId)
      .subscribe({
        next: (relations) => {
          console.log("Provider-Customer Relations geladen:", relations);
          
          // Leere die alten Daten
          this.relationMap.clear();
          this.customerMap.clear();
          this.allCustomers = [];
          
          // Relations in Map speichern
          relations.forEach(relation => {
            this.relationMap.set(relation.customerId, relation);
          });
          
          // Keine Kunden? Dann sind wir fertig
          if (relations.length === 0) {
            this.filteredCustomers = [];
            this.calculateStatistics();
            this.loadingService.setLoading(false);
            return;
          }
          
          // Für jede Relation den zugehörigen Kunden laden
          relations.forEach((relation, index) => {
            const customerId = relation.customerId;
            
            // Nur wenn wir den Kunden noch nicht geladen haben
            if (!this.customerMap.has(customerId)) {
              this.customerService.getCustomer(customerId).subscribe({
                next: (customer) => {
                  if (customer) {
                    // Kunde gefunden - in die Map speichern
                    this.customerMap.set(customerId, customer);
                    
                    // Erstelle ein CustomerViewModel mit Relationsdaten
                    const customerViewModel: CustomerViewModel = {
                      id: customer.id,
                      firstName: customer.firstName,
                      lastName: customer.lastName,
                      email: customer.email,
                      phone: customer.phone || '',
                      relationId: relation.id,
                      notes: relation.notes || '',
                      lastVisit: relation.lastVisit,
                      visitCount: relation.visitCount || 0,
                      totalSpent: relation.totalSpent || 0,
                      tags: relation.tags || []
                    };
                    
                    // Zum Array hinzufügen
                    this.allCustomers.push(customerViewModel);
                    
                    // Wenn wir alle Kunden geladen haben, finalisieren
                    if (this.allCustomers.length === relations.length) {
                      this.finalizeCustomerLoading();
                    }
                  } else {
                    // Kein Kunde gefunden - Platzhalter erstellen
                    console.log(`Keinen Kunden für Relation mit ID ${customerId} gefunden - erstelle Platzhalter`);
                    
                    const placeholderCustomer: CustomerViewModel = {
                      id: customerId,
                      firstName: 'Kunde',
                      lastName: customerId.substring(0, 5),
                      email: '',
                      phone: '',
                      relationId: relation.id,
                      notes: relation.notes || '',
                      lastVisit: relation.lastVisit,
                      visitCount: relation.visitCount || 0,
                      totalSpent: relation.totalSpent || 0,
                      tags: relation.tags || []
                    };
                    
                    this.allCustomers.push(placeholderCustomer);
                    
                    // Wenn wir alle Kunden geladen haben, finalisieren
                    if (this.allCustomers.length === relations.length) {
                      this.finalizeCustomerLoading();
                    }
                  }
                },
                error: (error) => {
                  console.error(`Fehler beim Laden des Kunden ${customerId}:`, error);
                  
                  // Bei Fehlern trotzdem weitermachen - Platzhalter erstellen
                  const errorCustomer: CustomerViewModel = {
                    id: customerId,
                    firstName: 'Fehlender',
                    lastName: 'Kunde',
                    email: '',
                    phone: '',
                    relationId: relation.id,
                    notes: relation.notes || '',
                    lastVisit: relation.lastVisit,
                    visitCount: relation.visitCount || 0,
                    totalSpent: relation.totalSpent || 0,
                    tags: relation.tags || []
                  };
                  
                  this.allCustomers.push(errorCustomer);
                  
                  // Wenn wir alle Kunden geladen haben, finalisieren
                  if (this.allCustomers.length === relations.length) {
                    this.finalizeCustomerLoading();
                  }
                }
              });
            }
          });
        },
        error: (error) => {
          console.error("Fehler beim Laden der Relations:", error);
          this.loadingService.setLoading(false);
        }
      });
      
    this.subscriptions.push(relationSub);
  }
  
  // Hilfsmethode zum Abschließen des Ladevorgangs
  private finalizeCustomerLoading(): void {
    // Sortiere nach Namen
    this.allCustomers.sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`;
      const nameB = `${b.firstName} ${b.lastName}`;
      return nameA.localeCompare(nameB);
    });
    
    // Anwenden der Filter
    this.filterCustomers();
    
    // Statistiken berechnen
    this.calculateStatistics();
    
    // Ladevorgang beenden
    this.loadingService.setLoading(false);
  }

  calculateStatistics(): void {
    // Total customer count
    this.totalCustomers = this.allCustomers.length;

    // Regular customers (with 3+ visits)
    this.regularCustomers = this.allCustomers.filter(
      customer => (customer.visitCount || 0) >= 3
    ).length;

    // New customers this month
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    this.newCustomersThisMonth = this.allCustomers.filter(customer => {
      if (!customer.lastVisit) return false;

      const visitDate = new Date(customer.lastVisit);
      return visitDate >= firstDayOfMonth;
    }).length;
  }

  filterCustomers(): void {
    if (!this.allCustomers) return;

    let filtered = [...this.allCustomers];

    // Status filter (active = appointment in last 3 months)
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

    // Search query
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

    // Apply sorting
    this.sortCustomersArray(filtered);

    this.filteredCustomers = filtered;
  }

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

  sortCustomers(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    this.filterCustomers();
  }

  resetFilters(): void {
    this.statusFilter = 'all';
    this.searchQuery = '';
    this.filterCustomers();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterCustomers();
  }

  viewCustomerDetails(customer: CustomerViewModel): void {
    console.log('Viewing customer details:', customer);
    this.selectedCustomer = customer;
  }

  editCustomerNotes(customer: CustomerViewModel): void {
    console.log('Bearbeite Notizen für Kunde:', {
      id: customer.id,
      email: customer.email,
      name: `${customer.firstName} ${customer.lastName}`
    });
    
    this.selectedCustomer = customer;
    this.isEditingNotes = true;
  }

  saveCustomerNotes(customerId: string, notes: string): void {
    if (!this.provider) return;

    console.log("Speichere Notizen für Kunde mit ID:", customerId);
    
    this.loadingService.setLoading(true, 'Speichere Notizen...');

    this.providerCustomerService.updateCustomerNotes(
      this.provider.providerId, // Verwende providerId statt id
      customerId,
      notes
    ).then(() => {
      this.loadingService.setLoading(false);
      
      // Lokale Daten aktualisieren
      const customer = this.allCustomers.find(c => c.id === customerId);
      if (customer) {
        customer.notes = notes;
      }

      this.isEditingNotes = false;
      this.selectedCustomer = null;
      
      // Erfolgsmeldung
      alert('Notizen erfolgreich gespeichert!');
      
      // Daten optional neu laden
      setTimeout(() => this.loadCustomerRelations(), 500);
      
    }).catch(error => {
      console.error('Fehler beim Speichern der Notizen:', error);
      this.loadingService.setLoading(false);
      alert('Fehler beim Speichern der Notizen. Bitte versuchen Sie es erneut.');
    });
  }

  closeCustomerDetails(): void {
    this.selectedCustomer = null;
    this.isEditingNotes = false;
  }

  cancelNotes(): void {
    this.isEditingNotes = false;
  }

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

  getStatusText(customer: CustomerViewModel): string {
    if (!customer.lastVisit) return 'Neu';

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    return new Date(customer.lastVisit) >= threeMonthsAgo ? 'Aktiv' : 'Inaktiv';
  }

  // Show add customer form
  showAddCustomer(): void {
    this.showAddCustomerForm = true;
  }

  // Hide add customer form
  hideAddCustomer(): void {
    this.showAddCustomerForm = false;
  }

  // Handle new customer created
  handleCustomerCreated(customer: Customer): void {
    console.log('Neuer Kunde erstellt:', customer);

    // Daten neu laden, um die aktualisierte Kundenliste zu erhalten
    setTimeout(() => {
      this.loadCustomerRelations();
    }, 1000);
  }
}