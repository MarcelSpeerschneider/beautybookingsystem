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
  selector: 'app-booking-confirmation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './booking-confirmation.component.html',
  styleUrls: ['./booking-confirmation.component.css']
})
export class BookingConfirmationComponent implements OnInit, OnDestroy {
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
      this.router.navigate(['/services']);
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
    const providerSub = this.providerService.getProvider(providerId).subscribe(provider => {
      this.provider = provider || null;
    });
    
    this.subscriptions.push(providerSub);
    
    // Get selected date and time from session storage
    const dateString = sessionStorage.getItem('selectedDate');
    if (dateString) {
      this.selectedDate = new Date(JSON.parse(dateString));
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
    
    const providerId = this.cartService.getProviderId();
    if (!providerId || !this.selectedDate || !this.selectedTime) {
      this.loadingService.setLoading(false);
      alert('Fehlerhafte Buchungsdaten. Bitte versuchen Sie es erneut.');
      return;
    }
    
    // Get form values
    const formValues = this.contactForm.value;
    
    // Check if user is logged in
    const userSub = this.authService.user.subscribe(userWithCustomer => {
      const isLoggedIn = !!userWithCustomer.user;
      let customerId = '';
      
      if (isLoggedIn && userWithCustomer.user) {
        customerId = userWithCustomer.user.uid;
      }
      
      // Create appointment date object
      const appointmentDate = new Date(this.selectedDate!);
      const [hours, minutes] = this.selectedTime!.split(':').map(Number);
      appointmentDate.setHours(hours, minutes, 0, 0);
      
      // Create appointments for each service
      const promises: Promise<any>[] = [];
      
      this.cartItems.forEach((service, index) => {
        // Calculate start and end time
        const startTime = new Date(appointmentDate);
        startTime.setMinutes(startTime.getMinutes() + index * (service.duration + 15)); // Add duration of previous services + cleaning time
        
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + service.duration);
        
        // Create appointment object
        const appointment: Partial<Appointment> = {
          customerId: customerId,
          userId: providerId,
          serviceId: service.serviceId,
          startTime: startTime,
          endTime: endTime,
          status: 'pending',
          notes: formValues.notes,
          cleaningTime: 15, // 15 minutes cleaning time
          createdAt: new Date(),
          customerName: `${formValues.firstName} ${formValues.lastName}`,
          serviceName: service.name
        };
        
        // Create appointment
        promises.push(this.appointmentService.createAppointment(appointment as Appointment));
      });
      
      // Wait for all appointments to be created
      Promise.all(promises)
        .then(() => {
          this.loadingService.setLoading(false);
          
          // Clear cart and session storage
          this.cartService.clearCart();
          sessionStorage.removeItem('selectedDate');
          sessionStorage.removeItem('selectedTime');
          
          // Show success message and redirect
          alert('Buchung erfolgreich erstellt! Sie erhalten in Kürze eine Bestätigung per E-Mail.');
          
          // Navigate to success page or home
          if (isLoggedIn) {
            this.router.navigate(['/customer-profile']);
          } else {
            // If not logged in, navigate to provider page
            if (this.provider) {
              this.router.navigate(['/', this.provider.businessName]);
            } else {
              this.router.navigate(['/']);
            }
          }
        })
        .catch(error => {
          this.loadingService.setLoading(false);
          console.error('Error creating appointments:', error);
          alert('Fehler bei der Buchungserstellung. Bitte versuchen Sie es erneut.');
        });
    });
    
    this.subscriptions.push(userSub);
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
    // Navigate back to appointment selection
    const providerId = this.cartService.getProviderId();
    this.router.navigate(['/appointment-selection', providerId]);
  }
}