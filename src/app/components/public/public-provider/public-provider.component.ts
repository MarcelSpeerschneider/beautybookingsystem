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
  providerUserId: string = ''; // Speichert die Provider-ID
  businessName: string | null = null;
  isLoggedIn = false;
  isOwnProviderPage: boolean = false; // Zeigt an, ob der angemeldete User seine eigene Provider-Seite ansieht
  
  private subscriptions: Subscription[] = [];
  
  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Dienstleister...');
    
    // Warenkorb leeren, wenn ein neuer Buchungsablauf beginnt
    this.cartService.clearCart();
    
    // Auch Datum/Zeit-Auswahl aus dem Session Storage löschen
    sessionStorage.removeItem('selectedDate');
    sessionStorage.removeItem('selectedTime');
    
    // Business-Namen aus dem Routen-Parameter holen
    const routeSub = this.route.paramMap.subscribe(params => {
      this.businessName = params.get('businessName');
      
      if (this.businessName) {
        // Provider anhand des Business-Namens finden
        this.findProviderByBusinessName(this.businessName);
      } else {
        this.loadingService.setLoading(false);
      }   
    });
    
    this.subscriptions.push(routeSub);
    
    // Prüfen, ob User angemeldet ist
    const authSub = this.authService.isLoggedIn().subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
    });
    
    this.subscriptions.push(authSub);
  }
  
  ngOnDestroy(): void {
    // Alle Subscriptions beenden
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  findProviderByBusinessName(businessName: string): void {
    console.log('Suche nach Provider:', businessName);
    
    const providersSub = this.providerService.getProviders().subscribe(providers => {
      console.log('Gefundene Provider:', providers);
      
      // Provider mit passendem Business-Namen finden (case-insensitive)
      const provider = providers.find(p => {
        console.log('Vergleiche:', p.businessName.toLowerCase(), '==', businessName.toLowerCase());
        return p.businessName.toLowerCase() === businessName.toLowerCase();
      });
      
      if (provider) {
        console.log('Provider gefunden:', provider);
        this.provider = provider;
        
        // Die ID extrahieren - wir benötigen ein explizites Casting, da der normale Provider-Typ 
        // möglicherweise keine id-Eigenschaft hat
        const providerAny = provider as any;
        
        // Prüfen, welches ID-Feld vorhanden ist
        if (providerAny.id && typeof providerAny.id === 'string') {
          this.providerUserId = providerAny.id;
        } else if (providerAny.providerId && typeof providerAny.providerId === 'string') {
          this.providerUserId = providerAny.providerId;
        } else {
          // Wenn keine ID gefunden wurde, Fehler loggen
          console.error('Keine Provider-ID gefunden', provider);
          this.providerUserId = '';
        }
        
        if (this.providerUserId) {
          console.log('Provider-ID gefunden:', this.providerUserId);
          this.cartService.setProviderId(this.providerUserId);
          
          // Prüfen, ob der angemeldete User der Provider dieser Seite ist
          const userSub = this.authService.user$.subscribe(user => {
            if (user) {
              this.isOwnProviderPage = user.uid === this.providerUserId;
              console.log('Is own provider page:', this.isOwnProviderPage);
            }
          });
          this.subscriptions.push(userSub);
        }
      } else {
        console.log('Provider nicht gefunden');
      }
      
      this.loadingService.setLoading(false);
    });
    this.subscriptions.push(providersSub);
  }
  
  viewServices(): void {
    if (this.isOwnProviderPage) {
      // Meldung, dass Provider keine Termine bei sich selbst buchen können
      alert('Als Anbieter können Sie keine Termine bei sich selbst buchen. Dies ist nur eine Vorschau Ihrer Buchungsseite.');
      
      // Trotzdem Navigation zu Dienstleistungen im Vorschau-Modus erlauben
      if (this.providerUserId) {
        this.router.navigate(['/services', this.providerUserId], { queryParams: { previewMode: 'true' } });
      }
      return;
    }
    
    // Normale Navigation für Kunden
    if (this.providerUserId) {
      this.router.navigate(['/services', this.providerUserId]);
    } else { 
      console.error('Provider-ID nicht gesetzt'); 
    }
  }
  
  login(): void {
    this.router.navigate(['/customer-login']);
  }
}