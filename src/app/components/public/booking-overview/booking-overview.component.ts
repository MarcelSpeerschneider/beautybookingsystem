import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CartService } from '../../../services/cart.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { AppointmentService } from '../../../services/appointment.service';
import { ProviderService } from '../../../services/provider.service';
import { ServiceService } from '../../../services/service.service';
import { LoadingService } from '../../../services/loading.service';
import { Service } from '../../../models/service.model';
import { Provider } from '../../../models/provider.model';
import { Appointment } from '../../../models/appointment.model';

@Component({
  selector: 'app-booking-overview',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './booking-overview.component.html',
  styleUrls: ['./booking-overview.component.css']
})
export class BookingOverviewComponent implements OnInit, OnDestroy {
  contactForm: FormGroup;
  cartItems: Service[] = [];
  provider: Provider | null = null;
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  totalPrice: number = 0;
  totalDuration: number = 0;
  
  private subscriptions: Subscription[] = [];
  
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private cartService = inject(CartService);
  private authService = inject(AuthenticationService);
  private appointmentService = inject(AppointmentService);
  private providerService = inject(ProviderService);
  private serviceService = inject(ServiceService);
  private loadingService = inject(LoadingService);
  
  constructor() {
    this.contactForm = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      notes: ['']
    });
  }
  
  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Buchungsdetails...');
    
    // Get cart items
    this.cartItems = this.cartService.getItems();
    
    if (this.cartItems.length === 0) {
      alert('Keine Dienstleistungen ausgewählt.');
      
      // Get provider ID to redirect back to services page
      const providerId = this.cartService.getProviderId();
      if (providerId) {
        this.router.navigate(['/services', providerId]);
      } else {
        this.router.navigate(['/']);
      }
      return;
    }
    
    // Calculate totals
    this.calculateTotals();
    
    // Get provider
    const providerId = this.cartService.getProviderId();
    if (!providerId) {
      alert('Kein Dienstleister ausgewählt.');
      this.router.navigate(['/']);
      return;
    }
    
    // Load provider details
    const providerSub = this.providerService.getProviderByUserId(providerId).subscribe(provider => {
      this.provider = provider || null;
    });
    
    this.subscriptions.push(providerSub);
    
    // Get selected date and time from session storage
    const dateString = sessionStorage.getItem('selectedDate');
    if (dateString) {
      try {
        this.selectedDate = new Date(JSON.parse(dateString));
      } catch (e) {
        console.error('Error parsing date:', e);
      }
    }
    
    this.selectedTime = sessionStorage.getItem('selectedTime') || null;
    
    if (!this.selectedDate || !this.selectedTime) {
      alert('Kein Termin ausgewählt.');
      this.router.navigate(['/appointment-selection', providerId]);
      return;
    }
    
    // Pre-fill form with customer data if logged in
    const userSub = this.authService.user.subscribe(userWithCustomer => {
      if (userWithCustomer.customer) {
        const customer = userWithCustomer.customer;
        this.contactForm.patchValue({
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone
        });
        
        // Disable form fields since user is logged in
        this.contactForm.get('firstName')?.disable();
        this.contactForm.get('lastName')?.disable();
        this.contactForm.get('email')?.disable();
      }
      
      this.loadingService.setLoading(false);
    });
    
    this.subscriptions.push(userSub);
  }
  
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  calculateTotals(): void {
    this.totalPrice = this.cartItems.reduce((total, item) => total + item.price, 0);
    this.totalDuration = this.cartItems.reduce((total, item) => total + item.duration, 0);
  }
  
  onSubmit(): void {
    if (this.contactForm.invalid) {
      return;
    }
    
    this.loadingService.setLoading(true, 'Buchung wird erstellt...');
    
    // Get form values
    const formValues = this.contactForm.getRawValue(); // Use getRawValue to include disabled fields

    // Speichere Notes temporär
    const notes = this.contactForm.get('notes')?.value?.trim() || '';
    localStorage.setItem('notes', notes);

    // Navigate to confirmation page
    this.router.navigate(['/booking-confirmation']);
    this.loadingService.setLoading(false);
  }
  
  formatDate(date: Date): string {
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }
  
  formatPrice(price: number): string {
    return price.toFixed(2).replace('.', ',') + ' €';
  }
  
  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours} Std. ${remainingMinutes > 0 ? remainingMinutes + ' Min.' : ''}`;
    } else {
      return `${minutes} Min.`;
    }
  }
  
  goBack(): void {
    const providerId = this.cartService.getProviderId();
    this.router.navigate(['/appointment-selection', providerId]);
  }
}