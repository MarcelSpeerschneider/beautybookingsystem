import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthenticationService } from '../../../services/authentication.service';
import { ProviderService } from '../../../services/provider.service';
import { LoadingService } from '../../../services/loading.service';
import { Provider } from '../../../models/provider.model';

@Component({
  selector: 'app-provider-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './provider-profile.component.html',
  styleUrls: ['./provider-profile.component.css']
})
export class ProviderProfileComponent implements OnInit, OnDestroy {
  provider: Provider & { providerId: string } | null = null;
  profileForm!: FormGroup;
  successMessage: string = '';
  errorMessage: string = '';
  isEditMode: boolean = false;
  
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

  private subscriptions: Subscription[] = [];
  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthenticationService);
  private providerService = inject(ProviderService);
  private loadingService = inject(LoadingService);
  private router = inject(Router);

  ngOnInit(): void {
    this.initializeForm();
    this.loadProviderData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  initializeForm(): void {
    this.profileForm = this.formBuilder.group({
      businessName: ['', [Validators.required]],
      description: ['', [Validators.required]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      logo: [''],
      website: [''],
      socialMedia: this.formBuilder.group({
        instagram: [''],
        facebook: ['']
      }),
      specialties: [''],
      acceptsOnlinePayments: [false],
      address: ['']
    });
  }

  loadProviderData(): void {
    this.loadingService.setLoading(true, 'Lade Profildaten...');
    
    const userSub = this.authService.user.subscribe(userWithCustomer => {
      if (!userWithCustomer.user) {
        this.router.navigate(['/provider-login']);
        return;
      }

      // Get provider info using Auth UID
      const providerSub = this.providerService.getProvider(userWithCustomer.user.uid)
        .subscribe(provider => {
          if (provider) {
            // Store provider data
            this.provider = provider as Provider & { providerId: string };
            
            // Parse business hours to update the business days array
            this.parseBusinessHours(this.provider.openingHours);
            
            // Update form values
            this.updateFormValues(this.provider);
          } else {
            // User is not a provider, redirect to provider registration
            this.router.navigate(['/provider-registration']);
          }
          this.loadingService.setLoading(false);
        });

      this.subscriptions.push(providerSub);
    });

    this.subscriptions.push(userSub);
  }

  updateFormValues(provider: Provider): void {
    // Extract specialties to a comma-separated string if it's an array
    const specialtiesString = Array.isArray(provider.specialties) 
      ? provider.specialties.join(', ') 
      : provider.specialties || '';

    this.profileForm.patchValue({
      businessName: provider.businessName || '',
      description: provider.description || '',
      firstName: provider.firstName || '',
      lastName: provider.lastName || '',
      email: provider.email || '',
      phone: provider.phone || '',
      logo: provider.logo || '',
      website: provider.website || '',
      socialMedia: {
        instagram: provider.socialMedia?.instagram || '',
        facebook: provider.socialMedia?.facebook || ''
      },
      specialties: specialtiesString,
      acceptsOnlinePayments: provider.acceptsOnlinePayments || false,
      address: provider.address || ''
    });
  }

  parseBusinessHours(openingHoursString: string): void {
    if (!openingHoursString) return;

    try {
      // This is a simple parser for the format "Mo-Fr 09:00-18:00 | Sa-So 10:00-14:00"
      // In a real app, this would be more robust
      const parts = openingHoursString.split(' | ');
      
      for (const part of parts) {
        const [days, times] = part.split(' ');
        if (!days || !times) continue;
        
        const [startTime, endTime] = times.split('-');
        
        if (days === 'Mo-Fr') {
          // Update Monday to Friday
          this.updateBusinessDaysTimes(['mon', 'tue', 'wed', 'thu', 'fri'], startTime, endTime, false);
        } else if (days === 'Sa-So') {
          // Update Saturday and Sunday
          this.updateBusinessDaysTimes(['sat', 'sun'], startTime, endTime, false);
        } else if (days === 'Täglich') {
          // Update all days
          this.updateBusinessDaysTimes(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], startTime, endTime, false);
        } else {
          // Handle individual days (e.g., Mon, Tue, Wed)
          const dayKeys = this.mapDisplayDaysToKeys(days.split(','));
          this.updateBusinessDaysTimes(dayKeys, startTime, endTime, false);
        }
      }
    } catch (error) {
      console.error('Error parsing business hours:', error);
    }
  }

  mapDisplayDaysToKeys(displayDays: string[]): string[] {
    const mapping: {[key: string]: string} = {
      'Mon': 'mon', 'Tue': 'tue', 'Wed': 'wed', 'Thu': 'thu', 
      'Fri': 'fri', 'Sat': 'sat', 'Sun': 'sun'
    };
    
    return displayDays.map(day => mapping[day.trim()] || day.trim().toLowerCase().substring(0, 3));
  }

  updateBusinessDaysTimes(dayKeys: string[], openTime: string, closeTime: string, closed: boolean): void {
    for (const day of this.businessDays) {
      if (dayKeys.includes(day.key)) {
        day.openTime = openTime;
        day.closeTime = closeTime;
        day.closed = closed;
      }
    }
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode && this.provider) {
      // Reset form to original values if canceling edit
      this.updateFormValues(this.provider);
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
    if (this.profileForm.invalid || !this.provider) {
      this.errorMessage = 'Bitte füllen Sie alle erforderlichen Felder aus.';
      return;
    }

    this.loadingService.setLoading(true, 'Profil wird aktualisiert...');
    this.errorMessage = '';
    this.successMessage = '';

    const formData = this.profileForm.value;
    
    // Convert specialties string to array
    const specialtiesArray = formData.specialties
      ? formData.specialties.split(',').map((s: string) => s.trim())
      : [];

    // Get formatted business hours
    const formattedBusinessHours = this.getFormattedBusinessHours();

    // Create updated provider object
    const updatedProvider: Provider = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      businessName: formData.businessName,
      description: formData.description,
      address: formData.address,
      logo: formData.logo || '',
      website: formData.website || '',
      socialMedia: {
        instagram: formData.socialMedia?.instagram || '',
        facebook: formData.socialMedia?.facebook || ''
      },
      openingHours: formattedBusinessHours,
      specialties: specialtiesArray,
      acceptsOnlinePayments: formData.acceptsOnlinePayments,
      role: 'provider' // Ensure role is set
    };

    // Update the provider in the database
    this.providerService.updateProvider(this.provider.providerId, updatedProvider)
      .then(() => {
        this.loadingService.setLoading(false);
        this.successMessage = 'Profil erfolgreich aktualisiert!';
        this.isEditMode = false;
        
        // Reload provider data
        this.loadProviderData();
      })
      .catch(error => {
        this.loadingService.setLoading(false);
        this.errorMessage = `Fehler beim Aktualisieren des Profils: ${error.message}`;
        console.error('Error updating provider profile:', error);
      });
  }
}