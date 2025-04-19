// src/app/components/utils/auth-fix/auth-fix.component.ts
import { Component, OnInit, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Auth, onAuthStateChanged, signOut } from '@angular/fire/auth';
import { ZoneUtils } from './zone-utils';

@Component({
  selector: 'app-auth-fix',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="max-width: 600px; margin: 50px auto; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <h2>Authentication Fix</h2>
      
      <div *ngIf="loading" style="text-align: center; padding: 20px;">
        <p>Checking authentication state...</p>
      </div>
      
      <div *ngIf="!loading">
        <div *ngIf="error" style="color: #f44336; background-color: #ffebee; padding: 10px; border-radius: 4px; margin-bottom: 20px;">
          <p>Error: {{ error }}</p>
        </div>
        
        <div *ngIf="isLoggedIn" style="margin-bottom: 20px;">
          <p style="color: #4CAF50; font-weight: bold;">✓ You are logged in</p>
          <p>User ID: {{ userId }}</p>
          <p>Email: {{ userEmail }}</p>
          
          <div style="margin-top: 20px;">
            <p>The following actions can help fix authentication issues:</p>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
              <button (click)="refreshTokenAndNavigate()" style="background-color: #E5887D; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer;">
                Refresh Token and Go to Profile
              </button>
              <button (click)="logout()" style="background-color: #9E9E9E; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer;">
                Logout and Clear Cache
              </button>
            </div>
          </div>
        </div>
        
        <div *ngIf="!isLoggedIn" style="margin-bottom: 20px;">
          <p style="color: #F44336; font-weight: bold;">✗ You are NOT logged in</p>
          <p>Please log in to access provider features</p>
          <button (click)="navigateToLogin()" style="background-color: #2196F3; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
            Go to Login Page
          </button>
        </div>
      </div>
    </div>
  `
})
export class AuthFixComponent implements OnInit {
  loading = true;
  isLoggedIn = false;
  userId = '';
  userEmail = '';
  error = '';
  
  private auth = inject(Auth);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  
  ngOnInit() {
    this.checkAuthState();
  }
  
  checkAuthState() {
    this.loading = true;
    this.error = '';
    
    // Use onAuthStateChanged for reliable auth detection
    const unsubscribe = onAuthStateChanged(this.auth, 
      (user) => {
        this.ngZone.run(() => {
          if (user) {
            this.isLoggedIn = true;
            this.userId = user.uid;
            this.userEmail = user.email || '';
            console.log('Auth state detected: User is logged in', user);
          } else {
            this.isLoggedIn = false;
            console.log('Auth state detected: User is NOT logged in');
          }
          this.loading = false;
          unsubscribe(); // Unsubscribe after first auth state change
        });
      },
      (error) => {
        this.ngZone.run(() => {
          console.error('Auth state error:', error);
          this.error = error.message;
          this.loading = false;
          unsubscribe(); // Unsubscribe on error
        });
      }
    );
  }
  
  async refreshTokenAndNavigate() {
    try {
      this.loading = true;
      
      if (this.auth.currentUser) {
        // Force token refresh
        await this.auth.currentUser.getIdToken(true);
        console.log('Token refreshed successfully');
        
        // Navigate to provider profile
        this.ngZone.run(() => {
          this.router.navigate(['/provider-profile']);
        });
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
    } finally {
      this.loading = false;
    }
  }
  
  async logout() {
    try {
      this.loading = true;
      
      // Sign out from Firebase
      await signOut(this.auth);
      
      // Clear browser storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Reload the page to clear any cached state
      window.location.href = '/login';
      
    } catch (error) {
      console.error('Error during logout:', error);
      this.loading = false;
    }
  }
  
  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}