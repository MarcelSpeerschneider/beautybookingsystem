import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthenticationService } from './services/authentication.service';
import { filter, switchMap } from 'rxjs/operators';
import { LoadingComponent } from './components/loading/loading.component';
import { CommonModule } from '@angular/common';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { from, of } from 'rxjs';
import { HeaderComponent } from './components/shared/header/header.component';
import { FooterComponent } from './components/shared/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoadingComponent, CommonModule, HeaderComponent, FooterComponent],
  template: `
    <app-loading></app-loading>
    <app-header></app-header>
    <router-outlet></router-outlet>
    <app-footer></app-footer>
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
    // Auth-Zustand überwachen
    this.authService.user.subscribe(userWithCustomer => {
      // Nach erfolgreicher Authentifizierung prüfen, ob wir eine Weiterleitungs-URL haben
      if (userWithCustomer.user) {
        // Speichere die aktuelle URL, um sie später zu vergleichen
        const currentUrl = this.router.url;
        console.log('Current URL:', currentUrl);
        
        // Prüfen, ob wir im Buchungsflow sind und ob die URL das Flag 'from=booking-login' enthält
        if (currentUrl.includes('from=booking-login')) {
          console.log('User kam vom Buchungsflow, keine Umleitung zu customer-profile');
          // Keine Umleitung zu customer-profile durchführen
          return;
        }

        // Überprüfe, ob der localStorage-Flag für den Buchungsflow gesetzt ist
        const bookingFlow = localStorage.getItem('bookingFlow');
        if (bookingFlow === 'active' && currentUrl.includes('booking-overview')) {
          console.log('Buchungsflow ist aktiv, keine Umleitung zu customer-profile');
          // Wenn im Buchungsflow und auf booking-overview, keine Umleitung durchführen
          return;
        }
        
        // Hier kommt der Rest Ihrer Weiterleitungslogik
        // ... Bestehender Code für Weiterleitungen
      }
    });
    
    // Router-Events überwachen
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Wenn die Navigation zu booking-overview abgeschlossen ist und das Flag in der URL hat,
      // entfernen wir das Flag aus der URL, behalten aber die Seite bei
      if (event.url.includes('booking-overview') && event.url.includes('from=booking-login')) {
        // Nach kurzer Verzögerung die URL bereinigen, ohne eine neue Navigation auszulösen
        setTimeout(() => {
          this.router.navigate(['/booking-overview'], { replaceUrl: true });
        }, 100);
      }
      
      // Wenn die Navigation zu booking-confirmation abgeschlossen ist,
      // setzen wir den Buchungsflow zurück
      if (event.url.includes('booking-confirmation')) {
        localStorage.removeItem('bookingFlow');
      }
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
        'booking-overview', 'booking-confirmation', 'provider-profile'
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