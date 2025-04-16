import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthenticationService } from '../../../services/authentication.service';
import { CartService } from '../../../services/cart.service';
import { ProviderService } from '../../../services/provider.service';
import { Provider } from '../../../models/provider.model';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-booking-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './booking-login.component.html',
  styleUrls: ['./booking-login.component.css']
})
export class BookingLoginComponent implements OnInit {
  // Formular-Modelle
  loginForm!: FormGroup;
  registerForm!: FormGroup;
  
  // Provider-Daten
  provider: Provider | null = null;
  providerId: string = '';
  
  // UI-Status
  showRegister: boolean = false;
  errorMessage: string = '';
  
  // Termin-Daten
  selectedDate: Date | null = null;
  selectedTime: string = '';
  
  // Dienste injecten
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthenticationService);
  private providerService = inject(ProviderService);
  private loadingService = inject(LoadingService);
  public cartService = inject(CartService);
  
  ngOnInit(): void {
    // Provider-ID aus der Route holen
    this.route.params.subscribe(params => {
      if (params['userId']) {
        this.providerId = params['userId'];
        this.loadProvider();
      }
    });
    
    // Termin-Daten aus localStorage oder URL-Parametern holen
    const dateParam = localStorage.getItem('selectedDate');
    const timeParam = localStorage.getItem('selectedTime');
    
    if (dateParam) {
      this.selectedDate = new Date(dateParam);
    }
    
    if (timeParam) {
      this.selectedTime = timeParam;
    }
    
    // Formulare initialisieren
    this.initForms();
    
    // Sicherstellen, dass für diesen Buchungsprozess die korrekte Weiterleitung verwendet wird
    localStorage.setItem('bookingFlow', 'active');
  }
  
  // Provider-Daten laden
  loadProvider(): void {
    if (!this.providerId) return;
    
    this.loadingService.setLoading(true, 'Lade Anbieterinformationen...');
    
    this.providerService.getProvider(this.providerId).subscribe({
      next: (provider) => {
        this.provider = provider || null;
        this.loadingService.setLoading(false);
      },
      error: (err) => {
        console.error('Fehler beim Laden des Providers:', err);
        this.loadingService.setLoading(false);
      }
    });
  }
  
  // Formulare initialisieren
  initForms(): void {
    // Login-Formular
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
    
    // Registrierungs-Formular
    this.registerForm = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      privacyPolicy: [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator });
  }
  
  // Validator für übereinstimmende Passwörter
  passwordMatchValidator(formGroup: FormGroup) {
    const password = formGroup.get('password')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    
    if (password === confirmPassword) {
      return null;
    } else {
      return { passwordMismatch: true };
    }
  }
  
  // Login-Formular absenden
  onLoginSubmit(): void {
    if (this.loginForm.invalid) return;
    
    this.loadingService.setLoading(true, 'Anmeldung läuft...');
    this.errorMessage = '';
    
    this.authService.login({
      email: this.loginForm.value.email,
      password: this.loginForm.value.password
    }).then(() => {
      // URL-Flag hinzufügen, um korrekte Weiterleitung sicherzustellen
      this.router.navigate(['/booking-overview'], { 
        queryParams: { from: 'booking-login' } 
      });
    }).catch(error => {
      this.loadingService.setLoading(false);
      this.errorMessage = 'Fehler bei der Anmeldung. Bitte überprüfen Sie Ihre Zugangsdaten.';
    });
  }
  
  // Registrierungs-Formular absenden
  onRegisterSubmit(): void {
    if (this.registerForm.invalid) return;
    
    this.loadingService.setLoading(true, 'Registrierung läuft...');
    this.errorMessage = '';
    
    this.authService.register({
      email: this.registerForm.value.email,
      password: this.registerForm.value.password,
      firstName: this.registerForm.value.firstName,
      lastName: this.registerForm.value.lastName,
      phone: this.registerForm.value.phone
    }).then(() => {
      // URL-Flag hinzufügen, um korrekte Weiterleitung sicherzustellen
      this.router.navigate(['/booking-overview'], { 
        queryParams: { from: 'booking-login' } 
      });
    }).catch(error => {
      this.loadingService.setLoading(false);
      this.errorMessage = 'Fehler bei der Registrierung. Bitte versuchen Sie es erneut.';
    });
  }
  
  // Zurück-Button
  goBack(): void {
    this.router.navigate(['/appointment-selection', this.providerId]);
  }
  
  // Datum formatieren
  formatDate(date: Date | null): string {
    if (!date) return '';
    
    return new Date(date).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}