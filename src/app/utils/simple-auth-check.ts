// src/app/components/utils/simple-auth-check.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-simple-auth-check',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 20px; max-width: 600px; margin: 0 auto;">
      <h2>Simple Auth Status Check</h2>
      
      <div *ngIf="isLoading">Loading...</div>
      
      <div *ngIf="!isLoading">
        <div *ngIf="errorMessage" style="color: red; padding: 10px; border: 1px solid red; margin-bottom: 20px;">
          {{ errorMessage }}
        </div>
        
        <div *ngIf="isLoggedIn">
          <p style="color: green; font-weight: bold;">✓ You are logged in!</p>
          <p>User ID: {{ userId }}</p>
          <p>Email: {{ userEmail }}</p>
          
          <div style="margin-top: 20px;">
            <h3>Provider Status</h3>
            <p *ngIf="isProvider" style="color: green;">✓ You are a provider</p>
            <p *ngIf="!isProvider" style="color: orange;">✗ You are NOT registered as a provider</p>
          </div>
          
          <div style="margin-top: 20px;" *ngIf="providerData">
            <h3>Provider Data</h3>
            <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">{{ providerData }}</pre>
          </div>
          
          <button 
            (click)="createOrFixProviderRole()" 
            style="background-color: #E5887D; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; margin-top: 20px;">
            Fix Provider Role
          </button>
        </div>
        
        <div *ngIf="!isLoggedIn">
          <p style="color: red;">✗ You are NOT logged in</p>
          <p>Please log in first to access provider features</p>
        </div>
      </div>
    </div>
  `
})
export class SimpleAuthCheckComponent implements OnInit {
  isLoading = true;
  isLoggedIn = false;
  isProvider = false;
  userId = '';
  userEmail = '';
  errorMessage = '';
  providerData = '';
  
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  
  ngOnInit() {
    this.checkAuthStatus();
  }
  
  async checkAuthStatus() {
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      // Get current user
      const user = this.auth.currentUser;
      
      if (user) {
        this.isLoggedIn = true;
        this.userId = user.uid;
        this.userEmail = user.email || '';
        
        // Check if user is a provider
        try {
          const providerDocRef = doc(this.firestore, 'providers', user.uid);
          const providerDocSnap = await getDoc(providerDocRef);
          
          if (providerDocSnap.exists()) {
            const data = providerDocSnap.data();
            this.providerData = JSON.stringify(data, null, 2);
            
            if (data && data['role'] === 'provider') {
              this.isProvider = true;
            }
          }
        } catch (err: any) {
          this.errorMessage = `Error checking provider status: ${err.message || 'Unknown error'}`;
          console.error('Error checking provider status:', err);
        }
      } else {
        this.isLoggedIn = false;
      }
    } catch (err: any) {
      this.errorMessage = `Auth error: ${err.message || 'Unknown error'}`;
      console.error('Auth error:', err);
    } finally {
      this.isLoading = false;
    }
  }
  
  async createOrFixProviderRole() {
    if (!this.auth.currentUser) return;
    
    try {
      const userId = this.auth.currentUser.uid;
      const providerDocRef = doc(this.firestore, 'providers', userId);
      const providerDocSnap = await getDoc(providerDocRef);
      
      if (providerDocSnap.exists()) {
        // Update existing document to add/fix role
        await updateDoc(providerDocRef, {
          role: 'provider'
        });
        alert('Provider role updated successfully!');
      } else {
        // Create new provider document
        await setDoc(providerDocRef, {
          role: 'provider',
          email: this.auth.currentUser.email,
          firstName: '',
          lastName: '',
          businessName: 'My Business',
          description: 'My business description',
          logo: '',
          openingHours: 'Mo-Fr 09:00-18:00 | Sa-So Closed'
        });
        alert('Provider document created successfully!');
      }
      
      // Refresh the check
      this.checkAuthStatus();
      
    } catch (err: any) {
      console.error('Error fixing provider role:', err);
      alert(`Error: ${err.message || 'Unknown error'}`);
    }
  }
}