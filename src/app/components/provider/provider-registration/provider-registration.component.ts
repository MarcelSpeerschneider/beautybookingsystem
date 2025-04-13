import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../../services/authentication.service';
import { ProviderService } from '../../../services/provider.service';
import { Provider } from '../../../models/provider.model';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-provider-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './provider-registration.component.html',
  styleUrls: ['./provider-registration.component.css']
})
export class ProviderRegistrationComponent implements OnInit {
  providerForm!: FormGroup;
  authForm!: FormGroup;
  step: number = 1;
  totalSteps: number = 2;
  
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthenticationService);
  private providerService = inject(ProviderService);
  private loadingService = inject(LoadingService);

  ngOnInit(): void {
    // Authentication step form
    this.authForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // Provider details form
    this.providerForm = this.formBuilder.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      phone: ['', [Validators.required]],
      businessName: ['', [Validators.required]],
      description: ['', [Validators.required]],
      address: [''],
      website: [''],
      instagram: [''],
      facebook: [''],
      specialties: [''], // This will be converted to array
      acceptsOnlinePayments: [false]
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  nextStep(): void {
    if (this.step === 1 && this.authForm.valid) {
      this.step++;
    }
  }

  previousStep(): void {
    if (this.step > 1) {
      this.step--;
    }
  }

  onSubmit(): void {
    if (this.authForm.valid && this.providerForm.valid) {
      this.loadingService.setLoading(true, 'Registrierung wird durchgeführt...');
      
      const authData = this.authForm.value;
      const providerData = this.providerForm.value;
      
      // Register the user with authentication service
      this.authService.registerProvider({
        email: authData.email,
        password: authData.password,
        firstName: providerData.firstName,
        lastName: providerData.lastName,
        phone: providerData.phone
      }).then(response => {
        if (response && response.user) {
          const userId = response.user.uid;
          
          // Create specialties array from comma-separated string
          const specialtiesArray = providerData.specialties
            ? providerData.specialties.split(',').map((s: string) => s.trim())
            : [];
          
          // Create provider object
          const provider: Provider = {
            providerId: '', // Will be set by Firestore
            userId: userId,
            firstName: providerData.firstName,
            lastName: providerData.lastName,
            email: authData.email,
            phone: providerData.phone,
            businessName: providerData.businessName,
            description: providerData.description,
            address: providerData.address || '',
            logo: '', // Default empty, will be updated with image upload
            website: providerData.website || '',
            socialMedia: {
              instagram: providerData.instagram || '',
              facebook: providerData.facebook || ''
            },
            openingHours: 'Mo-Fr 9:00-18:00', // Default hours, should be improved
            specialties: specialtiesArray,
            acceptsOnlinePayments: providerData.acceptsOnlinePayments
          };
          
          // Save provider to database
          this.providerService.createProvider(provider)
            .then(docRef => {
              this.loadingService.setLoading(false);
              alert('Provider account created successfully!');
              this.router.navigate(['/provider-dashboard']);
            })
            .catch(error => {
              this.loadingService.setLoading(false);
              console.error('Error creating provider profile:', error);
              alert('Error creating provider profile. Please try again.');
            });
        }
      }).catch(error => {
        this.loadingService.setLoading(false);
        console.error('Registration error:', error);
        alert(`Registration failed: ${error.message}`);
      });
    }
  }
}