import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
    } else {
      console.error('Provider is null in customers-list component!');
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Improved method to load customer relations and customer data
  loadCustomerRelations(): void {
    if (!this.provider || !this.provider.providerId) {
      console.error('Provider data missing or invalid!', this.provider);
      return;
    }
    
    this.loadingService.setLoading(true, 'Lade Kundendaten...');
    console.log('Loading customer relations for provider:', this.provider.providerId);
    
    // Get provider-customer relations for this provider
    const relationSub = this.providerCustomerService
      .getCustomerRelationsByProvider(this.provider.providerId)
      .subscribe({
        next: (relations) => {
          console.log(`Found ${relations.length} customer relations for provider ${this.provider?.providerId}:`, relations);
          
          // Clear previous data
          this.relationMap.clear();
          this.customerMap.clear();
          this.allCustomers = [];
          
          // Store relations in map for quick lookup
          relations.forEach(relation => {
            this.relationMap.set(relation.customerId, relation);
          });
          
          // No relations found - we're done
          if (relations.length === 0) {
            this.filteredCustomers = [];
            this.calculateStatistics();
            this.loadingService.setLoading(false);
            return;
          }
          
          // Get all customer IDs from relations
          const customerIds = relations.map(relation => relation.customerId);
          console.log('Customer IDs to load:', customerIds);
          
          // Load each customer individually and handle errors gracefully
          const customerRequests = customerIds.map(customerId => 
            this.customerService.getCustomer(customerId).pipe(
              catchError(error => {
                console.error(`Error loading customer ${customerId}:`, error);
                // Return a placeholder customer on error
                return of(undefined);
              })
            )
          );
          
          // Process all customer requests with forkJoin
          forkJoin(customerRequests).subscribe({
            next: (customers) => {
              console.log(`Loaded ${customers.filter(c => c !== undefined).length} customers of ${customerIds.length} requested`);
              
              // Process each customer and create view models
              customers.forEach((customer, index) => {
                const customerId = customerIds[index];
                const relation = this.relationMap.get(customerId);
                
                if (!relation) {
                  console.error(`Missing relation for customer ID ${customerId}`);
                  return;
                }
                
                if (customer) {
                  // We have valid customer data - store in map
                  this.customerMap.set(customerId, customer);
                  
                  // Create view model with combined data
                  const customerViewModel: CustomerViewModel = {
                    id: customer.id,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email,
                    phone: customer.phone || '',
                    relationId: relation.id,
                    notes: relation.notes || '',
                    lastVisit: relation.lastVisit ? new Date(relation.lastVisit) : null,
                    visitCount: relation.visitCount || 0,
                    totalSpent: relation.totalSpent || 0,
                    tags: relation.tags || []
                  };
                  
                  this.allCustomers.push(customerViewModel);
                } else {
                  // No customer found - create placeholder using relation data
                  console.log(`Creating placeholder for missing customer ${customerId}`);
                  
                  const placeholderName = relation.customerFirstName || 'Kunde';
                  const placeholderLastName = relation.customerLastName || customerId.substring(0, 5);
                  
                  const placeholderCustomer: CustomerViewModel = {
                    id: customerId,
                    firstName: placeholderName,
                    lastName: placeholderLastName,
                    email: relation.customerEmail || '',
                    phone: relation.customerPhone || '',
                    relationId: relation.id,
                    notes: relation.notes || '',
                    lastVisit: relation.lastVisit ? new Date(relation.lastVisit) : null,
                    visitCount: relation.visitCount || 0,
                    totalSpent: relation.totalSpent || 0,
                    tags: relation.tags || []
                  };
                  
                  this.allCustomers.push(placeholderCustomer);
                }
              });
              
              // Finalize loading once we have processed all customers
              this.finalizeCustomerLoading();
            },
            error: (error) => {
              console.error('Error loading customers:', error);
              this.loadingService.setLoading(false);
            }
          });
        },
        error: (error) => {
          console.error("Error loading customer relations:", error);
          this.loadingService.setLoading(false);
        }
      });
      
    this.subscriptions.push(relationSub);
  }
  
  // Hilfsmethode zum Abschließen des Ladevorgangs
  private finalizeCustomerLoading(): void {
    console.log(`Finalizing customer loading with ${this.allCustomers.length} customers`);
    
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