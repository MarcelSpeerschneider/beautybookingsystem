import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../../services/authentication.service';
import { LoadingService } from '../../../services/loading.service';
import { Router } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore'; // updateDoc hinzugefügt

@Component({
  selector: 'app-provider-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './provider-login.component.html',
  styleUrls: ['./provider-login.component.css']
})
export class ProviderLoginComponent implements OnInit {
  
  email = '';
  password = '';
  errorMessage = '';

  auth = inject(AuthenticationService);
  loading = inject(LoadingService);
  router = inject(Router);
  firestore = inject(Firestore);

  ngOnInit(): void {
    // Prüfen, ob der Benutzer bereits eingeloggt ist
    this.auth.user$.subscribe(user => {
      if (user) {
        // Prüfen, ob der Benutzer ein Provider ist
        this.checkProviderRole(user.uid);
      }
    });
  }

  /**
   * Prüft, ob der Benutzer die Provider-Rolle hat und leitet entsprechend weiter
   */
  private async checkProviderRole(userId: string): Promise<void> {
    try {
      const providerDoc = doc(this.firestore, 'providers', userId);
      const providerSnapshot = await getDoc(providerDoc);
      
      if (providerSnapshot.exists()) {
        const data = providerSnapshot.data();
        // Explizite Prüfung der Rolle mit Index-Notation
        if (data && data['role'] === 'provider') {  // ['role'] statt .role
          console.log('Bereits als Provider eingeloggt, Weiterleitung zum Dashboard');
          this.router.navigate(['/provider-dashboard']);
        } else {
          // Hat zwar ein Provider-Dokument, aber falsche Rolle
          console.warn('Provider ohne korrekte Rolle gefunden, setze Rolle...');
          // Rolle aktualisieren
          await this.fixProviderRole(userId);
        }
      } else {
        // Der Benutzer ist kein Provider
        console.log('Eingeloggter Benutzer ist kein Provider');
        
        // Prüfen, ob es sich um einen Kunden handelt
        const customerDoc = doc(this.firestore, 'customers', userId);
        const customerSnapshot = await getDoc(customerDoc);
        
        if (customerSnapshot.exists()) {
          console.log('Benutzer ist ein Kunde, Weiterleitung zur Kundenseite');
          this.router.navigate(['/customer-profile']);
        }
      }
    } catch (error) {
      console.error('Fehler bei der Rollenprüfung:', error);
    }
  }

  /**
   * Korrigiert die Rolle eines Providers, falls diese fehlt
   */
  private async fixProviderRole(userId: string): Promise<void> {
    try {
      const providerDoc = doc(this.firestore, 'providers', userId);
      await updateDoc(providerDoc, { 
        role: 'provider',
        updatedAt: new Date()
      });
      console.log('Provider-Rolle wurde korrigiert');
      this.router.navigate(['/provider-dashboard']);
    } catch (error) {
      console.error('Fehler beim Korrigieren der Provider-Rolle:', error);
    }
  }

  async onSubmit() {
    this.loading.setLoading(true);
    try {
      await this.auth.login({email: this.email, password: this.password});
      
      // Nach dem Login prüfen, ob der Benutzer ein Provider ist
      const user = this.auth.getUser();
      if (user) {
        const providerDoc = doc(this.firestore, 'providers', user.uid);
        const providerSnapshot = await getDoc(providerDoc);
        
        if (providerSnapshot.exists()) {
          const data = providerSnapshot.data();
          // Explizite Prüfung der Rolle mit Index-Notation
          if (data && data['role'] === 'provider') {  // ['role'] statt .role
            this.router.navigate(['/provider-dashboard']);
          } else {
            // Provider ohne korrekte Rolle - korrigieren
            await this.fixProviderRole(user.uid);
          }
        } else {
          // Kein Provider-Dokument gefunden
          this.errorMessage = 'Sie haben kein Provider-Konto. Bitte registrieren Sie sich als Provider.';
          await this.auth.logout();
        }
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'Ungültige E-Mail oder Passwort.';
    } finally {
      this.loading.setLoading(false);
    }
  }
}