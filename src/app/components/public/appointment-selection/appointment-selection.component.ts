import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProviderService } from '../../../services/provider.service';
import { AppointmentService } from '../../../services/appointment.service';
import { ServiceService } from '../../../services/service.service';
import { CartService } from '../../../services/cart.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { LoadingService } from '../../../services/loading.service';
import { Provider } from '../../../models/provider.model';
import { Service } from '../../../models/service.model';

@Component({
  selector: 'app-appointment-selection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './appointment-selection.component.html',
  styleUrls: ['./appointment-selection.component.css']
})
export class AppointmentSelectionComponent implements OnInit, OnDestroy {
  providerId: string | null = null;
  provider: Provider | null = null;
  cartItems: Service[] = [];
  
  currentDate: Date = new Date();
  selectedDate: Date | null = null;
  selectedTime: string | null = null;
  availableDates: Date[] = [];
  availableTimeSlots: string[] = [];
  
  private subscriptions: Subscription[] = [];
  
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private providerService = inject(ProviderService);
  private appointmentService = inject(AppointmentService);
  private serviceService = inject(ServiceService);
  private cartService = inject(CartService);
  private authService = inject(AuthenticationService);
  private loadingService = inject(LoadingService);
  
  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Terminauswahl...');
    
    // Get cart items
    this.cartItems = this.cartService.getItems();
    
    if (this.cartItems.length === 0) {
      alert('Bitte wählen Sie zuerst Dienstleistungen aus.');
      this.router.navigate(['/services']);
      return;
    }
    
    // Get provider ID from route parameter
    const routeSub = this.route.paramMap.subscribe(params => {
      this.providerId = params.get('providerId');
      
      if (!this.providerId) {
        // Try to get provider ID from cart
        this.providerId = this.cartService.getProviderId();
      }
      
      if (this.providerId) {
        // Store provider ID in cart
        this.cartService.setProviderId(this.providerId);
        
        // Load provider details
        this.loadProvider(this.providerId);
        
        // Generate available dates (next 14 days)
        this.generateAvailableDates();
      } else {
        this.loadingService.setLoading(false);
        this.router.navigate(['/services']); // Redirect if no provider ID
      }
    });
    
    this.subscriptions.push(routeSub);
  }
  
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  loadProvider(providerId: string): void {
    const providerSub = this.providerService.getProvider(providerId)
      .subscribe(provider => {
        this.provider = provider || null;
        this.loadingService.setLoading(false);
      });
      
    this.subscriptions.push(providerSub);
  }
  
  generateAvailableDates(): void {
    const dates: Date[] = [];
    const today = new Date();
    
    // Generate dates for the next 14 days
    for (let i = 1; i <= 14; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      
      // Skip weekends if provider doesn't work weekends
      // This is a simple example - you'd need to check the actual provider's business hours
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
        dates.push(date);
      }
    }
    
    this.availableDates = dates;
  }
  
  generateTimeSlots(date: Date): void {
    if (!this.providerId) return;
    
    // In a real implementation, you'd check the provider's business hours
    // and existing appointments to determine available slots
    
    // For now, we'll generate slots from 9 AM to 5 PM every 30 minutes
    const slots: string[] = [];
    const startHour = 9;
    const endHour = 17;
    
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute of [0, 30]) {
        // Skip lunch hour (12-1 PM)
        if (hour === 12 && minute === 0) continue;
        if (hour === 12 && minute === 30) continue;
        
        const hourString = hour.toString().padStart(2, '0');
        const minuteString = minute.toString().padStart(2, '0');
        slots.push(`${hourString}:${minuteString}`);
      }
    }
    
    // Random unavailable slots for demo
    this.availableTimeSlots = slots.filter(() => Math.random() > 0.3);
  }
  
  selectDate(date: Date): void {
    this.selectedDate = date;
    this.selectedTime = null;
    this.generateTimeSlots(date);
  }
  
  selectTime(time: string): void {
    this.selectedTime = time;
  }
  
  goBack(): void {
    if (this.providerId) {
      this.router.navigate(['/services', this.providerId]);
    } else {
      this.router.navigate(['/services']);
    }
  }
  
  continueToBilling(): void {
    // Check if user is logged in
    this.authService.isLoggedIn().subscribe(isLoggedIn => {
      if (isLoggedIn) {
        // User is logged in, proceed to confirmation
        this.router.navigate(['/booking-confirmation']);
      } else {
        // User is not logged in, redirect to login/register
        // Store appointment details in session storage
        sessionStorage.setItem('selectedDate', JSON.stringify(this.selectedDate));
        sessionStorage.setItem('selectedTime', this.selectedTime || '');
        
        // Redirect to login with return URL
        this.router.navigate(['/login'], { 
          queryParams: { 
            returnUrl: '/booking-confirmation'
          }
        });
      }
    });
  }
  
  formatDate(date: Date): string {
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }
  
  formatTime(time: string): string {
    return `${time} Uhr`;
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
  
  formatPrice(price: number): string {
    return price.toFixed(2).replace('.', ',') + ' €';
  }
  
  getTotalPrice(): number {
    return this.cartItems.reduce((total, item) => total + item.price, 0);
  }
  
  getTotalDuration(): number {
    return this.cartItems.reduce((total, item) => total + item.duration, 0);
  }
}