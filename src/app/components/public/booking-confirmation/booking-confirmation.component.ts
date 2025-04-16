import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
// Services
import { CartService } from '../../../services/cart.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { AppointmentService } from '../../../services/appointment.service';
import { ProviderService } from '../../../services/provider.service';
import { LoadingService } from '../../../services/loading.service';

// Models
import { Service } from '../../../models/service.model';
import { Provider } from '../../../models/provider.model';
import { Customer } from '../../../models/customer.model';
import { Appointment } from '../../../models/appointment.model';

@Component({
  selector: 'app-booking-confirmation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './booking-confirmation.component.html',
  styleUrls: ['./booking-confirmation.component.css']
})
export class BookingConfirmationComponent implements OnInit, OnDestroy {
  // Properties
  provider: Provider | null | undefined = null;
  customer: Customer | null = null;
  cartItems: Service[] = [];
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  
  // UI state
  selectedPayment: string = 'vor-ort';
  termsAccepted: boolean = false;
  showSuccessMessage: boolean = false;
  bookingNumber: string = '';
  savedAppointment: Appointment;
  
  // Subscriptions
  private subscriptions: Subscription[] = [];
  
  // Services
  private router = inject(Router);
  private cartService = inject(CartService);
  private authService = inject(AuthenticationService);
  private appointmentService = inject(AppointmentService);
  private providerService = inject(ProviderService);
  private loadingService = inject(LoadingService);
  
  constructor() {
    // Initialize savedAppointment with default values using the updated model structure
    this.savedAppointment = {
      id: '',
      customerId: '',
      providerId: '',
      serviceIds: [],
      serviceName: '',
      customerName: '',
      startTime: new Date(),
      endTime: new Date(),
      status: 'pending',
      cleaningTime: 0,
      notes: '',
      createdAt: new Date()
    };
  }
  
  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Buchungsdetails...');
    
    // Load cart items
    this.cartItems = this.cartService.getItems();
    
    if (this.cartItems.length === 0) {
      alert('Keine Dienstleistungen ausgewählt.');
      this.router.navigate(['/services']);
      return;
    }
    
    // Get provider
    const providerId = this.cartService.getProviderId();
    if (!providerId) {
      alert('Kein Dienstleister ausgewählt.');
      this.router.navigate(['/']);
      return;
    }
    
    // Load provider details
    const providerSub = this.providerService.getProvider(providerId).subscribe({
      next: (provider) => {
        this.provider = provider || null;
        this.loadingService.setLoading(false);
      },
      error: (error) => {
        console.error('Error loading provider:', error);
        this.loadingService.setLoading(false);
        alert('Fehler beim Laden der Dienstleister-Details.');
      }
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
    
    this.selectedTime = sessionStorage.getItem('selectedTime');
    
    if (!this.selectedDate || !this.selectedTime) {
      alert('Bitte wählen Sie einen Termin aus.');
      const providerId = this.cartService.getProviderId();
      if (providerId) {
        this.router.navigate(['/appointment-selection', providerId]);
      } else {
        this.router.navigate(['/']);
      }
      return;
    }
    
    // Get customer details if logged in
    const userSub = this.authService.user.subscribe(userWithCustomer => {
      if (!userWithCustomer.user) {
        // User is not logged in, redirect to login
        this.router.navigate(['/booking-login']);
        return;
      }
      
      if (userWithCustomer.customer) {
        this.customer = userWithCustomer.customer;
      }
      this.loadingService.setLoading(false);
    });
    this.subscriptions.push(userSub);
  }

  // Method to handle booking confirmation
  confirmBooking(): void {
    if (!this.termsAccepted) {
      alert('Bitte akzeptieren Sie die Geschäftsbedingungen.');
      return;
    }
    
    if (!this.customer || !this.provider || !this.selectedDate || !this.selectedTime) {
      this.loadingService.setLoading(false);
      alert('Es fehlen notwendige Daten für die Buchung.');
      return;
    }
    
    this.loadingService.setLoading(true, 'Buchung wird erstellt...');
    
    // Generate booking number
    this.bookingNumber = 'BK-' + new Date().getFullYear() + 
                       Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    // Parse time string to create appointment date
    const [hours, minutes] = this.selectedTime.split(':').map(Number);
    const appointmentDate = new Date(this.selectedDate);
    appointmentDate.setHours(hours, minutes, 0, 0);
    
    // Calculate end time based on service duration
    const totalDuration = this.getTotalDuration();
    const endTime = new Date(appointmentDate);
    endTime.setMinutes(endTime.getMinutes() + totalDuration);
  
    // Create appointment object
    const serviceIds = this.cartItems.map(service => service.id);
    
    const appointment: Appointment = {
      id: uuidv4(),
      // Use the id field instead of userId for both customer and provider
      customerId: this.customer.id,
      providerId: this.provider.id,
      serviceIds: serviceIds,
      startTime: appointmentDate,
      endTime: endTime,
      status: 'pending',
      cleaningTime: 15, // 15 minutes cleaning time
      createdAt: new Date(),
      // Additional fields for UI display
      serviceName: this.cartItems[0].name,
      customerName: `${this.customer.firstName} ${this.customer.lastName}`,
      notes: localStorage.getItem('notes') ?? ''
    };
      
    this.savedAppointment = appointment;
    
    // Save appointment to Firestore using the new API
    this.appointmentService.createAppointment(appointment)
      .then((appointmentId) => {
        // Update the saved appointment with the returned ID if needed
        this.savedAppointment.id = appointmentId;
        
        // Show success message
        this.showSuccessMessage = true;

        // Clear cart and session storage
        this.cartService.clearCart();
        sessionStorage.removeItem('selectedDate');
        sessionStorage.removeItem('selectedTime');
        localStorage.removeItem('notes');
        
        this.loadingService.setLoading(false);
      })
      .catch(error => {
        console.error('Error creating appointment:', error);
        this.loadingService.setLoading(false);
        alert('Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.');
      });
  }
  
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  // Helper methods - make all methods used in the template public
  public formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }
  
  public formatPrice(price: number): string {
    return price.toFixed(2).replace('.', ',') + ' €';
  }
  
  public formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours} Std. ${remainingMinutes > 0 ? remainingMinutes + ' Min.' : ''}`;
    } else {
      return `${minutes} Min.`;
    }
  }
  
  public getTotalPrice(): number {
    return this.cartItems.reduce((total, item) => total + item.price, 0);
  }
  
  public getTotalDuration(): number {
    return this.cartItems.reduce((total, item) => total + item.duration, 0);
  }
  
  // UI interaction methods
  public selectPayment(payment: string): void {
    // For now, only allow "vor-ort" payment
    if (payment === 'vor-ort') {
      this.selectedPayment = payment;
    }
  }
  
  public goBack(): void {
    this.router.navigate(['/booking-overview']);
  }
  
  public navigateHome(): void {
    // If provider is available, navigate to provider page
    if (this.provider && this.provider.businessName) {
      this.router.navigate(['/', this.provider.businessName]);
    } else {
      this.router.navigate(['/']);
    }
  }
}