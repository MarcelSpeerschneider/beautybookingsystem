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

/**
 * RoleGuard - Schützt Routen basierend auf Benutzerrollen
 */
@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  private authService = inject(AuthenticationService);
  private router = inject(Router);
  private loadingService = inject(LoadingService);
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone); // NgZone injizieren

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Holt die erlaubten Rollen aus den Routendaten
    const allowedRoles = route.data['roles'] as string[];
    
    if (!allowedRoles || allowedRoles.length === 0) {
      console.warn('RoleGuard: Keine Rollen definiert für Route', state.url);
      return of(true); // Ohne definierte Rollen wird Zugriff erlaubt
    }
    
    this.loadingService.setLoading(true, 'Überprüfe Berechtigungen...');
    
    return this.authService.user$.pipe(
      switchMap(user => {
        if (!user) {
          console.log('RoleGuard: Benutzer nicht angemeldet');
          this.loadingService.setLoading(false);
          this.router.navigate(['/customer-login']);
          return of(false);
        }
        
        // Speichert die Weiterleitungs-URL für nach dem Login
        sessionStorage.setItem('redirectUrl', state.url);
        
        return this.checkUserRoles(user.uid, allowedRoles);
      }),
      tap(hasAccess => {
        if (!hasAccess) {
          // Je nach fehlender Rolle zur entsprechenden Seite weiterleiten
          if (allowedRoles.includes('provider')) {
            this.router.navigate(['/provider-login']);
          } else {
            this.router.navigate(['/customer-login']);
          }
        }
      }),
      catchError(error => {
        console.error('RoleGuard: Fehler bei der Berechtigungsprüfung', error);
        this.loadingService.setLoading(false);
        this.router.navigate(['/customer-login']);
        return of(false);
      })
    );
  }
  
  /**
   * Prüft, ob der Benutzer eine der erlaubten Rollen hat
   */
  private checkUserRoles(userId: string, allowedRoles: string[]): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      // Strategien für Rollenprüfung: Zuerst Provider prüfen, dann Customer
      if (allowedRoles.includes('provider')) {
        return from(getDoc(doc(this.firestore, 'providers', userId))).pipe(
          map(providerSnapshot => {
            if (providerSnapshot.exists()) {
              const data = providerSnapshot.data();
              // Index-Notation verwenden
              const hasProviderRole = data['role'] === 'provider';
              
              this.loadingService.setLoading(false);
              console.log(`RoleGuard: Benutzer hat ${hasProviderRole ? '' : 'keine'} Provider-Rolle`);
              return hasProviderRole;
            }
            return false;
          }),
          catchError(error => {
            console.error('Fehler bei der Provider-Rollenprüfung:', error);
            this.loadingService.setLoading(false);
            return of(false);
          })
        );
      }
      
      if (allowedRoles.includes('customer')) {
        return from(getDoc(doc(this.firestore, 'customers', userId))).pipe(
          map(customerSnapshot => {
            if (customerSnapshot.exists()) {
              const data = customerSnapshot.data();
              // Index-Notation verwenden
              const hasCustomerRole = data['role'] === 'customer';
              
              this.loadingService.setLoading(false);
              console.log(`RoleGuard: Benutzer hat ${hasCustomerRole ? '' : 'keine'} Kunden-Rolle`);
              return hasCustomerRole;
            }
            return false;
          }),
          catchError(error => {
            console.error('Fehler bei der Kunden-Rollenprüfung:', error);
            this.loadingService.setLoading(false);
            return of(false);
          })
        );
      }
      
      // Wenn keine der Rollen geprüft wurde
      this.loadingService.setLoading(false);
      return of(false);
    }, this.ngZone); // NgZone als zweiter Parameter
  }
}