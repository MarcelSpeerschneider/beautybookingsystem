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
 * RoleGuard - Protects routes based on user roles
 * Simplified version that only checks the role property
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
    // Get allowed roles from route data
    const allowedRoles = route.data['roles'] as string[];
    
    if (!allowedRoles || allowedRoles.length === 0) {
      console.warn('RoleGuard: No roles defined for route', state.url);
      return of(true); // Without defined roles, access is allowed
    }
    
    this.loadingService.setLoading(true, 'Checking permissions...');
    
    return this.authService.user$.pipe(
      switchMap(user => {
        if (!user) {
          console.log('RoleGuard: User not logged in');
          this.loadingService.setLoading(false);
          this.router.navigate(['/login']); // Use unified login route
          return of(false);
        }
        
        // Store redirect URL for after login
        sessionStorage.setItem('redirectUrl', state.url);
        
        return this.checkUserRole(user.uid, allowedRoles);
      }),
      tap(hasAccess => {
        if (!hasAccess) {
          // Redirect to the unified login page instead of role-specific pages
          this.router.navigate(['/login']);
        }
      }),
      catchError(error => {
        console.error('RoleGuard: Error checking permissions', error);
        this.loadingService.setLoading(false);
        this.router.navigate(['/login']); // Use unified login route
        return of(false);
      })
    );
  }
  
  /**
   * Check if the user has one of the allowed roles
   * Simplified version that only checks the role property
   */
  private checkUserRole(userId: string, allowedRoles: string[]): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      console.log('RoleGuard: Checking user role for', userId);
      
      // First check if the user should have a provider role
      if (allowedRoles.includes('provider')) {
        const providerDoc = doc(this.firestore, 'providers', userId);
        
        return from(this.ngZone.run(() => getDoc(providerDoc))).pipe(
          map(docSnapshot => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data();
              const hasRole = data['role'] === 'provider';
              
              this.loadingService.setLoading(false);
              console.log(`RoleGuard: User ${hasRole ? 'has' : 'does not have'} provider role`);
              return hasRole;
            }
            this.loadingService.setLoading(false);
            return false;
          }),
          catchError(error => {
            console.error('RoleGuard: Error checking provider role:', error);
            this.loadingService.setLoading(false);
            return of(false);
          })
        );
      }
      
      // Then check if the user should have a customer role
      if (allowedRoles.includes('customer')) {
        const customerDoc = doc(this.firestore, 'customers', userId);
        
        return from(this.ngZone.run(() => getDoc(customerDoc))).pipe(
          map(docSnapshot => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data();
              const hasRole = data['role'] === 'customer';
              
              this.loadingService.setLoading(false);
              console.log(`RoleGuard: User ${hasRole ? 'has' : 'does not have'} customer role`);
              return hasRole;
            }
            this.loadingService.setLoading(false);
            return false;
          }),
          catchError(error => {
            console.error('RoleGuard: Error checking customer role:', error);
            this.loadingService.setLoading(false);
            return of(false);
          })
        );
      }
      
      // If no roles were checked
      this.loadingService.setLoading(false);
      return of(false);
    }, this.ngZone);
  }
}