import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../../services/authentication.service';
import { ProviderService } from '../../../services/provider.service';
import { Provider } from '../../../models/provider.model';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-provider-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './provider-registration.component.html',
  styleUrls: ['./provider-registration.component.css']
})
export class ProviderRegistrationComponent implements OnInit {
  successMessage: string = '';
  errorMessage: string = '';
  isSuccessful: boolean = false;
  providerForm!: FormGroup;
  authForm!: FormGroup;
  step = 1;
  
  // Business Hours configuration
  businessDays = [
    { key: 'mon', label: 'Montag', openTime: '09:00', closeTime: '18:00', closed: false },
    { key: 'tue', label: 'Dienstag', openTime: '09:00', closeTime: '18:00', closed: false },
    { key: 'wed', label: 'Mittwoch', openTime: '09:00', closeTime: '18:00', closed: false },
    { key: 'thu', label: 'Donnerstag', openTime: '09:00', closeTime: '18:00', closed: false },
    { key: 'fri', label: 'Freitag', openTime: '09:00', closeTime: '18:00', closed: false },
    { key: 'sat', label: 'Samstag', openTime: '10:00', closeTime: '14:00', closed: true },
    { key: 'sun', label: 'Sonntag', openTime: '10:00', closeTime: '14:00', closed: true }
  ];

  timeSlots = [
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
  ];
  
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthenticationService);
  private providerService = inject(ProviderService);
  private loadingService = inject(LoadingService);

  ngOnInit(): void {
    // Explicitly set provider registration flag
    localStorage.setItem('registering_provider', 'true');
    sessionStorage.setItem('registering_provider', 'true');
    
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
      street: [''],
      zip: [''],
      city: [''],
      logo: [''],
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
    if (this.authForm.valid) {
      this.step++;
    }
  }

  previousStep(): void {
    if (this.step > 1) {
      this.step--;
    }
  }
  
  // Business Hours methods
  updateClosedStatus(day: any): void {
    if (day.closed) {
      // Store previous values temporarily if needed
      day.previousOpenTime = day.openTime;
      day.previousCloseTime = day.closeTime;
    } else {
      // Restore previous values if available
      if (day.previousOpenTime) {
        day.openTime = day.previousOpenTime;
      }
      if (day.previousCloseTime) {
        day.closeTime = day.previousCloseTime;
      }
    }
  }

  formatBusinessHours(): string {
    const formatted = this.businessDays
      .filter(day => !day.closed)
      .map(day => `${day.label}: ${day.openTime} - ${day.closeTime}`)
      .join(' | ');
    
    return formatted || 'Keine Öffnungszeiten festgelegt';
  }

  getFormattedBusinessHours(): string {
    const openDays = this.businessDays.filter(day => !day.closed);
    
    // Group consecutive days with same hours
    const groups: any[] = [];
    let currentGroup: any = null;
    
    openDays.forEach(day => {
      if (!currentGroup || 
          (currentGroup.openTime !== day.openTime || currentGroup.closeTime !== day.closeTime)) {
        currentGroup = {
          days: [day],
          openTime: day.openTime,
          closeTime: day.closeTime
        };
        groups.push(currentGroup);
      } else {
        currentGroup.days.push(day);
      }
    });
    
    // Format each group
    return groups.map(group => {
      const dayKeys = group.days.map((d: any) => d.key);
      let dayString = '';
      
      // Handle special cases for better formatting
      if (dayKeys.length === 7) {
        dayString = 'Täglich';
      } else if (dayKeys.includes('mon') && dayKeys.includes('tue') && 
                 dayKeys.includes('wed') && dayKeys.includes('thu') && 
                 dayKeys.includes('fri') && !dayKeys.includes('sat') && 
                 !dayKeys.includes('sun')) {
        dayString = 'Mo-Fr';
      } else if (dayKeys.includes('sat') && dayKeys.includes('sun') && 
                 dayKeys.length === 2) {
        dayString = 'Sa-So';
      } else {
        dayString = group.days.map((d: any) => d.key.charAt(0).toUpperCase() + d.key.slice(1, 3)).join(', ');
      }
      
      return `${dayString} ${group.openTime}-${group.closeTime}`;
    }).join(' | ');
  }

  onSubmit(): void {
    console.log("Form submitted");
    if (this.authForm.valid && this.providerForm.valid) {
      this.loadingService.setLoading(true, 'Registrierung wird durchgeführt...');

      const authData = this.authForm.value;
      const providerData = this.providerForm.value;

      // Create specialties array from comma-separated string
      const specialtiesArray = providerData.specialties
        ? providerData.specialties.split(',').map((s: string) => s.trim())
        : [];
      
      // Get formatted business hours
      const formattedBusinessHours = this.getFormattedBusinessHours();

      // Register the user with authentication service
      this.authService.registerProvider({
        email: authData.email,
        password: authData.password,
        firstName: providerData.firstName,
        lastName: providerData.lastName,
        phone: providerData.phone,
        companyName: providerData.businessName,
        description: providerData.description,
        street: providerData.street,
        zip: providerData.zip,
        city: providerData.city,
        logo: providerData.logo,
        website: providerData.website,
        openingHours: formattedBusinessHours,
        instagram: providerData.instagram,
        facebook: providerData.facebook,
        specialties: specialtiesArray,
      }).then(response => {
        if (response && response.user) {
          const userId = response.user.uid;
          
          // Make sure to mark as provider for subsequent operations
          localStorage.setItem(`user_role_${userId}`, 'provider');
          
          // Create provider object
          const provider: Provider = {
            id: userId,
            firstName: providerData.firstName,
            lastName: providerData.lastName,
            email: authData.email,
            phone: providerData.phone,
            businessName: providerData.businessName,
            description: providerData.description,
            address: `${providerData.street}, ${providerData.zip} ${providerData.city}`,
            logo: providerData.logo || '', // Default empty, will be updated with image upload
            website: providerData.website || '',
            socialMedia: {
              instagram: providerData.instagram || '',
              facebook: providerData.facebook || ''
            },
            openingHours: formattedBusinessHours, // Use the same formatted hours
            specialties: specialtiesArray,
            acceptsOnlinePayments: providerData.acceptsOnlinePayments,
          };

          // Save provider to database
          this.providerService.addProvider(provider)
            .then(docRef => {
              this.loadingService.setLoading(false);
              this.successMessage = 'Provider-Konto erfolgreich erstellt!';
              setTimeout(() => {
                this.router.navigate(['/provider-dashboard']);
              }, 1500);
              return;
            })
            .catch(error => {
              this.loadingService.setLoading(false);
              console.error('Error creating provider profile:', error);
              this.errorMessage = 'Fehler beim Erstellen des Provider-Profils. Bitte versuchen Sie es erneut.';
            });
        }
      }).catch(error => {
        this.loadingService.setLoading(false);
        console.error('Registration error:', error);
        this.errorMessage = `Registrierung fehlgeschlagen: ${error.message}`;
      });
    }
  }
}