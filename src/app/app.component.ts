import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthenticationService } from './services/authentication.service';
import { filter, switchMap } from 'rxjs/operators';
import { LoadingComponent } from './components/loading/loading.component';
import { CommonModule } from '@angular/common';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { from, of } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoadingComponent, CommonModule],
  template: `
    <app-loading></app-loading>
    <router-outlet></router-outlet>
  `,
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Beauty Booking System';
  
  private firestore = inject(Firestore);
  
  constructor(
    private authService: AuthenticationService,
    private router: Router
  ) {}
  
  ngOnInit() {
    // Auth-Zustand überwachen und in der Konsole protokollieren
    this.authService.user.subscribe(userWithCustomer => {
      console.log('App Component user', userWithCustomer.user ? 'Logged in' : 'Logged out');
      
      // Nach erfolgreicher Authentifizierung prüfen, ob wir eine Weiterleitungs-URL haben
      if (userWithCustomer.user) {
        const redirectUrl = sessionStorage.getItem('redirectUrl');
        
        if (redirectUrl) {
          console.log('Potential redirect URL:', redirectUrl);
          console.log('Debug - current URL:', this.router.url);
          
          // Don't redirect to public routes like /:businessName
          if (this.isPublicRoute(redirectUrl)) {
            console.log('Not redirecting to public route:', redirectUrl);
            sessionStorage.removeItem('redirectUrl');
            return;
          }
          
          // Get current URL to see if we're on a public page
          const currentUrl = this.router.url;
          if (this.isPublicRoute(currentUrl)) {
            console.log('Currently on a public page, not redirecting');
            sessionStorage.removeItem('redirectUrl');
            return;
          }
          
          console.log('User fully authenticated, redirecting to:', redirectUrl);
          
          // Verwende Firestore-basierte Rollenprüfung anstelle von localStorage
          const userId = userWithCustomer.user.uid;
          
          // Überprüfe, ob der Benutzer ein Provider ist
          const providerDoc = doc(this.firestore, 'providers', userId);
          
          from(getDoc(providerDoc)).pipe(
            switchMap(providerSnapshot => {
              const isProvider = providerSnapshot.exists();
              console.log('Debug - Provider check:', isProvider ? 'Is Provider' : 'Not a Provider');
              
              if (isProvider && redirectUrl.includes('provider-dashboard')) {
                // Provider accessing provider dashboard - allow
                this.router.navigateByUrl(redirectUrl);
                sessionStorage.removeItem('redirectUrl');
                return of(true);
              } 
              else if (!isProvider && redirectUrl.includes('provider-dashboard')) {
                // Customer trying to access provider dashboard - redirect to customer profile
                console.log('Customer trying to access provider route, redirecting to customer profile');
                this.router.navigate(['/customer-profile']);
                sessionStorage.removeItem('redirectUrl');
                return of(true);
              }
              else if (!isProvider) {
                // Check if customer document exists
                const customerDoc = doc(this.firestore, 'customers', userId);
                return from(getDoc(customerDoc)).pipe(
                  switchMap(customerSnapshot => {
                    console.log('Debug - Customer check:', customerSnapshot.exists() ? 'Customer document exists' : 'No customer document');
                    
                    if (customerSnapshot.exists() || userWithCustomer.customer) {
                      // Customer with customer data - allow normal redirect
                      console.log('Customer with data, proceeding with redirect to:', redirectUrl);
                      this.router.navigateByUrl(redirectUrl);
                      sessionStorage.removeItem('redirectUrl');
                      return of(true);
                    } else {
                      // No customer document found
                      console.log('No customer document exists, clearing redirect');
                      sessionStorage.removeItem('redirectUrl');
                      return of(false);
                    }
                  })
                );
              }
              
              // Handle other cases
              console.log('Redirect not applicable, clearing');
              sessionStorage.removeItem('redirectUrl');
              return of(false);
            })
          ).subscribe();
        }
      }
    });
    
    // Router-Events überwachen, um Fehler bei der Navigation zu erkennen
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      console.log('Navigation completed to:', event.url);
    });
  }
  
  // Helper method to identify public routes
  private isPublicRoute(url: string): boolean {
    // Remove leading slash if present
    if (url.startsWith('/')) {
      url = url.substring(1);
    }
    
    // Split into segments and filter out empty ones
    const segments = url.split('/').filter(segment => segment);
    
    // If there's just one segment, it might be a business name
    if (segments.length === 1) {
      // Known application routes to exclude
      const knownRoutes = [
        'customer-login', 'customer-register', 'provider-login', 
        'provider-dashboard', 'customer-profile', 'customer-booking',
        'services', 'appointment-selection', 'booking-login',
        'booking-overview', 'booking-confirmation'
      ];
      
      // If not a known route, it's likely a business name
      return !knownRoutes.includes(segments[0]);
    }
    
    // Also check for service and appointment-selection routes with a userId
    if (segments.length === 2) {
      if ((segments[0] === 'services' || segments[0] === 'appointment-selection') && segments[1]) {
        return true; // These are also public routes
      }
    }
    
    return false;
  }
}