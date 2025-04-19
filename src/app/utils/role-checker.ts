// src/app/components/utils/role-checker/role-checker.component.ts
import { Component, OnInit, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, doc, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-role-checker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="role-checker-container">
      <h2>Provider Role Checker</h2>
      
      <div *ngIf="loading" class="loading-message">
        Überprüfe Benutzerrollen...
      </div>
      
      <div *ngIf="error" class="error-message">
        <p>Fehler: {{ error }}</p>
        <button (click)="checkUserAndRole()" class="retry-button">Erneut versuchen</button>
      </div>
      
      <div *ngIf="!loading && !error">
        <div *ngIf="user" class="user-info">
          <h3>Benutzer gefunden</h3>
          <p>User ID: {{ user.uid }}</p>
          <p>Email: {{ user.email }}</p>
          
          <div class="auth-methods">
            <h4>Auth Provider Diagnose</h4>
            <p>Provider ID: {{ user.providerId || 'Nicht verfügbar' }}</p>
            <p>Anonym: {{ user.isAnonymous ? 'Ja' : 'Nein' }}</p>
            <button (click)="refreshToken()" class="fix-button">Auth Token aktualisieren</button>
          </div>
        </div>
        
        <div *ngIf="!user" class="error-message">
          <p>Kein angemeldeter Benutzer gefunden. Bitte melden Sie sich an.</p>
          <p>Sie sagen, dass Sie bereits angemeldet sind - das deutet auf ein Problem mit der Auth-Integration hin.</p>
          <div>
            <button (click)="goToLogin()" class="fix-button">Zum Login</button>
            <button (click)="forceAuthCheck()" class="fix-button">Auth-Status erzwingen</button>
          </div>
        </div>
        
        <div *ngIf="user && providerDoc" class="provider-info success">
          <h3>Provider-Dokument gefunden</h3>
          <p>Hat 'role=provider': {{ hasProviderRole ? 'Ja ✓' : 'Nein ✗' }}</p>
          <p>Dokument ID: {{ providerDocId }}</p>
          
          <div class="provider-details">
            <h4>Provider Dokument Details:</h4>
            <pre>{{ providerDocString }}</pre>
          </div>
          
          <div *ngIf="!hasProviderRole" class="fix-container">
            <p class="warning">Ihr Provider-Dokument hat kein oder ein falsches 'role' Feld.</p>
            <button (click)="fixProviderRole()" class="fix-button">Provider-Rolle korrigieren</button>
          </div>
        </div>
        
        <div *ngIf="user && !providerDoc" class="provider-info error">
          <h3>Provider-Dokument fehlt</h3>
          <p>Es wurde kein Provider-Dokument in der Datenbank gefunden.</p>
          <button (click)="createProviderDocument()" class="fix-button">Provider-Dokument erstellen</button>
        </div>
        
        <div class="actions">
          <h3>Weitere Aktionen</h3>
          <button (click)="checkUserAndRole()" class="action-button">Status aktualisieren</button>
          <button (click)="showRawProviders()" class="action-button">Alle Provider anzeigen</button>
          <button (click)="goToDashboard()" class="action-button">Zum Dashboard</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .role-checker-container {
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      border-radius: 8px;
      background-color: #fff;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    h2 {
      color: #333;
      margin-bottom: 20px;
    }
    
    .loading-message {
      text-align: center;
      padding: 20px;
    }
    
    .user-info, .provider-info {
      margin-bottom: 20px;
      padding: 15px;
      border-radius: 6px;
      background-color: #f9f9f9;
    }
    
    .success {
      background-color: #e8f5e9;
      border-left: 4px solid #4caf50;
    }
    
    .error {
      background-color: #ffebee;
      border-left: 4px solid #f44336;
    }
    
    .warning {
      color: #f57c00;
      font-weight: bold;
    }
    
    .fix-container {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
    }
    
    .fix-button, .action-button, .retry-button {
      background-color: #E5887D;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
      margin-right: 10px;
      font-weight: 500;
    }
    
    .fix-button:hover, .action-button:hover, .retry-button:hover {
      background-color: #d67d74;
    }
    
    .retry-button {
      background-color: #5c6bc0;
    }
    
    .action-button {
      background-color: #78909c;
    }
    
    .error-message {
      color: #f44336;
      padding: 15px;
      background-color: #ffebee;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    
    .provider-details, .auth-methods {
      margin-top: 15px;
      padding: 10px;
      background-color: #f5f5f5;
      border-radius: 4px;
    }
    
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      background-color: #f1f1f1;
      padding: 10px;
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
    }
    
    .actions {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
  `]
})
export class RoleCheckerComponent implements OnInit {
  user: any = null;
  providerDoc: any = null;
  providerDocId: string = '';
  providerDocString: string = '';
  hasProviderRole: boolean = false;
  loading: boolean = true;
  error: string | null = null;
  
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  
  ngOnInit(): void {
    this.checkUserAndRole();
  }
  
  async checkUserAndRole(): Promise<void> {
    this.loading = true;
    this.error = null;
    
    try {
      // Überprüfe, ob ein Benutzer angemeldet ist - mit mehreren Methoden
      this.user = this.auth.currentUser;
      
      if (!this.user) {
        console.log("No user found with auth.currentUser - trying onAuthStateChanged");
        await new Promise<void>((resolve) => {
          const unsubscribe = onAuthStateChanged(this.auth, (user) => {
            this.ngZone.run(() => {
              if (user) {
                this.user = user;
                console.log("User found via onAuthStateChanged", user);
              } else {
                console.log("Still no user found via onAuthStateChanged");
              }
              unsubscribe();
              resolve();
            });
          }, (error: any) => {
            console.error("Auth state changed error", error);
            this.error = `Auth Error: ${error.message || 'Unknown error'}`;
            unsubscribe();
            resolve();
          });
        });
      }
      
      if (this.user) {
        // Überprüfe, ob ein Provider-Dokument existiert
        try {
          const providerDocRef = doc(this.firestore, 'providers', this.user.uid);
          const providerDocSnap = await getDoc(providerDocRef);
          
          if (providerDocSnap.exists()) {
            this.providerDoc = providerDocSnap.data();
            this.providerDocId = providerDocSnap.id;
            this.providerDocString = JSON.stringify(this.providerDoc, null, 2);
            
            // Überprüfe, ob die Provider-Rolle korrekt ist
            if (this.providerDoc && this.providerDoc.role === 'provider') {
              this.hasProviderRole = true;
            }
          } else {
            console.log("Provider document doesn't exist");
            
            // Try looking for any provider document with matching email
            if (this.user.email) {
              console.log("Checking for provider docs with matching email");
              // This would require a collection query implementation
              // For now, we'll just log this intent
            }
          }
        } catch (error: any) {
          console.error("Error checking provider document:", error);
          this.error = `Firestore Error: ${error.message || 'Unknown error'}`;
        }
      }
    } catch (error: any) {
      console.error('Error checking user role:', error);
      this.error = `Generic Error: ${error.message || 'Unknown error'}`;
    } finally {
      this.loading = false;
    }
  }
  
  async fixProviderRole(): Promise<void> {
    if (!this.user) return;
    
    try {
      const providerDocRef = doc(this.firestore, 'providers', this.user.uid);
      
      // Update das Dokument, um die Rolle zu korrigieren
      await updateDoc(providerDocRef, {
        role: 'provider'
      });
      
      alert('Provider-Rolle wurde erfolgreich korrigiert. Bitte laden Sie die Seite neu, um die Änderungen zu sehen.');
      
      // Nach erfolgreicher Aktualisierung erneut prüfen
      this.checkUserAndRole();
    } catch (error: any) {
      console.error('Error fixing provider role:', error);
      alert('Fehler beim Korrigieren der Provider-Rolle. Siehe Konsole für Details.');
    }
  }
  
  async createProviderDocument(): Promise<void> {
    if (!this.user) return;
    
    try {
      const providerDocRef = doc(this.firestore, 'providers', this.user.uid);
      
      // Erstelle ein neues Provider-Dokument mit den minimalen erforderlichen Feldern
      const providerData = {
        role: 'provider',
        email: this.user.email,
        firstName: '',
        lastName: '',
        businessName: 'Mein Unternehmen',
        description: 'Beschreibung meines Unternehmens',
        logo: '',
        openingHours: 'Mo-Fr 09:00-18:00 | Sa-So Geschlossen'
      };
      
      await setDoc(providerDocRef, providerData);
      
      alert('Provider-Dokument wurde erfolgreich erstellt. Bitte laden Sie die Seite neu, um die Änderungen zu sehen.');
      
      // Nach erfolgreicher Erstellung erneut prüfen
      this.checkUserAndRole();
    } catch (error: any) {
      console.error('Error creating provider document:', error);
      alert('Fehler beim Erstellen des Provider-Dokuments. Siehe Konsole für Details.');
    }
  }
  
  goToLogin(): void {
    this.router.navigate(['/login']);
  }
  
  goToDashboard(): void {
    this.router.navigate(['/provider-dashboard']);
  }
  
  async forceAuthCheck(): Promise<void> {
    this.loading = true;
    
    try {
      // Force a full auth refresh
      if (this.auth.currentUser) {
        const tokenResult = await this.auth.currentUser.getIdTokenResult(true);
        console.log("Forced token refresh successful", tokenResult);
        
        // Get user again
        this.user = this.auth.currentUser;
        
        // Check provider doc
        if (this.user) {
          const providerDocRef = doc(this.firestore, 'providers', this.user.uid);
          const providerDocSnap = await getDoc(providerDocRef);
          
          if (providerDocSnap.exists()) {
            this.providerDoc = providerDocSnap.data();
            this.providerDocId = providerDocSnap.id;
            this.providerDocString = JSON.stringify(this.providerDoc, null, 2);
            
            // Check if provider role is correct
            if (this.providerDoc && this.providerDoc.role === 'provider') {
              this.hasProviderRole = true;
            }
          }
        }
      } else {
        console.log("No current user found for token refresh");
      }
    } catch (error: any) {
      console.error("Error during force auth check:", error);
      this.error = `Force Auth Error: ${error.message || 'Unknown error'}`;
    } finally {
      this.loading = false;
    }
  }
  
  async refreshToken(): Promise<void> {
    if (!this.user) return;
    
    try {
      const tokenResult = await this.user.getIdTokenResult(true);
      console.log("Token refreshed successfully", tokenResult);
      alert('Auth Token wurde erfolgreich aktualisiert. Bitte versuchen Sie erneut auf das Provider-Profil zuzugreifen.');
    } catch (error: any) {
      console.error("Error refreshing token:", error);
      alert(`Fehler beim Aktualisieren des Tokens: ${error.message || 'Unknown error'}`);
    }
  }
  
  showRawProviders(): void {
    // This is just a placeholder - would show a dialog with raw provider data
    alert('Diese Funktion ist noch nicht implementiert');
  }
}