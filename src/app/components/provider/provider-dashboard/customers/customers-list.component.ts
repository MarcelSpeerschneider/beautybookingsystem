import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, forkJoin, of, combineLatest } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Provider } from '../../../../models/provider.model';
import { CustomerService } from '../../../../services/customer.service';
import { LoadingService } from '../../../../services/loading.service';
import { CustomerDetailComponent } from './customer-detail/customer-detail.component';
import { ProviderCustomerService } from '../../../../services/provider-customer.service';
import { CustomerNotesComponent } from './customer-notes/customer-notes.component';
import { CustomerAddComponent } from './customer-add/customer-add.component';
import { Customer } from '../../../../models/customer.model';
import { ProviderCustomerRelation } from '../../../../models/provider-customer-relation.model';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

// Extended Customer interface for UI display
interface CustomerViewModel {
  customerId: string;
  userId: string;
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
  
  // Kunden-Map für die korrekte Zuordnung
  customerMap = new Map<string, Customer>();
  relationMap = new Map<string, any>();
  
  // Debug-Infos
  debugInfo = '';
  loadingState = '';

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
  private firestore: Firestore = inject(Firestore);
  private customerService = inject(CustomerService);
  private providerCustomerService = inject(ProviderCustomerService);
  private loadingService = inject(LoadingService);

