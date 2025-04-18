import { Component, OnInit, HostListener, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthenticationService } from '../../../services/authentication.service';
import { Subscription } from 'rxjs';
import { User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { NotificationService } from '../../../services/notification.service';
import { NotificationPopupComponent } from '../notification-popup/notification-popup.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, NotificationPopupComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isScrolled = false;
  isMenuOpen = false; // Existing property for older mobile menu
  isSideMenuOpen = false; // New property for side menu
  currentUser: User | null = null;
  userRole: string | null = null;
  
  // Notification properties
  notificationCount = 0;
  isNotificationPopupOpen = false;
  
  private authSubscription: Subscription | null = null;
  private notificationSubscription: Subscription | null = null;

  private authService = inject(AuthenticationService);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private notificationService = inject(NotificationService);

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
        // Stop listening for notifications if user logs out
        this.notificationService.stopListeningForNotifications();
        if (this.notificationSubscription) {
          this.notificationSubscription.unsubscribe();
          this.notificationSubscription = null;
        }
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
    
    this.notificationService.stopListeningForNotifications();
  }

  @HostListener('window:scroll', [])
  checkScroll(): void {
    // Add a scrolled class to the header when the page is scrolled down
    this.isScrolled = window.scrollY > 50;
  }

  // Methods for old mobile menu (keep for backward compatibility)
  toggleMobileMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMenuOpen = false;
  }

  // Methods for the new side menu
  toggleSideMenu(): void {
    this.isSideMenuOpen = !this.isSideMenuOpen;
    
    // Close notification popup if it's open
    if (this.isNotificationPopupOpen) {
      this.isNotificationPopupOpen = false;
    }
    
    // Prevent body scrolling when menu is open
    if (this.isSideMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
  
  closeSideMenu(): void {
    this.isSideMenuOpen = false;
    document.body.style.overflow = '';
  }

  logout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/']);
      this.closeSideMenu();
      this.closeMobileMenu(); // Close both menus
      // Stop listening for notifications on logout
      this.notificationService.stopListeningForNotifications();
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
    this.closeSideMenu();
  }

  // Notification methods
  toggleNotificationPopup(): void {
    this.isNotificationPopupOpen = !this.isNotificationPopupOpen;
    
    // Close side menu if it's open
    if (this.isSideMenuOpen) {
      this.closeSideMenu();
    }
    
    // Close mobile menu if it's open
    if (this.isMenuOpen) {
      this.closeMobileMenu();
    }
  }
  
  closeNotificationPopup(): void {
    this.isNotificationPopupOpen = false;
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
        
        // Start listening for notifications if the user is a provider
        this.notificationService.startListeningForNotifications(userId);
        
        // Subscribe to notification count
        if (this.notificationSubscription) {
          this.notificationSubscription.unsubscribe();
        }
        
        this.notificationSubscription = this.notificationService.getUnreadCount().subscribe(count => {
          this.notificationCount = count;
        });
        
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