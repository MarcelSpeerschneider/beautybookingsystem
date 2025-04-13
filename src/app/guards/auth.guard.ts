import { Injectable, inject } from '@angular/core'; // Import inject
import { CanActivate, Router } from '@angular/router'; // Import Router
import { AuthenticationService } from '../services/authentication.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthenticationService); // inject AuthenticationService
  private router = inject(Router); // inject Router

  canActivate(): boolean { // canActivate method
      if (this.authService.getUser()) { // Check if user is logged in
      return true;
    } else { // If user is not logged in
      this.router.navigate(['/login']);
      return false; // Return false
    }
  }
}