import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ServiceService } from '../../../services/service.service';
import { ProviderService } from '../../../services/provider.service';
import { CartService } from '../../../services/cart.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { Service } from '../../../models/service.model';
import { Provider } from '../../../models/provider.model';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-public-service-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-service-list.component.html', 
  styleUrls: ['./public-service-list.component.css']
})
export class PublicServiceListComponent implements OnInit, OnDestroy {
  
  provider: Provider | null | undefined = null;
  userId: string = '';
  services: Service[] = [];
  isOwnProviderPage: boolean = false;
  previewMode: boolean = false;
  
  private subscriptions: Subscription[] = [];
  
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serviceService = inject(ServiceService);
  private providerService = inject(ProviderService);
  private authService = inject(AuthenticationService);
  public cartService = inject(CartService);
  private loadingService = inject(LoadingService);

  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade...');
    
    // Check for preview mode in query params
    const paramsSub = this.route.queryParams.subscribe(params => {
      this.previewMode = params['previewMode'] === 'true';
    });
    this.subscriptions.push(paramsSub);
    
    // Get user ID from route parameter
    const routeSub = this.route.paramMap.subscribe(params => {      
      const userId = params.get('userId');

      if (userId) {
        this.userId = userId;
        
        // Load provider details by userId
        const providerSub = this.providerService.getProvider(userId).subscribe({
          next: provider => {
            this.provider = provider || null; // Convert undefined to null if needed
            console.log('Provider loaded:', provider);
          },
          error: error => {
            console.error('Error loading provider:', error);
            this.loadingService.setLoading(false);
          }
        });
        this.subscriptions.push(providerSub);
      
        // Load services for this provider using getServicesByProvider method
        const serviceSub = this.serviceService.getServicesByProvider(userId).subscribe({
          next: services => {
            this.services = services;
            console.log('Services loaded:', services.length);
            this.loadingService.setLoading(false);
          },
          error: error => {
            console.error('Error loading services:', error);
            this.loadingService.setLoading(false);
          }
        });
        this.subscriptions.push(serviceSub);
        
        // Check if logged-in user is the provider
        const authSub = this.authService.user$.subscribe(user => {
          if (user && userId) {
            this.isOwnProviderPage = user.uid === userId;
            
            if (this.isOwnProviderPage) {
              console.log('Provider viewing their own service list (preview mode)');
            }
          }
        });
        this.subscriptions.push(authSub);
      } else {
        console.error('No userId provided in route');
        this.loadingService.setLoading(false);
        this.router.navigate(['/']); // Redirect to home if no provider ID
      }
    });
    this.subscriptions.push(routeSub);
  }
  
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  addToCart(service: Service): void {    
    if (this.isOwnProviderPage || this.previewMode) {
      alert('Als Anbieter können Sie keine Termine bei sich selbst buchen. Dies ist nur eine Vorschau.');
      return;
    }
    
    // Original add to cart logic
    if (this.cartService.isInCart(service.id)) {
      this.cartService.removeItem(service.id);
    } else {
      this.cartService.addItem(service);
    }    
  }
  
  isInCart(serviceId: string): boolean {
    return this.cartService.isInCart(serviceId);
  }
  
  viewCart(): void {
    if (this.isOwnProviderPage || this.previewMode) {
      alert('Als Anbieter können Sie keine Termine bei sich selbst buchen. Dies ist nur eine Vorschau.');
      return;
    }
    
    // Original view cart logic
    if (this.userId) {
      this.router.navigate(['/appointment-selection', this.userId]);
    }
  }
  
  goBack(): void {
    // Go back to provider page
    if (this.provider && this.provider.businessName) {
      this.router.navigate(['/', this.provider.businessName]);
    } else {
      this.router.navigate(['/']); 
    }
  }
  
  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours} Std. ${remainingMinutes > 0 ? remainingMinutes + ' Min.' : ''}`;
    } else {
      return `${minutes} Min.`;
    }
  }
  
  formatPrice(price: number): string {
    return price.toFixed(2).replace('.', ',') + ' €';
  }
}