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
  providerId: string | null = null;
  provider: Provider | null = null;
  services: Service[] = [];
  
  private subscriptions: Subscription[] = [];
  
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private serviceService = inject(ServiceService);
  private providerService = inject(ProviderService);
  public cartService = inject(CartService);
  private loadingService = inject(LoadingService);

  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Dienstleistungen...');
    
    // Get provider ID from route parameter
    const routeSub = this.route.paramMap.subscribe(params => {
      this.providerId = params.get('providerId');
      
      if (this.providerId) {
        // Load provider details
        this.loadProvider(this.providerId);
        
        // Load services for this provider
        this.loadServices(this.providerId);
      } else {
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
  
  loadProvider(providerId: string): void {
    const providerSub = this.providerService.getProvider(providerId)
      .subscribe(provider => {
        this.provider = provider || null;
        this.loadingService.setLoading(false);
      });
      
    this.subscriptions.push(providerSub);
  }
  
  loadServices(providerId: string): void {
    const servicesSub = this.serviceService.getServicesByProvider(providerId)
      .subscribe(services => {
        this.services = services;
      });
      
    this.subscriptions.push(servicesSub);
  }
  
  addToCart(service: Service): void {
    this.cartService.addItem(service);
    alert(`${service.name} wurde zum Warenkorb hinzugefügt.`);
  }
  
  isInCart(serviceId: string): boolean {
    return this.cartService.isInCart(serviceId);
  }
  
  viewCart(): void {
    if (this.providerId) {
      this.router.navigate(['/appointment-selection', this.providerId]);
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