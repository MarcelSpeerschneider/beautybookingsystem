import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, Observable, of } from 'rxjs';
import { ServiceService } from '../../../services/service.service';
import { ProviderService } from '../../../services/provider.service';
import { CartService } from '../../../services/cart.service';
import { Service } from '../../../models/service.model';
import { Provider } from '../../../models/provider.model';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-public-service-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-service-list.component.html', 
  styleUrls: ['./public-service-list.component.css']
})
export class PublicServiceListComponent implements OnInit, OnDestroy {
  
  provider: Provider | null = null;
  userId: string = '';
  services: Service[] = [];
  
  private subscriptions: Subscription[] = [];
  
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serviceService = inject(ServiceService);
  private providerService = inject(ProviderService);
  public cartService = inject(CartService);
  private loadingService = inject(LoadingService);

  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade...');
    
    // Get user ID from route parameter
    const routeSub = this.route.paramMap.subscribe(params => {      
      const userId = params.get('userId');

      if (userId) {
        this.userId = userId;
        
        // Load provider details by userId
        this.providerService.getProviderByUserId(userId).subscribe(provider => {
          this.provider = provider;
        });
      
        // Load services for this provider
        this.serviceService.getServicesByUser(userId).subscribe(services => {
          this.services = services;
          this.loadingService.setLoading(false); // Set loading to false after fetching services
        });
      } else {
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
    if (this.cartService.isInCart(service.id)) {
      // Remove the service from the cart
      this.cartService.removeItem(service.id);
    } else {
      // Add the service to the cart
      this.cartService.addItem(service);
    }
  }
  
  isInCart(serviceId: string): boolean {
    return this.cartService.isInCart(serviceId);
  }
  
  viewCart(): void {
    if (this.userId) {
      this.router.navigate(['/appointment-selection', this.userId]);
    }
  }
  
  goBack(): void {
    // Go back to provider page
    if (this.provider) {
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