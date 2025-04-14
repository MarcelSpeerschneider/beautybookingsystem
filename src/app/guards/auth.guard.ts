import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { tap, catchError, timeout } from 'rxjs/operators';
import { AuthenticationService } from '../services/authentication.service';
import { LoadingService } from '../services/loading.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthenticationService);
  private router = inject(Router);
  private loadingService = inject(LoadingService);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    console.log('AuthGuard: Checking access to', state.url);
    
    // URL für spätere Weiterleitung speichern
    sessionStorage.setItem('redirectUrl', state.url);
    
    // Zeige Ladeanimation
    this.loadingService.setLoading(true, 'Überprüfe Authentifizierung...');
    
    return this.authService.isUserWithCustomerReady().pipe(
      timeout(5000), // Reasonable timeout
      tap(isReady => {
        this.loadingService.setLoading(false);
        console.log('AuthGuard: User with Customer is ready?', isReady);
        
        if (!isReady) {
          console.log('AuthGuard: User/Customer not ready, redirecting to login');
          // Only redirect to login if we're not already in the booking flow
          if (!state.url.startsWith('/booking')) {
            this.router.navigate(['/login']);
          } else {
            // For booking pages, we want to redirect to the appropriate previous step
            if (state.url === '/booking-overview') {
              const providerId = sessionStorage.getItem('providerId');
              this.router.navigate(['/appointment-selection', providerId || '']);
            } else if (state.url === '/booking-confirmation') {
              this.router.navigate(['/booking-overview']);
            }
          }
        }
      }),
      catchError(error => {
        this.loadingService.setLoading(false);
        console.log('AuthGuard: Error or timeout', error);
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}