import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../../services/authentication.service';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../../services/loading.service';

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

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.error = null;
      const { email, password } = this.loginForm.value;
      
      this.authService.login({email, password})
        .then(() => {
          // Nach dem Login prüfen, ob eine Weiterleitungs-URL in sessionStorage vorhanden ist
          const redirectUrl = sessionStorage.getItem('redirectUrl') || '/profile';
          console.log('Login successful, redirecting to:', redirectUrl);
          
          // Verzögerung hinzufügen, um sicherzustellen, dass Customer-Daten geladen sind
          setTimeout(() => {
            this.loadingService.setLoading(false);
            this.router.navigateByUrl(redirectUrl);
            // Weiterleitungs-URL aus sessionStorage entfernen
            sessionStorage.removeItem('redirectUrl');
          }, 500);
        })
        .catch((error) => {
          this.error = 'Anmeldung fehlgeschlagen: ' + error.message;
          console.error('Login failed:', error);
        });
    }
  }

  navigateToRegister(): void {
    this.router.navigate(['/customer-register']);
  }
}