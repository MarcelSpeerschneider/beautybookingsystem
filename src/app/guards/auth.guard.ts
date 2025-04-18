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

  // Diese Methode kapselt getDoc-Aufrufe in NgZone
  private getDocInZone(docRef: any): Promise<any> {
    return this.ngZone.run(() => getDoc(docRef));
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      console.log('AuthGuard: Checking access to', state.url);
      
      if (route.data['isPublic']) {
        console.log('AuthGuard: Public route, allowing access');
        this.loadingService.setLoading(false);
        return of(true);
      }
      
      sessionStorage.setItem('redirectUrl', state.url);
      this.loadingService.setLoading(true, 'Überprüfe Authentifizierung...');
      
      const isProviderRoute = state.url.includes('provider-dashboard');
      const authCheck$ = isProviderRoute ? 
        this.checkProviderAccess() : 
        this.checkCustomerAccess();
      
      return authCheck$.pipe(
        tap(canAccess => {
          if (!canAccess) {
            const loginRoute = isProviderRoute ? '/provider-login' : '/customer-login';
            this.router.navigate([loginRoute]);
          }
        }),
        catchError(error => {
          console.error('AuthGuard: Authentication check failed', error);
          this.loadingService.setLoading(false);
          
          const loginRoute = isProviderRoute ? '/provider-login' : '/customer-login';
          this.router.navigate([loginRoute]);
          return of(false);
        })
      );
    }, this.ngZone);
  }
  
  private checkProviderAccess(): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      return this.authService.user$.pipe(
        switchMap(user => {
          if (!user) {
            console.log('AuthGuard: User not logged in, redirecting to provider login');
            this.loadingService.setLoading(false);
            this.router.navigate(['/provider-login']);
            return of(false);
          }
          
          console.log('AuthGuard: Checking provider access for user:', user.uid);
          
          // Einfache Prüfung anhand der Benutzer-ID
          // Wir verwenden weiterhin das Dokument, prüfen aber nur die Rolle
          const userDoc = doc(this.firestore, 'providers', user.uid);
          
          return from(this.getDocInZone(userDoc)).pipe(
            map(docSnapshot => {
              this.loadingService.setLoading(false);
              
              // Prüfen, ob die Rolle 'provider' ist, unabhängig von der Sammlung
              if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                if (data['role'] === 'provider') {
                  console.log('AuthGuard: Provider access confirmed via role check');
                  return true;
                }
              }
              
              // Wenn kein Provider-Dokument gefunden oder Rolle nicht 'provider'
              console.log('AuthGuard: User is not a provider, redirecting to provider login');
              this.router.navigate(['/provider-login']);
              return false;
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
    }, this.ngZone);
  }
  
  private checkCustomerAccess(): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      return this.authService.user$.pipe(
        switchMap(user => {
          if (!user) {
            console.log('AuthGuard: User not logged in, redirecting to login');
            this.loadingService.setLoading(false);
            this.router.navigate(['/customer-login']);
            return of(false);
          }
          
          console.log('AuthGuard: User found with UID:', user.uid);
          
          // Zuerst prüfen, ob Benutzer eine Provider-Rolle hat
          const providerDoc = doc(this.firestore, 'providers', user.uid);
          
          return from(this.getDocInZone(providerDoc)).pipe(
            switchMap(providerDocSnapshot => {
              // Wenn ein Provider-Dokument existiert und die Rolle 'provider' ist
              if (providerDocSnapshot.exists() && providerDocSnapshot.data()['role'] === 'provider') {
                console.log('AuthGuard: Provider trying to access customer route, redirecting');
                this.loadingService.setLoading(false);
                this.router.navigate(['/provider-dashboard']);
                return of(false);
              }
              
              // Dann prüfen, ob Benutzer eine Customer-Rolle hat
              const customerDoc = doc(this.firestore, 'customers', user.uid);
              
              return from(this.getDocInZone(customerDoc)).pipe(
                map(customerDocSnapshot => {
                  this.loadingService.setLoading(false);
                  
                  // Einfache Rollenprüfung
                  if (customerDocSnapshot.exists() && customerDocSnapshot.data()['role'] === 'customer') {
                    console.log("AuthGuard: Customer role confirmed, allowing access");
                    return true;
                  }
                  
                  console.log('AuthGuard: User does not have customer role, redirecting');
                  this.router.navigate(['/customer-login']);
                  return false;
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
    }, this.ngZone);
  }
}