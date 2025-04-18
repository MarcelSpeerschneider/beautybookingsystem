import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthenticationService } from '../../../services/authentication.service';
import { ProviderService } from '../../../services/provider.service';
import { ServiceService } from '../../../services/service.service';
import { CartService } from '../../../services/cart.service';
import { Provider } from '../../../models/provider.model';
import { LoadingService } from '../../../services/loading.service';
import { Service } from '../../../models/service.model';

@Component({
  selector: 'app-public-provider',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-provider.component.html',
  styleUrls: ['./public-provider.component.css']
})
export class PublicProviderComponent implements OnInit, OnDestroy {
  // Services
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthenticationService);
  private providerService = inject(ProviderService);
  private serviceService = inject(ServiceService);
  private cartService = inject(CartService);
  private loadingService = inject(LoadingService);

  // Provider data
  provider: Provider & { providerId: string } | null = null;
  services: (Service & { id: string })[] = [];
  
  // Cart state
  cartItems: (Service & { id: string })[] = [];
  cartItemCount: number = 0;
  cartSidebarOpen: boolean = false;
  
  // Reviews data (Mock-Daten)
  reviews: any[] = [
    {
      id: '1',
      customerName: 'Maria Schmidt',
      rating: 5,
      comment: 'Ich war mit der Maniküre sehr zufrieden. Die Atmosphäre war entspannt und das Ergebnis perfekt!',
      createdAt: new Date('2024-01-15')
    },
    {
      id: '2',
      customerName: 'Thomas Müller',
      rating: 4,
      comment: 'Der Haarschnitt war super, die Beratung vorab sehr hilfreich. Ein Stern Abzug wegen der Wartezeit.',
      createdAt: new Date('2024-02-03')
    },
    {
      id: '3',
      customerName: 'Julia Weber',
      rating: 5,
      comment: 'Die Gesichtsbehandlung war ein Traum! Meine Haut fühlt sich wunderbar an und das Personal war sehr freundlich.',
      createdAt: new Date('2024-03-10')
    }
  ];
  
  // UI state
  isLoggedIn = false;
  isOwnProviderPage = false;
  successMessage = '';
  showSuccessMessage = false;
  
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Anbieterinfo...');
    
    // Business Name aus der Route holen
    this.subscriptions.push(
      this.route.paramMap.subscribe(params => {
        const businessName = params.get('businessName');
        if (businessName) {
          this.loadProviderByBusinessName(businessName);
        } else {
          this.loadingService.setLoading(false);
          this.router.navigate(['/']);
        }
      })
    );
    
    // Auth-Status überwachen
    this.subscriptions.push(
      this.authService.user$.subscribe(user => {
        this.isLoggedIn = !!user;
        this.checkIfOwnProvider();
      })
    );
    
    // Warenkorb-Updates abonnieren
    this.subscriptions.push(
      this.cartService.cartItems$.subscribe(items => {
        this.cartItems = items;
        this.cartItemCount = items.length;
      })
    );

    // Event-Listener für ESC-Taste
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  ngOnDestroy(): void {
    // Alle Subscriptions beenden
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Event-Listener entfernen
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }
  
  // Event-Handler für ESC-Taste - schließt Sidebar
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.cartSidebarOpen) {
      this.closeCartSidebar();
    }
  }
  
  // Provider anhand des Geschäftsnamens laden
  private loadProviderByBusinessName(businessName: string): void {
    this.subscriptions.push(
      this.providerService.getProviders().subscribe({
        next: providers => {
          const foundProvider = providers.find(p => 
            p.businessName.toLowerCase() === businessName.toLowerCase()
          );
          
          if (foundProvider) {
            this.provider = foundProvider;
            this.loadServices(foundProvider.providerId);
            this.checkIfOwnProvider();
          } else {
            console.error(`Provider with business name ${businessName} not found`);
            this.loadingService.setLoading(false);
            this.router.navigate(['/']);
          }
        },
        error: error => {
          console.error('Error loading provider:', error);
          this.loadingService.setLoading(false);
        }
      })
    );
  }
  
  // Dienste für den Provider laden
  private loadServices(providerId: string): void {
    this.subscriptions.push(
      this.serviceService.getServicesByProvider(providerId).subscribe({
        next: services => {
          this.services = services;
          this.loadingService.setLoading(false);
        },
        error: error => {
          console.error('Error loading services:', error);
          this.loadingService.setLoading(false);
        }
      })
    );
  }
  
  // Prüfen ob der eingeloggte Nutzer der Provider ist
  private checkIfOwnProvider(): void {
    if (!this.provider || !this.isLoggedIn) {
      this.isOwnProviderPage = false;
      return;
    }
    
    const currentUser = this.authService.getUser();
    this.isOwnProviderPage = currentUser ? this.provider.providerId === currentUser.uid : false;

  }
  
  // Initialen für den Provider-Avatar
  getProviderInitials(): string {
    if (!this.provider || !this.provider.businessName) return '';
    
    const nameParts = this.provider.businessName.split(' ');
    if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    } else {
      return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
    }
  }
  
  // Formatierungshilfen
  formatCurrency(price: number): string {
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR' 
    }).format(price);
  }
  
  formatDate(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  
  // Warenkorb-Button-Handler
  goToCart(): void {
    this.toggleCartSidebar();
  }
  
  // Service zum Warenkorb hinzufügen
  selectService(service: Service & { id: string }): void {
    if (this.isOwnProviderPage) {
      this.displayMessage('Als Anbieter können Sie keine Termine bei sich selbst buchen. Dies ist nur eine Vorschau Ihrer Buchungsseite.');
      return;
    }
    
    this.cartService.addItem(service);
    this.cartService.setProviderId(this.provider?.providerId || '');
    localStorage.setItem('bookingFlow', 'active');
    
    this.displayMessage(`${service.name} wurde zum Warenkorb hinzugefügt!`);
    this.toggleCartSidebar();
  }
  
  // Warenkorb-Sidebar anzeigen/verstecken
  toggleCartSidebar(): void {
    this.cartSidebarOpen = !this.cartSidebarOpen;
    document.body.style.overflow = this.cartSidebarOpen ? 'hidden' : '';
  }
  
  // Warenkorb-Sidebar schließen
  closeCartSidebar(event?: Event): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (!target.closest('.cart-sidebar') || target.closest('.btn-close')) {
        this.cartSidebarOpen = false;
        document.body.style.overflow = '';
      }
    } else {
      this.cartSidebarOpen = false;
      document.body.style.overflow = '';
    }
  }
  
  // Service aus dem Warenkorb entfernen
  removeFromCart(service: Service & { id: string }): void {
    this.cartService.removeItem(service.id);
    this.displayMessage(`${service.name} wurde aus dem Warenkorb entfernt.`);
  }
  
  // Gesamtbetrag im Warenkorb berechnen
  getCartTotal(): number {
    return this.cartItems.reduce((total, item) => total + item.price, 0);
  }
  
  // Weiter zur Terminauswahl
  proceedToAppointment(): void {
    if (this.cartItemCount === 0) {
      this.displayMessage('Ihr Warenkorb ist leer. Bitte wählen Sie zuerst eine Dienstleistung aus.');
      return;
    }
    
    if (this.isOwnProviderPage) {
      this.displayMessage('Als Anbieter können Sie keine Termine bei sich selbst buchen. Dies ist nur eine Vorschau Ihrer Buchungsseite.');
      return;
    }
    
    const providerId = this.provider?.providerId || '';
    this.router.navigate(['/appointment-selection', providerId]);
    this.closeCartSidebar();
  }
  
  // Login-Handler
  handleLogin(): void {
    if (!this.isOwnProviderPage) {
      this.router.navigate(['/customer-login']);
    }
  }
  
  // Zum Dashboard navigieren (für Provider)
  navigateToDashboard(): void {
    if (this.isLoggedIn && this.isOwnProviderPage) {
      this.router.navigate(['/provider-dashboard']);
    }
  }
  
  // Zum Profil navigieren (für Kunden)
  navigateToProfile(): void {
    if (this.isLoggedIn && !this.isOwnProviderPage) {
      this.router.navigate(['/customer-profile']);
    }
  }
  
  // Statusmeldungen anzeigen
  displayMessage(message: string): void {
    this.successMessage = message;
    this.showSuccessMessage = true;
    
    setTimeout(() => {
      this.showSuccessMessage = false;
    }, 3000);
  }
  
  // Sterne für Bewertungen rendern
  renderStars(rating: number): string[] {
    const stars: string[] = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= rating ? 'filled' : 'empty');
    }
    return stars;
  }
}