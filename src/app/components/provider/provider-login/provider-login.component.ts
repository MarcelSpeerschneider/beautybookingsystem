import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../../services/authentication.service';
import { LoadingService } from '../../../services/loading.service';
import { Router } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

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
        // Prüfen, ob der Benutzer die Provider-Rolle hat
        this.checkUserRole(user.uid);
      }
    });
  }

  /**
   * Prüft, ob der Benutzer die Provider-Rolle hat und leitet entsprechend weiter
   * Vereinfachte Version, die nur die role-Eigenschaft prüft
   */
  private async checkUserRole(userId: string): Promise<void> {
    try {
      // Prüft die role-Eigenschaft im provider-Dokument
      const providerDoc = doc(this.firestore, 'providers', userId);
      const providerSnapshot = await getDoc(providerDoc);
      
      if (providerSnapshot.exists()) {
        const data = providerSnapshot.data();
        // Prüfe nur die role-Eigenschaft
        if (data['role'] === 'provider') {
          console.log('Benutzer hat Provider-Rolle, Weiterleitung zum Dashboard');
          this.router.navigate(['/provider-dashboard']);
        } else {
          console.warn('Provider ohne korrekte Rolle gefunden');
          // Die bisherige Prüfung nach Sammlungen entfällt
        }
      } else {
        // Der Benutzer ist kein Provider
        console.log('Eingeloggter Benutzer ist kein Provider');
        
        // Prüfen, ob es sich um einen Kunden handelt (anhand role)
        const customerDoc = doc(this.firestore, 'customers', userId);
        const customerSnapshot = await getDoc(customerDoc);
        
        if (customerSnapshot.exists() && customerSnapshot.data()['role'] === 'customer') {
          console.log('Benutzer hat Customer-Rolle, Weiterleitung zur Kundenseite');
          this.router.navigate(['/customer-profile']);
        }
      }
    } catch (error) {
      console.error('Fehler bei der Rollenprüfung:', error);
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
          // Prüfe nur die role-Eigenschaft
          if (data['role'] === 'provider') {
            this.router.navigate(['/provider-dashboard']);
          } else {
            this.errorMessage = 'Ihr Konto hat nicht die erforderlichen Provider-Berechtigungen.';
            await this.auth.logout();
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