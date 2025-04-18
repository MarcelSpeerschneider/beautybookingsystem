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
 * Vereinfachte Version, die nur die role-Eigenschaft prüft
 */
@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  private authService = inject(AuthenticationService);
  private router = inject(Router);
  private loadingService = inject(LoadingService);
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);

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
        
        return this.checkUserRole(user.uid, allowedRoles);
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
   * Vereinfachte Version, die nur die role-Eigenschaft prüft
   */
  private checkUserRole(userId: string, allowedRoles: string[]): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      console.log('RoleGuard: Prüfe Benutzerrolle für', userId);
      
      // Zuerst prüfen wir, ob der Benutzer eine Provider-Rolle haben soll
      if (allowedRoles.includes('provider')) {
        const providerDoc = doc(this.firestore, 'providers', userId);
        
        return from(this.ngZone.run(() => getDoc(providerDoc))).pipe(
          map(docSnapshot => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data();
              const hasRole = data['role'] === 'provider';
              
              this.loadingService.setLoading(false);
              console.log(`RoleGuard: Benutzer hat ${hasRole ? '' : 'keine'} Provider-Rolle`);
              return hasRole;
            }
            this.loadingService.setLoading(false);
            return false;
          }),
          catchError(error => {
            console.error('RoleGuard: Fehler bei der Provider-Rollenprüfung:', error);
            this.loadingService.setLoading(false);
            return of(false);
          })
        );
      }
      
      // Dann prüfen wir, ob der Benutzer eine Customer-Rolle haben soll
      if (allowedRoles.includes('customer')) {
        const customerDoc = doc(this.firestore, 'customers', userId);
        
        return from(this.ngZone.run(() => getDoc(customerDoc))).pipe(
          map(docSnapshot => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data();
              const hasRole = data['role'] === 'customer';
              
              this.loadingService.setLoading(false);
              console.log(`RoleGuard: Benutzer hat ${hasRole ? '' : 'keine'} Kunden-Rolle`);
              return hasRole;
            }
            this.loadingService.setLoading(false);
            return false;
          }),
          catchError(error => {
            console.error('RoleGuard: Fehler bei der Kunden-Rollenprüfung:', error);
            this.loadingService.setLoading(false);
            return of(false);
          })
        );
      }
      
      // Wenn keine der Rollen geprüft wurde
      this.loadingService.setLoading(false);
      return of(false);
    }, this.ngZone);
  }
}