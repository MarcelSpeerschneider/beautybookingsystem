import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../../services/authentication.service';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../../services/loading.service';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { NgZone } from '@angular/core';

@Component({
  selector: 'app-customer-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './customer-login.component.html',
  styleUrls: ['./customer-login.component.css']
})
export class CustomerLoginComponent implements OnInit {
  loginForm!: FormGroup;
  error: string | null = null;
  
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthenticationService);
  private loadingService = inject(LoadingService);
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    // Prüfen, ob der Benutzer bereits eingeloggt ist
    this.authService.user$.subscribe(user => {
      if (user) {
        // Prüfen, ob der Benutzer ein Kunde ist
        this.checkCustomerRole(user.uid);
      }
    });
  }

  /**
   * Prüft, ob der Benutzer die Kunden-Rolle hat und leitet entsprechend weiter
   */
  private async checkCustomerRole(userId: string): Promise<void> {
    try {
      const customerDoc = doc(this.firestore, 'customers', userId);
      const customerSnapshot = await getDoc(customerDoc);
      
      if (customerSnapshot.exists()) {
        const data = customerSnapshot.data();
        // Explizite Prüfung der Rolle mit Index-Notation
        if (data && data['role'] === 'customer') {  // Hier ['role'] statt .role verwenden
          console.log('Bereits als Kunde eingeloggt, Weiterleitung zum Profil');
          this.router.navigate(['/customer-profile']);
        } else {
          // Hat zwar ein Customer-Dokument, aber falsche Rolle
          console.warn('Kunde ohne korrekte Rolle gefunden, setze Rolle...');
          // Rolle aktualisieren
          await this.fixCustomerRole(userId);
        }
      } else {
        // Der Benutzer ist kein Kunde
        console.log('Eingeloggter Benutzer ist kein Kunde');
        
        // Prüfen, ob es sich um einen Provider handelt
        const providerDoc = doc(this.firestore, 'providers', userId);
        const providerSnapshot = await getDoc(providerDoc);
        
        if (providerSnapshot.exists()) {
          console.log('Benutzer ist ein Provider, Weiterleitung zum Provider-Dashboard');
          this.router.navigate(['/provider-dashboard']);
        }
      }
    } catch (error) {
      console.error('Fehler bei der Rollenprüfung:', error);
    }
  }

  /**
   * Korrigiert die Rolle eines Kunden, falls diese fehlt
   */
  private async fixCustomerRole(userId: string): Promise<void> {
    try {
      const customerDoc = doc(this.firestore, 'customers', userId);
      await updateDoc(customerDoc, { 
        role: 'customer',
        updatedAt: new Date()
      });
      console.log('Kunden-Rolle wurde korrigiert');
      this.router.navigate(['/customer-profile']);
    } catch (error) {
      console.error('Fehler beim Korrigieren der Kunden-Rolle:', error);
    }
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.error = null;
      const { email, password } = this.loginForm.value;
      
      this.loadingService.setLoading(true, 'Anmeldung läuft...');
      this.authService.login({email, password})
        .then(async () => {
          // Nach dem Login prüfen, ob der Benutzer ein Kunde ist
          const user = this.authService.getUser();
          if (user) {
            const customerDoc = doc(this.firestore, 'customers', user.uid);
            const customerSnapshot = await getDoc(customerDoc);
            
            if (customerSnapshot.exists()) {
              const data = customerSnapshot.data();
              // Explizite Prüfung der Rolle mit Index-Notation
              if (data && data['role'] === 'customer') {  // Hier ['role'] statt .role verwenden
                // Nach dem Login prüfen, ob eine Weiterleitungs-URL in sessionStorage vorhanden ist
                const redirectUrl = sessionStorage.getItem('redirectUrl') || '/customer-profile';
                console.log('Login successful, redirecting to:', redirectUrl);
                
                // Verzögerung hinzufügen, um sicherzustellen, dass Customer-Daten geladen sind
                setTimeout(() => {
                  this.loadingService.setLoading(false);
                  this.router.navigateByUrl(redirectUrl);
                  // Weiterleitungs-URL aus sessionStorage entfernen
                  sessionStorage.removeItem('redirectUrl');
                }, 500);
              } else {
                // Kunde ohne korrekte Rolle - korrigieren
                await this.fixCustomerRole(user.uid);
                this.loadingService.setLoading(false);
              }
            } else {
              // Kein Kunden-Dokument gefunden - prüfen, ob es ein Provider ist
              const providerDoc = doc(this.firestore, 'providers', user.uid);
              const providerSnapshot = await getDoc(providerDoc);
              
              if (providerSnapshot.exists()) {
                this.error = 'Sie sind als Provider registriert. Bitte nutzen Sie die Provider-Anmeldung.';
                await this.authService.logout();
              } else {
                // Weder Kunde noch Provider - neues Kundenkonto erstellen?
                console.log('Weder Kunde noch Provider gefunden, erstelle neues Kundenkonto...');
                this.router.navigate(['/customer-register']);
              }
              this.loadingService.setLoading(false);
            }
          }
        })
        .catch((error) => {
          this.error = 'Anmeldung fehlgeschlagen: ' + error.message;
          console.error('Login failed:', error);
          this.loadingService.setLoading(false);
        });
    }
  }

  navigateToRegister(): void {
    this.router.navigate(['/customer-register']);
  }
}