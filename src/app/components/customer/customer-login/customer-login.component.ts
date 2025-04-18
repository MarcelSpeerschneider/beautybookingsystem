import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../../services/authentication.service';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../../services/loading.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
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
        // Prüfen, ob der Benutzer eine Kunden-Rolle hat
        this.checkUserRole(user.uid);
      }
    });
  }

  /**
   * Prüft, ob der Benutzer die Kunden-Rolle hat und leitet entsprechend weiter
   * Vereinfachte Version, die nur die role-Eigenschaft prüft
   */
  private async checkUserRole(userId: string): Promise<void> {
    try {
      // Prüft direkt die role-Eigenschaft im customer-Dokument
      const customerDoc = doc(this.firestore, 'customers', userId);
      const customerSnapshot = await getDoc(customerDoc);
      
      if (customerSnapshot.exists()) {
        const data = customerSnapshot.data();
        // Explizite Prüfung der Rolle
        if (data['role'] === 'customer') {
          console.log('Benutzer hat Customer-Rolle, Weiterleitung zum Profil');
          this.router.navigate(['/customer-profile']);
        } else {
          console.warn('Kunde ohne korrekte Rolle gefunden');
          // Die bisherige Prüfung nach Sammlungen entfällt
        }
      } else {
        // Der Benutzer ist kein Kunde
        console.log('Eingeloggter Benutzer ist kein Kunde');
        
        // Prüfen, ob es sich um einen Provider handelt (anhand role)
        const providerDoc = doc(this.firestore, 'providers', userId);
        const providerSnapshot = await getDoc(providerDoc);
        
        if (providerSnapshot.exists() && providerSnapshot.data()['role'] === 'provider') {
          console.log('Benutzer hat Provider-Rolle, Weiterleitung zum Provider-Dashboard');
          this.router.navigate(['/provider-dashboard']);
        }
      }
    } catch (error) {
      console.error('Fehler bei der Rollenprüfung:', error);
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
              // Prüfe nur die role-Eigenschaft
              if (data['role'] === 'customer') {
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
                // Kunde ohne korrekte Rolle
                this.error = 'Ihr Konto hat nicht die erforderlichen Berechtigungen.';
                this.loadingService.setLoading(false);
              }
            } else {
              // Kein Kunden-Dokument gefunden - prüfen, ob es ein Provider ist
              const providerDoc = doc(this.firestore, 'providers', user.uid);
              const providerSnapshot = await getDoc(providerDoc);
              
              if (providerSnapshot.exists() && providerSnapshot.data()['role'] === 'provider') {
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