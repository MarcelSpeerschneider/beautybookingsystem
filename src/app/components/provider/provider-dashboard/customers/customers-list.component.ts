import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, forkJoin, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { Provider } from '../../../../models/provider.model';
import { Customer } from '../../../../models/customer.model';
import { Appointment } from '../../../../models/appointment.model';
import { CustomerService } from '../../../../services/customer.service';
import { LoadingService } from '../../../../services/loading.service';
import { AppointmentService } from '../../../../services/appointment.service';
import { CustomerDetailComponent } from './customer-detail/customer-detail.component';
import { ProviderCustomerService } from '../../../../services/provider-customer.service';
import { CustomerNotesComponent } from './customer-notes/customer-notes.component';
import { CustomerAddComponent } from './customer-add/customer-add.component';

// Extended Customer interface for UI display
interface CustomerViewModel extends Customer {
  relationId?: string;
  notes?: string;
  lastVisit?: Date | null;
  visitCount?: number;
  totalSpent?: number;
  tags?: string[];
  providerRef?: string;
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
  @Input() provider: Provider | null = null;
  
  // Customer data
  allCustomers: CustomerViewModel[] = [];
  filteredCustomers: CustomerViewModel[] = [];
  selectedCustomer: CustomerViewModel | null = null;
  
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
  selectedCustomerId: string | null = null;
  showAddCustomerForm = false;
  
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
      this.loadingService.setLoading(false);
      return;
    }
    
    console.log('Starte Laden der Kundenbeziehungen für Provider:', this.provider.userId);
    this.loadingService.setLoading(true, 'Lade Kundendaten...');
    
    // Safety timeout for loading indicator
    const loadingTimeout = setTimeout(() => {
      console.log('Timeout beim Laden der Kundendaten - breche ab');
      this.loadingService.setLoading(false);
      this.allCustomers = [];
      this.filteredCustomers = [];
      this.calculateStatistics();
    }, 10000);
    
    // Load provider-customer relationships
    const relationsSub = this.providerCustomerService
      .getCustomerRelationsByProvider(this.provider.userId)
      .pipe(
        tap(relations => console.log('Gefundene Kundenbeziehungen:', relations.length)),
        // For each relation, create a fallback customer model
        map(relations => {
          if (relations.length === 0) {
            console.log('Keine Kundenbeziehungen gefunden, versuche über Termine');
            return [];
          }
          
          // Extract customer IDs and create fallback models
          return relations.map(rel => {
            // Default/fallback customer model from relation data
            return {
              customerId: rel.customerId,
              userId: '',
              firstName: 'Kunde', // Generic placeholder
              lastName: rel.customerId.substring(0, 5), // Use ID part as identifier
              email: '',
              phone: '',
              relationId: rel.relationId,
              notes: rel.notes || '',
              lastVisit: rel.lastVisit,
              visitCount: rel.visitCount || 0,
              totalSpent: rel.totalSpent || 0,
              tags: rel.tags || [],
              providerRef: this.provider?.userId
            } as CustomerViewModel;
          });
        }),
        // Try to enhance with full customer data
        switchMap(fallbackCustomers => {
          if (fallbackCustomers.length === 0) {
            return this.loadCustomersFromAppointments().pipe(
              catchError(err => {
                console.error('Fehler beim Laden der Kunden über Termine:', err);
                return of([]);
              })
            );
          }
          
          // For each customer ID, try to load full details
          return forkJoin(
            fallbackCustomers.map(fallback => 
              this.customerService.getCustomer(fallback.customerId).pipe(
                map(fullCustomer => {
                  if (fullCustomer) {
                    console.log(`Vollständige Daten für Kunde ${fallback.customerId} geladen`);
                    // Merge full customer data with relationship data
                    return {
                      ...fullCustomer,
                      relationId: fallback.relationId,
                      notes: fallback.notes || (fullCustomer as any).notes,
                      lastVisit: fallback.lastVisit,
                      visitCount: fallback.visitCount || 0,
                      totalSpent: fallback.totalSpent || 0,
                      tags: fallback.tags || [],
                      providerRef: (fullCustomer as any).providerRef || this.provider?.userId
                    } as CustomerViewModel;
                  } else {
                    console.log(`Verwende Ersatzdaten für Kunde ${fallback.customerId}`);
                    return fallback;
                  }
                }),
                catchError(error => {
                  console.error(`Fehler beim Laden des Kunden ${fallback.customerId}, verwende Fallback:`, error);
                  return of(fallback);
                })
              )
            )
          );
        }),
        catchError(error => {
          console.error('Fehler in der Kundenladekette:', error);
          return of([]);
        })
      )
      .subscribe({
        next: (customers) => {
          clearTimeout(loadingTimeout);
          console.log('Kunden erfolgreich geladen:', customers.length);
          this.allCustomers = customers;
          this.totalCustomers = customers.length;
          
          // Calculate statistics
          this.calculateStatistics();
          
          // Filter and display customers
          this.filterCustomers();
          
          this.loadingService.setLoading(false);
        },
        error: (error) => {
          clearTimeout(loadingTimeout);
          console.error('Fehler beim Laden der Kunden:', error);
          this.loadingService.setLoading(false);
          this.allCustomers = [];
          this.filteredCustomers = [];
          this.calculateStatistics();
        },
        complete: () => {
          clearTimeout(loadingTimeout);
          console.log('Kundenladen abgeschlossen');
          this.loadingService.setLoading(false);
        }
      });
      
    this.subscriptions.push(relationsSub);
  }
  
  // Fallback method: Try to load customers from appointments
  loadCustomersFromAppointments(): Observable<CustomerViewModel[]> {
    if (!this.provider) return of([]);
    
    return this.appointmentService.getAppointmentsByProvider(this.provider.userId).pipe(
      map(appointments => {
        if (appointments.length === 0) return [];
        
        // Extract unique customer IDs
        const customerIds = [...new Set(appointments.map(a => a.customerId))];
        
        // Group appointments by customer
        const appointmentsByCustomer = customerIds.reduce((acc, id) => {
          acc[id] = appointments.filter(a => a.customerId === id);
          return acc;
        }, {} as {[customerId: string]: Appointment[]});
        
        // Create fallback customer models from appointment data
        return customerIds.map(id => {
          const customerAppointments = appointmentsByCustomer[id] || [];
          
          // Find the most recent appointment
          const sortedAppointments = [...customerAppointments].sort(
            (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
          
          const lastVisit = sortedAppointments.length > 0 ? 
            new Date(sortedAppointments[0].startTime) : null;
          
          // Create a basic customer model
          return {
            customerId: id,
            userId: '',
            firstName: 'Kunde',
            lastName: id.substring(0, 5),
            email: '',
            phone: '',
            notes: '',
            lastVisit,
            visitCount: customerAppointments.length,
            totalSpent: 0,
            tags: [],
            providerRef: this.provider?.userId
          } as CustomerViewModel;
        });
      })
    );
  }
  
  // Calculates statistics based on loaded customers
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
  
  // Filters customers based on current filter settings
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
  
  // Helper method to sort customers
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
  
  // Toggle sort direction
  sortCustomers(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    
    this.filterCustomers();
  }
  
  // Reset filters
  resetFilters(): void {
    this.statusFilter = 'all';
    this.searchQuery = '';
    this.filterCustomers();
  }
  
  // Clear search
  clearSearch(): void {
    this.searchQuery = '';
    this.filterCustomers();
  }
  
  // Show customer details
  viewCustomerDetails(customer: CustomerViewModel): void {
    this.selectedCustomer = customer;
  }
  
  // Edit customer notes
  editCustomerNotes(customer: CustomerViewModel): void {
    this.selectedCustomer = customer;
    this.isEditingNotes = true;
  }
  
  // Save customer notes
  saveCustomerNotes(customerId: string, notes: string): void {
    if (!this.provider) return;
    
    this.loadingService.setLoading(true, 'Speichere Notizen...');
    
    this.providerCustomerService.updateCustomerNotes(
      this.provider.userId, 
      customerId, 
      notes
    ).then(() => {
      this.loadingService.setLoading(false);
      
      // Update local data without reloading
      const customerIndex = this.allCustomers.findIndex(c => c.customerId === customerId);
      if (customerIndex >= 0) {
        this.allCustomers[customerIndex].notes = notes;
        
        // Also update filtered customers
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
  
  // Close customer details
  closeCustomerDetails(): void {
    this.selectedCustomer = null;
    this.isEditingNotes = false;
  }
  
  // Cancel notes editing
  cancelNotes(): void {
    this.isEditingNotes = false;
  }
  
  // Format date for display
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
  
  // Get customer status text
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
  handleCustomerCreated(customer: CustomerViewModel): void {
    console.log('Neuer Kunde erstellt:', customer);
    
    // Create CustomerViewModel for UI
    const newCustomer: CustomerViewModel = {
      ...customer,
      visitCount: 0,
      lastVisit: null,
      totalSpent: 0,
      tags: [],
      notes: customer.notes || ''
    };
    
    // Add to customer list
    this.allCustomers = [newCustomer, ...this.allCustomers];
    
    // Update statistics
    this.totalCustomers = this.allCustomers.length;
    this.newCustomersThisMonth++;
    this.calculateStatistics();
    
    // Apply filters to show the new customer
    this.filterCustomers();
  }
}