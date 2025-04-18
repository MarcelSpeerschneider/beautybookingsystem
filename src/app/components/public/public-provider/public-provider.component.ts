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
  
  // Reviews data (placeholders for now)
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
    
    // 1. Get businessName from the route
    const businessNameSub = this.route.paramMap.subscribe(params => {
      const businessName = params.get('businessName');
      if (businessName) {
        this.loadProviderByBusinessName(businessName);
      } else {
        this.loadingService.setLoading(false);
        this.router.navigate(['/']); // Navigate home if no business name provided
      }
    });
    
    this.subscriptions.push(businessNameSub);
    
    // 2. Check authentication state
    const authSub = this.authService.user$.subscribe(user => {
      this.isLoggedIn = !!user;
      this.checkIfOwnProvider();
    });
    
    this.subscriptions.push(authSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  private loadProviderByBusinessName(businessName: string): void {
    // In a real app, you would have a method to find provider by business name
    // For now, we'll get all providers and find the matching one
    const providerSub = this.providerService.getProviders().subscribe({
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
          this.router.navigate(['/']); // Provider not found, navigate home
        }
      },
      error: error => {
        console.error('Error loading provider:', error);
        this.loadingService.setLoading(false);
      }
    });
    
    this.subscriptions.push(providerSub);
  }
  
  private loadServices(providerId: string): void {
    const servicesSub = this.serviceService.getServicesByProvider(providerId).subscribe({
      next: services => {
        this.services = services;
        this.loadingService.setLoading(false);
      },
      error: error => {
        console.error('Error loading services:', error);
        this.loadingService.setLoading(false);
      }
    });
    
    this.subscriptions.push(servicesSub);
  }
  
  private checkIfOwnProvider(): void {
    if (!this.provider || !this.isLoggedIn) {
      this.isOwnProviderPage = false;
      return;
    }
    
    const currentUser = this.authService.getUser();
    if (currentUser && this.provider.providerId === currentUser.uid) {
      this.isOwnProviderPage = true;
    } else {
      this.isOwnProviderPage = false;
    }
  }
  
  getProviderInitials(): string {
    if (!this.provider || !this.provider.businessName) return '';
    
    const nameParts = this.provider.businessName.split(' ');
    if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    } else {
      return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
    }
  }
  
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
  
  selectService(service: Service & { id: string }): void {
    if (this.isOwnProviderPage) {
      this.displayMessage('Als Anbieter können Sie keine Termine bei sich selbst buchen. Dies ist nur eine Vorschau Ihrer Buchungsseite.');
      return;
    }
    
    this.cartService.clearCart(); // Clear any previous selections
    this.cartService.addItem(service);
    this.cartService.setProviderId(this.provider?.providerId || '');
    
    // Set booking flow flag
    localStorage.setItem('bookingFlow', 'active');
    
    this.displayMessage(`${service.name} wurde zum Warenkorb hinzugefügt!`);
    
    // Navigate to appointment selection
    setTimeout(() => {
      if (this.provider) {
        this.router.navigate(['/appointment-selection', this.provider.providerId]);
      }
    }, 1000);
  }
  
  navigateToBooking(): void {
    if (this.isOwnProviderPage) {
      this.displayMessage('Als Anbieter können Sie keine Termine bei sich selbst buchen. Dies ist nur eine Vorschau Ihrer Buchungsseite.');
      return;
    }
    
    if (!this.services || this.services.length === 0) {
      this.displayMessage('Es sind derzeit keine Dienstleistungen verfügbar für die Buchung.');
      return;
    }
    
    // Scroll to services section
    const servicesSection = document.querySelector('.services-section');
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
  
  handleLogin(): void {
    if (this.isOwnProviderPage) {
      return;
    }
    
    // Navigate to login page
    this.router.navigate(['/customer-login']);
  }
  
  navigateToDashboard(): void {
    if (this.isLoggedIn && this.isOwnProviderPage) {
      this.router.navigate(['/provider-dashboard']);
    }
  }
  
  navigateToProfile(): void {
    if (this.isLoggedIn && !this.isOwnProviderPage) {
      this.router.navigate(['/customer-profile']);
    }
  }
  
  displayMessage(message: string): void {
    this.successMessage = message;
    this.showSuccessMessage = true;
    
    setTimeout(() => {
      this.showSuccessMessage = false;
    }, 3000);
  }
  
  // Helper method for reviews (placeholder functionality)
  renderStars(rating: number): string[] {
    const stars: string[] = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(i <= rating ? 'filled' : 'empty');
    }
    return stars;
  }
}