  ngOnInit(): void {
    if (this.provider) {
      this.loadAllDataSeparately();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Neue Ladetechnik: Lade erst alle Kunden, dann alle Relations, dann manuell zusammenführen
  loadAllDataSeparately(): void {
    if (!this.provider) return;
    
    this.loadingService.setLoading(true, 'Lade Daten...');
    this.loadingState = 'Lade Kundendaten und Relationen separat...';
    
    // Schritt 1: Alle Kunden laden
    const customerSub = this.customerService.getCustomers().subscribe(
      customers => {
        console.log("1. Alle Kunden geladen:", customers);
        this.loadingState += `\n${customers.length} Kunden geladen`;
        
        // Kunden in einer Map speichern für schnellen Zugriff
        this.customerMap.clear();
        customers.forEach(customer => {
          this.customerMap.set(customer.customerId, customer);
          // Auch nach E-Mail speichern für alternative Suche
          if (customer.email) {
            this.customerMap.set(customer.email, customer);
          }
        });
        
        // Schritt 2: Alle Relations laden
        this.loadRelationsAndCombine();
      },
      error => {
        console.error("Fehler beim Laden der Kunden:", error);
        this.loadingState += "\nFehler beim Laden der Kunden!";
        this.loadingService.setLoading(false);
      }
    );
    
    this.subscriptions.push(customerSub);
  }
  
  // Lade Relations und führe die Daten zusammen
  loadRelationsAndCombine(): void {
    if (!this.provider) return;
    
    this.loadingState += '\nLade Provider-Customer Relations...';
    
    const relationSub = this.providerCustomerService
      .getCustomerRelationsByProvider(this.provider.userId)
      .subscribe(
        relations => {
          console.log("2. Provider-Customer Relations geladen:", relations);
          this.loadingState += `\n${relations.length} Relations geladen`;
          
          // Relations in Map speichern
          this.relationMap.clear();
          relations.forEach(relation => {
            this.relationMap.set(relation.customerId, relation);
          });
          
          // Schritt 3: Daten kombinieren
          this.combineCustomersAndRelations(relations);
        },
        error => {
          console.error("Fehler beim Laden der Relations:", error);
          this.loadingState += "\nFehler beim Laden der Relations!";
          this.loadingService.setLoading(false);
        }
      );
      
    this.subscriptions.push(relationSub);
  }
  
  // Kombiniere Kunden und Relations
  combineCustomersAndRelations(relations: any[]): void {
    const combinedData: CustomerViewModel[] = [];
    const processedIds: Set<string> = new Set();
    
    this.loadingState += '\nKombiniere Daten...';

    // Gehe durch alle Relations und versuche, den entsprechenden Kunden zu finden
    relations.forEach(relation => {
      const customerId = relation.customerId;
      let customer: Customer | undefined;
      
      // VERBESSERUNG: Versuche verschiedene Wege, den Kunden zu finden
      
      // 1. Direkt über customerId
      if (this.customerMap.has(customerId)) {
        customer = this.customerMap.get(customerId);
        console.log(`Kunde gefunden über ID ${customerId}:`, customer);
      } 
      // 2. Firestore-Kunden mit userId=customerId finden (für den Fall, dass customerId eine Auth-ID ist)
      else {
        // Versuche alle Kunden zu finden, die auf diese Relation passen könnten
        const potentialCustomers = Array.from(this.customerMap.values()).filter(c => 
          c.email === relation.customerEmail || 
          c.userId === customerId ||
          (c.firstName && relation.customerFirstName && 
           c.firstName === relation.customerFirstName && 
           c.lastName === relation.customerLastName)
        );
        
        if (potentialCustomers.length > 0) {
          customer = potentialCustomers[0];
          console.log(`Kunde gefunden über alternative Suche für ${customerId}:`, customer);
          
          // WICHTIG: Für künftige Lookups dieser ID in der Map speichern
          this.customerMap.set(customerId, customer);
        }
      }
      
      // Kunde gefunden - ViewModell erstellen
      if (customer) {
        combinedData.push({
          customerId: customer.customerId, // WICHTIG: Die echte Firestore-ID verwenden
          userId: customer.userId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone || '',
          relationId: relation.relationId,
          notes: relation.notes || '',
          lastVisit: relation.lastVisit,
          visitCount: relation.visitCount || 0
        });
        processedIds.add(customer.customerId);
      } 
      // Kein Kunde gefunden - Platzhalter erstellen
      else {
        console.log(`Keinen Kunden für Relation mit ID ${customerId} gefunden - erstelle Platzhalter`);
        combinedData.push({
          customerId: customerId, // Wir verwenden die ID aus der Relation
          userId: '',
          firstName: 'Kunde',
          lastName: relation.customerId.substring(0, 5),
          email: relation.customerEmail || '',
          phone: relation.customerPhone || '',
          relationId: relation.relationId,
          notes: relation.notes || '',
          lastVisit: relation.lastVisit,
          visitCount: relation.visitCount || 0
        });
      }
    });
    
    // Füge Kunden ohne Relations hinzu (optional)
    this.customerMap.forEach((customer, id) => {
      // Nur Kunden, die noch nicht verarbeitet wurden
      if (!processedIds.has(customer.customerId)) {
        combinedData.push({
          customerId: customer.customerId,
          userId: customer.userId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone || '',
          notes: '',
          lastVisit: null,
          visitCount: 0
        });
      }
    });

    // Setze die kombinierten Daten
    this.allCustomers = combinedData;
    this.filteredCustomers = [...combinedData];
    this.calculateStatistics();
    
    // Fertig mit Laden
    this.loadingState += `\nFertig! ${combinedData.length} Kunden insgesamt angezeigt.`;
    this.loadingService.setLoading(false);
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
    console.log('Viewing customer details:', customer);
    this.selectedCustomer = customer;
  }

  // Edit customer notes - verbesserter Ansatz
  editCustomerNotes(customer: CustomerViewModel): void {
    console.log('Bearbeite Notizen für Kunde:', {
      customerId: customer.customerId,
      email: customer.email,
      name: `${customer.firstName} ${customer.lastName}`
    });
    
    // Notieren der aktuellen Customer-ID für spätere Verwendung
    this.selectedCustomerId = customer.customerId;
    this.selectedCustomer = customer;
    this.isEditingNotes = true;
  }

  // Save customer notes - WICHTIG! Korrekter Ansatz
  saveCustomerNotes(customerId: string, notes: string): void {
    if (!this.provider) return;

    console.log("Speichere Notizen für Kunde mit ID:", customerId);
    
    // WICHTIG: Falls der Kunde in unserer customerMap ist, stellen wir sicher, 
    // dass wir die richtige ID verwenden
    let idToUse = customerId;
    
    // Suche den Kunden in der Ansicht
    const customer = this.allCustomers.find(c => c.customerId === customerId);
    if (!customer) {
      console.error("Kunde nicht gefunden:", customerId);
      alert("Fehler: Kunde nicht gefunden!");
      return;
    }
    
    // KRITISCHER TEIL: Falls es eine Relation mit einer anderen ID gibt, diese verwenden
    // Wir benötigen möglicherweise die userId oder eine andere ID für die Relation
    const relation = this.relationMap.get(customerId);
    if (relation) {
      // Verwende dieselbe ID, die in der Relation ist
      idToUse = relation.customerId;
      console.log(`Relation gefunden - verwende ID ${idToUse} für Notizen`);
    } else {
      console.log(`Keine Relation für ID ${customerId} gefunden - verwende diese ID direkt`);
    }

    this.loadingService.setLoading(true, 'Speichere Notizen...');

    this.providerCustomerService.updateCustomerNotes(
      this.provider.userId,
      idToUse, // Die möglicherweise korrigierte ID
      notes
    ).then(() => {
      this.loadingService.setLoading(false);
      
      // Lokale Daten aktualisieren
      if (customer) {
        customer.notes = notes;
      }

      this.isEditingNotes = false;
      this.selectedCustomer = null;
      this.selectedCustomerId = null;
      
      // Erfolgsmeldung
      alert('Notizen erfolgreich gespeichert!');
      
      // Lade alle Daten neu, um sicherzustellen, dass alles korrekt ist
      setTimeout(() => this.loadAllDataSeparately(), 500);
      
    }).catch(error => {
      console.error('Fehler beim Speichern der Notizen:', error);
      this.loadingService.setLoading(false);
      alert('Fehler beim Speichern der Notizen. Bitte versuchen Sie es erneut.');
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
    
    // Daten neu laden
    setTimeout(() => {
      this.loadAllDataSeparately();
    }, 1000);
  }
  
  // Erweiterte Debug-Informationen anzeigen
  showDebugInfo(): void {
    console.log("Kunden-Map:", this.customerMap);
    console.log("Relations-Map:", this.relationMap);
    console.log("Alle Kunden:", this.allCustomers);
    
    alert(`Debug-Informationen:
    - ${this.customerMap.size} Kunden in Map
    - ${this.relationMap.size} Relations in Map
    - ${this.allCustomers.length} Kunden in der Anzeige
    - Lade-Status: ${this.loadingState}
    `);
  }
}