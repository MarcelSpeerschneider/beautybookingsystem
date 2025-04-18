import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Service } from '../../../models/service.model';
import { CartService } from '../../../services/cart.service';
import { AppointmentCreationService } from '../../../services/appointment-creation.service';
import { LoadingService } from '../../../services/loading.service';
import { AuthenticationService } from '../../../services/authentication.service';
import { ProviderService } from '../../../services/provider.service';

@Component({
  selector: 'app-booking-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-overview.component.html',
  styleUrls: ['./booking-overview.component.css']
})
export class BookingOverviewComponent implements OnInit, OnDestroy {
  // Services
  private cartService = inject(CartService);
  private router = inject(Router);
  private loadingService = inject(LoadingService);
  private appointmentCreationService = inject(AppointmentCreationService);
  private authService = inject(AuthenticationService);
  private providerService = inject(ProviderService);

  // Subscription management
  private subscriptions: Subscription[] = [];

  // Booking data
  selectedService: Service | null = null;
  selectedDate: Date | null = null;
  selectedTime: Date | null = null;
  cartItems: Service[] = [];
  totalPrice: number = 0;
  totalDuration: number = 0;
  errorMessage: string = '';
  
  // Fehlende Eigenschaften aus dem Template hinzufügen
  providerName: string = '';
  notes: string = '';

  ngOnInit(): void {
    // Load cart items
    this.loadCartItems();

    // Check if date and time were selected
    const selectedDateStr = localStorage.getItem('selectedDate');
    const selectedTimeStr = localStorage.getItem('selectedTime');

    if (selectedDateStr && selectedTimeStr) {
      this.selectedDate = new Date(selectedDateStr);
      this.selectedTime = new Date(selectedTimeStr);
    } else {
      // If no date/time was selected, go back to appointment selection
      const providerId = this.cartService.getProviderId();
      if (providerId) {
        this.router.navigate(['/appointment-selection', providerId]);
      } else {
        this.router.navigate(['/']);
      }
    }
    
    // Lade Provider-Daten
    this.loadProviderData();
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadCartItems(): void {
    const cartSub = this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.calculateTotals();
      
      // Use the first service in the cart
      if (items.length > 0) {
        this.selectedService = items[0];
      } else {
        // If cart is empty, go back to services
        const providerId = this.cartService.getProviderId();
        if (providerId) {
          this.router.navigate(['/services', providerId]);
        } else {
          this.router.navigate(['/']);
        }
      }
    });
    
    this.subscriptions.push(cartSub);
  }
  
  loadProviderData(): void {
    const providerId = this.cartService.getProviderId();
    if (providerId) {
      this.providerService.getProvider(providerId).subscribe({
        next: (provider) => {
          if (provider) {
            this.providerName = provider.businessName || 'Unbekannter Anbieter';
          }
        },
        error: (error) => {
          console.error('Fehler beim Laden der Anbieterinformationen:', error);
        }
      });
    }
  }

  calculateTotals(): void {
    this.totalPrice = this.cartItems.reduce((total, item) => total + item.price, 0);
    this.totalDuration = this.cartItems.reduce((total, item) => total + item.duration, 0);
  }

  formatDate(date: Date | null): string {
    if (!date) return 'Nicht ausgewählt';
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatTime(date: Date | null): string {
    if (!date) return 'Nicht ausgewählt';
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Die fehlende Methode für den "Zurück"-Button
  cancelBooking(): void {
    const providerId = this.cartService.getProviderId();
    if (providerId) {
      this.router.navigate(['/appointment-selection', providerId]);
    } else {
      this.router.navigate(['/']);
    }
  }

  confirmBooking(): void {
    this.loadingService.setLoading(true, 'Bestätige Buchung...');
    
    // Get provider ID for confirmation page
    const providerId = this.cartService.getProviderId();
    
    if (!this.selectedService || !this.selectedDate || !this.selectedTime) {
      this.errorMessage = 'Bitte wählen Sie zuerst Dienstleistung, Datum und Uhrzeit.';
      this.loadingService.setLoading(false);
      return;
    }
    
    // Create appointment
    this.appointmentCreationService.createAppointment(
      this.selectedService,
      this.selectedDate,
      this.selectedTime,
      this.notes
    ).subscribe({
      next: (appointmentId) => {
        this.loadingService.setLoading(false);
        
        // Save appointment ID and provider ID for confirmation page
        localStorage.setItem('confirmedAppointmentId', appointmentId);
        localStorage.setItem('confirmedProviderId', providerId || '');
        
        // Navigate to confirmation page WITHOUT query parameters
        this.router.navigate(['/booking-confirmation']);
      },
      error: (error) => {
        this.loadingService.setLoading(false);
        this.errorMessage = `Fehler bei der Buchung: ${error.message}`;
      }
    });
  }
}