import { Injectable, inject, NgZone } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of, from, throwError } from 'rxjs';
import { catchError, timeout, map, switchMap, tap } from 'rxjs/operators';
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
  private ngZone = inject(NgZone);

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
    
    // Create the auth check observable inside NgZone to ensure proper zone handling
    return new Observable<boolean>(observer => {
      this.ngZone.run(() => {
        // Handle auth checking based on route type
        const authCheck$ = isProviderRoute ? 
          this.checkProviderAccess() : 
          this.checkCustomerAccess();
        
        // Subscribe to the auth check and handle the result within NgZone
        authCheck$.subscribe({
          next: (canAccess) => {
            this.ngZone.run(() => {
              observer.next(canAccess);
              observer.complete();
            });
          },
          error: (error) => {
            this.ngZone.run(() => {
              console.error('AuthGuard: Authentication check failed', error);
              this.loadingService.setLoading(false);
              observer.next(false);
              observer.complete();
              
              // Navigate to appropriate login page
              const loginRoute = isProviderRoute ? '/provider-login' : '/customer-login';
              this.router.navigate([loginRoute]);
            });
          }
        });
      });
    });
  }
  
  /**
   * Check if the current user can access provider routes
   */
  private checkProviderAccess(): Observable<boolean> {
    return this.authService.user$.pipe(
      timeout(5000),
      switchMap(user => {
        if (!user) {
          console.log('AuthGuard: User not logged in, redirecting to provider login');
          this.loadingService.setLoading(false);
          this.router.navigate(['/provider-login']);
          return of(false);
        }
        
        console.log('AuthGuard: Checking provider access for user:', user.uid);
        
        // Explicitly run Firebase operation in NgZone
        return from(this.ngZone.run(() => getDoc(doc(this.firestore, 'providers', user.uid)))).pipe(
          map(docSnapshot => {
            this.loadingService.setLoading(false);
            
            if (!docSnapshot.exists()) {
              console.log('AuthGuard: User is not a provider, redirecting to provider login');
              this.router.navigate(['/provider-login']);
              return false;
            }
            
            console.log('AuthGuard: Provider access confirmed');
            return true;
          }),
          catchError(error => {
            console.error('AuthGuard: Error checking provider document', error);
            this.loadingService.setLoading(false);
            this.router.navigate(['/provider-login']);
            return of(false);
          })
        );
      }),
      catchError(error => {
        this.loadingService.setLoading(false);
        console.error('AuthGuard: Provider auth check failed', error);
        this.router.navigate(['/provider-login']);
        return of(false);
      })
    );
  }
  
  /**
   * Check if the current user can access customer routes
   */
  private checkCustomerAccess(): Observable<boolean> {
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
        
        // First check if the user is a provider - run in NgZone
        return from(this.ngZone.run(() => getDoc(doc(this.firestore, 'providers', user.uid)))).pipe(
          switchMap(providerDocSnapshot => {
            console.log('AuthGuard: Provider check - document exists?', providerDocSnapshot.exists());
            
            // If user is a provider, redirect to provider dashboard
            if (providerDocSnapshot.exists()) {
              console.log('AuthGuard: Provider trying to access customer route, redirecting to provider dashboard');
              this.loadingService.setLoading(false);
              this.router.navigate(['/provider-dashboard']);
              return of(false);
            }
            
            // Now check if customer data exists - run in NgZone
            const customerDoc = doc(this.firestore, 'customers', user.uid);
            console.log('AuthGuard: Checking customer document path:', customerDoc.path);
            
            return from(this.ngZone.run(() => getDoc(customerDoc))).pipe(
              tap(snapshot => console.log('AuthGuard: Customer document fetch result:', snapshot.exists())),
              map(customerDocSnapshot => {
                this.loadingService.setLoading(false);
                
                console.log("AuthGuard: Customer doc exists?", customerDocSnapshot.exists());
                
                if (customerDocSnapshot.exists()) {
                  console.log("AuthGuard: Customer data found, allowing access");
                  return true;
                } else {
                  console.log('AuthGuard: Customer data not found, redirecting to login');
                  this.router.navigate(['/customer-login']);
                  return false;
                }
              }),
              catchError(error => {
                console.error('AuthGuard: Error checking customer document', error);
                this.loadingService.setLoading(false);
                this.router.navigate(['/customer-login']);
                return of(false);
              })
            );
          }),
          catchError(error => {
            console.error('AuthGuard: Error checking provider status', error);
            this.loadingService.setLoading(false);
            this.router.navigate(['/customer-login']);
            return of(false);
          })
        );
      }),
      catchError(error => {
        this.loadingService.setLoading(false);
        console.error('AuthGuard: Customer auth check failed', error);
        this.router.navigate(['/customer-login']);
        return of(false);
      })
    );
  }
}