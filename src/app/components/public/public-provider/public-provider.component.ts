import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';

// Models
import { Provider } from '../../../models/provider.model';
import { Service } from '../../../models/service.model';

// Services
import { ProviderService } from '../../../services/provider.service';
import { ServiceService } from '../../../services/service.service';
import { CartService } from '../../../services/cart.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { LoadingService } from '../../../services/loading.service';

// Mock Review Interface
interface MockReview {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

@Component({
  selector: 'app-public-provider',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-provider.component.html',
  styleUrls: ['./public-provider.component.css']
})
export class PublicProviderComponent implements OnInit, OnDestroy {
  // Provider Data
  provider: (Provider & { providerId: string }) | null = null;
  services: (Service & { id: string })[] = [];
  reviews: MockReview[] = [];
  
  // UI State
  isLoggedIn = false;
  isOwnProviderPage = false;
  showSuccess = false;
  successMessage = '';
  cartItemCount = 0;
  
  // Services
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private providerService = inject(ProviderService);
  private serviceService = inject(ServiceService);
  private cartService = inject(CartService);
  private authService = inject(AuthenticationService);
  private loadingService = inject(LoadingService);
  
  // Mock reviews data
  private mockReviews: MockReview[] = [
    {
      id: "1",
      customerName: "Maria Schmidt",
      rating: 5,
      comment: "Ich war mit der Maniküre sehr zufrieden. Die Atmosphäre war entspannt und das Ergebnis perfekt!",
      createdAt: new Date("2024-01-15")
    },
    {
      id: "2",
      customerName: "Thomas Müller",
      rating: 4,
      comment: "Der Haarschnitt war super, die Beratung vorab sehr hilfreich. Ein Stern Abzug wegen der Wartezeit.",
      createdAt: new Date("2024-02-03")
    },
    {
      id: "3",
      customerName: "Julia Weber",
      rating: 5,
      comment: "Die Gesichtsbehandlung war ein Traum! Meine Haut fühlt sich wunderbar an und das Personal war sehr freundlich.",
      createdAt: new Date("2024-03-10")
    },
    {
      id: "4",
      customerName: "Markus Neumann",
      rating: 3,
      comment: "Die Dienstleistung war okay, aber ich hätte mir etwas mehr Sorgfalt gewünscht. Das Ergebnis ist gut, aber nicht herausragend.",
      createdAt: new Date("2024-02-20")
    },
    {
      id: "5",
      customerName: "Sarah Klein",
      rating: 5,
      comment: "Absolut begeistert! Professionell, freundlich und das Ergebnis übertrifft meine Erwartungen. Werde definitiv wiederkommen!",
      createdAt: new Date("2024-03-25")
    }
  ];
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  ngOnInit(): void {
    // Start loading
    this.loadingService.setLoading(true, 'Lade Anbieter Informationen...');
    
    // Check authentication state
    const authSub = this.authService.user$.subscribe(user => {
      this.isLoggedIn = !!user;
    });
    this.subscriptions.push(authSub);
    
    // Get cart count
    const cartSub = this.cartService.cartItems$.subscribe(items => {
      this.cartItemCount = items.length;
    });
    this.subscriptions.push(cartSub);
    
    // Set mock reviews
    this.reviews = this.mockReviews;
    
    // Get provider from URL parameter
    const routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        const businessName = params.get('businessName');
        if (!businessName) {
          return of(null);
        }
        
        // Load provider by business name (using a workaround since we don't have a direct method)
        return this.providerService.getProviders().pipe(
          tap(providers => console.log('All providers:', providers)),
          switchMap(providers => {
            // Find provider by business name (case insensitive)
            const foundProvider = providers.find(p => 
              p.businessName.toLowerCase() === businessName.toLowerCase()
            );
            
            if (!foundProvider) {
              console.error('Provider not found:', businessName);
              return of(null);
            }
            
            // Check if this is the current user's provider page
            const currentUser = this.authService.getUser();
            if (currentUser && currentUser.uid === foundProvider.providerId) {
              this.isOwnProviderPage = true;
            }
            
            // Get services for this provider
            return this.serviceService.getServicesByProvider(foundProvider.providerId).pipe(
              tap(services => {
                this.services = services;
                this.provider = foundProvider;
                this.loadingService.setLoading(false);
              }),
              catchError(error => {
                console.error('Error fetching services:', error);
                this.loadingService.setLoading(false);
                return of([]);
              })
            );
          }),
          catchError(error => {
            console.error('Error fetching providers:', error);
            this.loadingService.setLoading(false);
            return of(null);
          })
        );
      })
    ).subscribe();
    
    this.subscriptions.push(routeSub);
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  // Helper function to get provider initials
  getProviderInitials(businessName?: string): string {
    if (!businessName) return 'BF';
    
    const nameParts = businessName.split(' ');
    if (nameParts.length === 1) {
      return nameParts[0].substring(0, 2).toUpperCase();
    }
    
    return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
  }
  
  // Service selection
  selectService(service: Service & { id: string }): void {
    if (this.isOwnProviderPage) {
      this.showSuccessMessage('Als Anbieter können Sie keine Termine bei sich selbst buchen. Dies ist nur eine Vorschau Ihrer Buchungsseite.');
      return;
    }
    
    // Check if service is already in cart
    if (this.isInCart(service.id)) {
      // If already in cart, navigate to booking flow
      this.startBooking();
      return;
    }
    
    // Set provider ID for the booking process
    this.cartService.setProviderId(this.provider?.providerId || '');
    
    // Add service to cart
    this.cartService.addItem(service);
    
    // Show success message
    this.showSuccessMessage(`${service.name} wurde zum Warenkorb hinzugefügt!`);
  }
  
  // Check if service is in cart
  isInCart(serviceId: string): boolean {
    return this.cartService.isInCart(serviceId);
  }
  
  // Start booking process
  startBooking(): void {
    if (this.isOwnProviderPage) {
      this.showSuccessMessage('Als Anbieter können Sie keine Termine bei sich selbst buchen. Dies ist nur eine Vorschau Ihrer Buchungsseite.');
      return;
    }
    
    if (this.services.length === 0) {
      this.showSuccessMessage('Es sind derzeit keine Dienstleistungen verfügbar für die Buchung.');
      return;
    }
    
    // If cart is empty and we have services, select the first one
    if (this.cartItemCount === 0 && this.services.length > 0) {
      this.selectService(this.services[0]);
    }
    
    // Check if we have a provider ID
    const providerId = this.cartService.getProviderId();
    if (!providerId && this.provider) {
      this.cartService.setProviderId(this.provider.providerId);
    }
    
    // Set booking flow flag
    localStorage.setItem('bookingFlow', 'active');
    
    // Navigate to next step - check if user is logged in
    if (!this.isLoggedIn) {
      // If not logged in, go to login page
      this.router.navigate(['/booking-login', this.provider?.providerId]);
    } else {
      // If logged in, go to booking overview
      this.router.navigate(['/booking-overview']);
    }
  }
  
  // Show success message with auto-dismiss
  showSuccessMessage(message: string): void {
    this.successMessage = message;
    this.showSuccess = true;
    
    setTimeout(() => {
      this.showSuccess = false;
    }, 3000);
  }
  
  // Login handler
  login(): void {
    this.router.navigate(['/customer-login']);
  }
}
