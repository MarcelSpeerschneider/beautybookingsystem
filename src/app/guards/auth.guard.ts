import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of, from } from 'rxjs';
import { catchError, timeout, map, switchMap } from 'rxjs/operators';
import { AuthenticationService } from '../services/authentication.service';
import { LoadingService } from '../services/loading.service';
import { 
  Firestore, 
  doc, 
  getDoc,
  collection, 
  query, 
  where, 
  getDocs
} from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthenticationService);
  private router = inject(Router);
  private loadingService = inject(LoadingService);
  private firestore = inject(Firestore);

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
        switchMap(user => {
          if (!user) {
            console.log('AuthGuard: User not logged in, redirecting to provider login');
            this.loadingService.setLoading(false);
            this.router.navigate(['/provider-login']);
            return of(false);
          }
          
          // Check if user is a provider by looking for a document in the providers collection
          const providerDoc = doc(this.firestore, 'providers', user.uid);
          
          return from(getDoc(providerDoc)).pipe(
            map(docSnapshot => {
              this.loadingService.setLoading(false);
              
              if (!docSnapshot.exists()) {
                console.log('AuthGuard: User is not a provider, redirecting to provider login');
                this.router.navigate(['/provider-login']);
                return false;
              }
              
              return true;
            })
          );
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
      return this.authService.user$.pipe(
        timeout(5000),
        switchMap(user => {
          if (!user) {
            console.log('AuthGuard: User not logged in, redirecting to login');
            this.loadingService.setLoading(false);
            this.router.navigate(['/customer-login']);
            return of(false);
          }
          
          console.log('AuthGuard: User found with UID:', user.uid);
          
          // First check if the user is a provider
          const providerDoc = doc(this.firestore, 'providers', user.uid);
          
          return from(getDoc(providerDoc)).pipe(
            switchMap(providerDocSnapshot => {
              console.log('AuthGuard: Provider check - document exists?', providerDocSnapshot.exists());
              
              // If user is a provider, redirect to provider dashboard
              if (providerDocSnapshot.exists()) {
                console.log('AuthGuard: Provider trying to access customer route, redirecting to provider dashboard');
                this.loadingService.setLoading(false);
                this.router.navigate(['/provider-dashboard']);
                return of(false);
              }
              
              // Now check if customer data exists
              const customerDoc = doc(this.firestore, 'customers', user.uid);
              console.log('AuthGuard: Checking customer document path:', customerDoc.path);
              
              return from(getDoc(customerDoc)).pipe(
                map(customerDocSnapshot => {
                  this.loadingService.setLoading(false);
                  
                  console.log("AuthGuard: Customer doc exists?", customerDocSnapshot.exists());
                  console.log("AuthGuard: Customer doc path:", customerDoc.path);
                  
                  if (customerDocSnapshot.exists()) {
                    console.log("AuthGuard: Customer doc data:", customerDocSnapshot.data());
                  }
                  
                  if (!customerDocSnapshot.exists()) {
                    console.log('AuthGuard: Customer data not found, redirecting to login');
                    this.router.navigate(['/customer-login']);
                    return false;
                  }
                  
                  console.log('AuthGuard: Customer data found, allowing access');
                  return true;
                })
              );
            })
          );
        }),
        catchError(error => {
          this.loadingService.setLoading(false);
          console.log('AuthGuard: Error or timeout', error);
          console.error('AuthGuard Detailed Error:', error);
          this.router.navigate(['/customer-login']);
          return of(false);
        })
      );
    }
  }
}