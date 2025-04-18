import { Component, OnInit, HostListener, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthenticationService } from '../../../services/authentication.service';
import { Subscription } from 'rxjs';
import { User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMenuOpen = false;
  isScrolled = false;
  currentUser: User | null = null;
  userRole: string | null = null;
  private authSubscription: Subscription | null = null;

  private authService = inject(AuthenticationService);
  private router = inject(Router);
  private firestore = inject(Firestore);

  constructor() { }

  ngOnInit(): void {
    // Check initial scroll position
    this.checkScroll();
    
    // Subscribe to auth state changes
    this.authSubscription = this.authService.user$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.checkUserRole(user.uid);
      } else {
        this.userRole = null;
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up subscription to prevent memory leaks
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  @HostListener('window:scroll', [])
  checkScroll(): void {
    // Add a scrolled class to the header when the page is scrolled down
    this.isScrolled = window.scrollY > 50;
  }

  toggleMobileMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMenuOpen = false;
  }

  logout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/']);
      this.closeMobileMenu();
    });
  }

  navigateToProfile(): void {
    // Navigate to the appropriate profile page based on user role
    if (this.userRole === 'provider') {
      this.router.navigate(['/provider-dashboard']);
    } else if (this.userRole === 'customer') {
      this.router.navigate(['/customer-profile']);
    }
    this.closeMobileMenu();
  }

  /**
   * Check user role and store it for navigation purposes
   */
  private async checkUserRole(userId: string): Promise<void> {
    try {
      // Check if user is a provider
      const providerDoc = doc(this.firestore, 'providers', userId);
      const providerSnapshot = await getDoc(providerDoc);
      
      if (providerSnapshot.exists() && providerSnapshot.data()['role'] === 'provider') {
        this.userRole = 'provider';
        return;
      }
      
      // Check if user is a customer
      const customerDoc = doc(this.firestore, 'customers', userId);
      const customerSnapshot = await getDoc(customerDoc);
      
      if (customerSnapshot.exists() && customerSnapshot.data()['role'] === 'customer') {
        this.userRole = 'customer';
        return;
      }
      
      this.userRole = null;
    } catch (error) {
      console.error('Error checking user role:', error);
      this.userRole = null;
    }
  }
}