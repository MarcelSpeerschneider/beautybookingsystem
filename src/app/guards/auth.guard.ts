// src/app/guards/auth.guard.ts
import { Injectable, inject, NgZone } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of, from } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AuthenticationService } from '../services/authentication.service';
import { LoadingService } from '../services/loading.service';
import { ZoneUtils } from '../utils/zone-utils';
import { 
  Firestore, 
  doc, 
  getDoc
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

  // This method encapsulates getDoc calls in NgZone
  private getDocInZone(docRef: any): Promise<any> {
    return this.ngZone.run(() => getDoc(docRef));
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      console.log('AuthGuard: Checking access to', state.url);
      
      // WICHTIG: Wenn provider-profile direkt aufgerufen wird, erlaube den Zugriff
      // ohne weitere Umleitungen
      if (state.url.includes('provider-profile')) {
        console.log('AuthGuard: Provider-Profil wird direkt aufgerufen, Zugriff erlaubt');
        this.loadingService.setLoading(false);
        return of(true);
      }
      
      if (route.data['isPublic']) {
        console.log('AuthGuard: Public route, allowing access');
        this.loadingService.setLoading(false);
        return of(true);
      }
      
      sessionStorage.setItem('redirectUrl', state.url);
      this.loadingService.setLoading(true, 'Checking authentication...');
      
      // Use a single unified login route instead of separate routes
      const loginRoute = '/login';
      
      const authCheck$ = this.checkAccess(state.url);
      
      return authCheck$.pipe(
        tap(canAccess => {
          if (!canAccess) {
            this.router.navigate([loginRoute]);
          }
        }),
        catchError(error => {
          console.error('AuthGuard: Authentication check failed', error);
          this.loadingService.setLoading(false);
          
          this.router.navigate([loginRoute]);
          return of(false);
        })
      );
    }, this.ngZone);
  }
  
  private checkAccess(url: string): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      return this.authService.user$.pipe(
        switchMap(user => {
          if (!user) {
            console.log('AuthGuard: User not logged in, redirecting to login');
            this.loadingService.setLoading(false);
            this.router.navigate(['/login']);
            return of(false);
          }
          
          console.log('AuthGuard: Checking access for user:', user.uid);
          
          // Check if the route is provider-specific
          const isProviderRoute = url.includes('provider');
          
          if (isProviderRoute) {
            // Check for provider role
            const userDoc = doc(this.firestore, 'providers', user.uid);
            
            return from(this.getDocInZone(userDoc)).pipe(
              map(docSnapshot => {
                this.loadingService.setLoading(false);
                
                if (docSnapshot.exists()) {
                  const data = docSnapshot.data();
                  if (data['role'] === 'provider') {
                    console.log('AuthGuard: Provider access confirmed via role check');
                    
                    // WICHTIG: KEIN Umleiten von provider-profile zu provider-dashboard
                    // ENTFERNT: if (url.includes('provider-profile')) { ... Umleitung ... }
                    
                    return true;
                  }
                }
                
                console.log('AuthGuard: User is not a provider, redirecting to login');
                this.router.navigate(['/login']);
                return false;
              }),
              catchError(error => {
                console.error('AuthGuard: Error checking provider document', error);
                this.loadingService.setLoading(false);
                this.router.navigate(['/login']);
                return of(false);
              })
            );
          } else {
            // Check for customer role for non-provider routes
            return from(this.checkCustomerAccess(user.uid, url)).pipe(
              catchError(error => {
                console.error('AuthGuard: Error checking customer access', error);
                this.loadingService.setLoading(false);
                this.router.navigate(['/login']);
                return of(false);
              })
            );
          }
        }),
        catchError(error => {
          this.loadingService.setLoading(false);
          console.error('AuthGuard: Auth check failed', error);
          this.router.navigate(['/login']);
          return of(false);
        })
      );
    }, this.ngZone);
  }
  
  private async checkCustomerAccess(userId: string, url: string): Promise<boolean> {
    try {
      // First check if user is a provider
      const providerDoc = doc(this.firestore, 'providers', userId);
      const providerSnapshot = await this.getDocInZone(providerDoc);
      
      if (providerSnapshot.exists() && providerSnapshot.data()['role'] === 'provider') {
        console.log('AuthGuard: Provider trying to access customer route, redirecting');
        this.loadingService.setLoading(false);
        
        // WICHTIG: Wenn die URL provider-profile enthält, erlaube direkten Zugriff
        if (url.includes('provider-profile')) {
          console.log('AuthGuard: Allowing provider access to profile');
          return true;
        }
        
        this.router.navigate(['/provider-dashboard']);
        return false;
      }
      
      // Then check if user is a customer
      const customerDoc = doc(this.firestore, 'customers', userId);
      const customerSnapshot = await this.getDocInZone(customerDoc);
      
      this.loadingService.setLoading(false);
      
      if (customerSnapshot.exists() && customerSnapshot.data()['role'] === 'customer') {
        console.log("AuthGuard: Customer role confirmed, allowing access");
        return true;
      }
      
      console.log('AuthGuard: User does not have customer role, redirecting');
      this.router.navigate(['/login']);
      return false;
    } catch (error) {
      console.error('AuthGuard: Error checking customer access', error);
      throw error;
    }
  }
}