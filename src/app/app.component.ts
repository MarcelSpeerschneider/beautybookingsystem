import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthenticationService } from './services/authentication.service';
import { filter } from 'rxjs/operators';
import { LoadingComponent } from './components/loading/loading.component';
import { CommonModule } from '@angular/common'; 

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
  
  constructor(
    private authService: AuthenticationService,
    private router: Router
  ) {}
  
  ngOnInit() {
    // Auth-Zustand überwachen und in der Konsole protokollieren
    this.authService.user.subscribe(userWithCustomer => {
      console.log('App Component user', userWithCustomer.user ? 'Logged in' : 'Logged out');
      
      // Nach erfolgreicher Authentifizierung prüfen, ob wir eine Weiterleitungs-URL haben
      if (userWithCustomer.user && userWithCustomer.customer) {
        const redirectUrl = sessionStorage.getItem('redirectUrl');
        if (redirectUrl) {
          console.log('User fully authenticated, redirecting to:', redirectUrl);
          
          // Kleine Verzögerung, um sicherzustellen, dass alle Daten geladen sind
          setTimeout(() => {
            this.router.navigateByUrl(redirectUrl);
            sessionStorage.removeItem('redirectUrl');
          }, 100);
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
}