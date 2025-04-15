import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { tap, catchError, timeout, map } from 'rxjs/operators';
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
    
    // Check if the route is marked as public
    if (route.data['isPublic']) {
      console.log('AuthGuard: Public route, allowing access');
      this.loadingService.setLoading(false);
      return of(true);
    }
    
    // URL für spätere Weiterleitung speichern
    sessionStorage.setItem('redirectUrl', state.url);
    
    // Zeige Ladeanimation
    this.loadingService.setLoading(true, 'Überprüfe Authentifizierung...');
    
    // Check if this is a provider route
    const isProviderRoute = state.url.includes('provider-dashboard');
    
    if (isProviderRoute) {
      // For provider routes, check if user is logged in and has provider role
      return this.authService.user$.pipe(
        timeout(5000),
        map(user => {
          this.loadingService.setLoading(false);
          
          if (!user) {
            console.log('AuthGuard: User not logged in, redirecting to provider login');
            this.router.navigate(['/provider-login']);
            return false;
          }
          
          // Check if user is a provider
          const userRole = localStorage.getItem(`user_role_${user.uid}`);
          const isProvider = userRole === 'provider';
          
          if (!isProvider) {
            console.log('AuthGuard: User is not a provider, redirecting to provider login');
            this.router.navigate(['/provider-login']);
            return false;
          }
          
          return true;
        }),
        catchError(error => {
          this.loadingService.setLoading(false);
          console.log('AuthGuard: Error or timeout', error);
          this.router.navigate(['/provider-login']);
          return of(false);
        })
      );
    } else {
      // For customer routes that actually require customer data
      return this.authService.user.pipe(
        timeout(5000),
        map(userWithCustomer => {
          this.loadingService.setLoading(false);
          
          // First check if user is logged in at all
          if (!userWithCustomer.user) {
            console.log('AuthGuard: User not logged in, redirecting to login');
            this.router.navigate(['/customer-login']);
            return false;
          }
          
          // Check if this is a provider trying to access customer routes
          const userRole = localStorage.getItem(`user_role_${userWithCustomer.user.uid}`);
          if (userRole === 'provider') {
            console.log('AuthGuard: Provider trying to access customer route, redirecting to provider dashboard');
            this.router.navigate(['/provider-dashboard']);
            return false;
          }
          
          // For customers, we need the customer data
          if (!userWithCustomer.customer) {
            console.log('AuthGuard: Customer data not found, redirecting to login');
            this.router.navigate(['/customer-login']);
            return false;
          }
          
          return true;
        }),
        catchError(error => {
          this.loadingService.setLoading(false);
          console.log('AuthGuard: Error or timeout', error);
          this.router.navigate(['/customer-login']);
          return of(false);
        })
      );
    }
  }
}