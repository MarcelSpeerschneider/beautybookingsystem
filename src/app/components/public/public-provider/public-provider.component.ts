import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProviderService } from '../../../services/provider.service';
import { Provider } from '../../../models/provider.model';
import { Subscription } from 'rxjs';
import { LoadingService } from '../../../services/loading.service';
import { CartService } from '../../../services/cart.service';
import { AuthenticationService } from '../../../services/authentication.service';

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
  private providerService = inject(ProviderService);
  private loadingService = inject(LoadingService);
  private cartService = inject(CartService);
  public authService = inject(AuthenticationService);
  
  provider: Provider | null = null;
  businessName: string | null = null;
  isLoggedIn = false;
  
  private subscriptions: Subscription[] = [];
  
  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Dienstleister...');
    
    // Clear any existing cart when starting a new booking flow
    this.cartService.clearCart();
    
    // Also clear date/time selection from session storage
    sessionStorage.removeItem('selectedDate');
    sessionStorage.removeItem('selectedTime');
    
    // Get the business name from the route parameter
    const routeSub = this.route.paramMap.subscribe(params => {
      this.businessName = params.get('businessName');
      
      if (this.businessName) {
        // Find provider by business name
        this.findProviderByBusinessName(this.businessName);
      } else {
        this.loadingService.setLoading(false);
      }   
    });
    
    this.subscriptions.push(routeSub);
    
    // Check if user is logged in
    const authSub = this.authService.isLoggedIn().subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
    });
    
    this.subscriptions.push(authSub);
  }
  
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  findProviderByBusinessName(businessName: string): void {
    console.log('Suche nach Provider:', businessName);
    
    const providersSub = this.providerService.getProviders().subscribe(providers => {
      console.log('Gefundene Provider:', providers);
      
      // Find provider with matching business name, case insensitive
      const provider = providers.find(p => {
        console.log('Vergleiche:', p.businessName.toLowerCase(), '==', businessName.toLowerCase());
          return p.businessName.toLowerCase() === businessName.toLowerCase();
        });
      
      if (provider) {
        console.log('Provider gefunden:', provider);
        this.provider = provider;
        this.cartService.setProviderId(provider.userId)
      } else {
        console.log('Provider nicht gefunden');
      }
      
      this.loadingService.setLoading(false);
    });
    this.subscriptions.push(providersSub);
  }
  
  viewServices(): void {
     if (this.provider && this.provider.userId) {
      this.router.navigate(['/services', this.provider.userId]);
    } else { console.error('Provider not set') }
  }
  
  login(): void {
    this.router.navigate(['/customer-login']);
  }
}