// src/app/components/public/booking-overview/booking-overview.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CartService } from '../../../services/cart.service';
import { LoadingService } from '../../../services/loading.service';
import { AppointmentCreationService } from '../../../services/appointment-creation.service';
import { Service } from '../../../models/service.model';
import { ProviderService } from '../../../services/provider.service';

@Component({
  selector: 'app-booking-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-overview.component.html',
  styleUrls: ['./booking-overview.component.css']
})
export class BookingOverviewComponent implements OnInit {
  selectedService: Service | null = null;
  selectedDate: Date | null = null;
  selectedTime: Date | null = null;
  providerName: string = '';
  notes: string = '';
  
  // Für Fehlermeldungen und Erfolgsmeldungen
  errorMessage: string = '';
  successMessage: string = '';
  
  private cartService = inject(CartService);
  private router = inject(Router);
  private loadingService = inject(LoadingService);
  private appointmentCreationService = inject(AppointmentCreationService);
  private providerService = inject(ProviderService);
  
  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Buchungsübersicht...');
    
    // Prüfen, ob wir uns im aktiven Buchungsflow befinden
    const bookingFlow = localStorage.getItem('bookingFlow');
    if (bookingFlow !== 'active') {
      console.error('No active booking flow');
      this.router.navigate(['/']);
      return;
    }
    
    // Gewählte Dienstleistung aus dem Cart abrufen
    const cartItems = this.cartService.getItems();
    if (cartItems.length === 0) {
      console.error('No service in cart');
      this.router.navigate(['/']);
      return;
    }
    
    this.selectedService = cartItems[0];
    
    // Datum und Zeit aus localStorage abrufen
    const dateString = localStorage.getItem('selectedDate');
    const timeString = localStorage.getItem('selectedTime');
    
    if (!dateString || !timeString) {
      console.error('Missing date or time selection');
      this.router.navigate(['/']);
      return;
    }
    
    this.selectedDate = new Date(dateString);
    this.selectedTime = new Date(timeString);
    
    // Provider-Informationen laden
    const providerId = this.cartService.getProviderId();
    if (providerId) {
      this.providerService.getProvider(providerId).subscribe(provider => {
        if (provider) {
          this.providerName = provider.businessName;
        }
        this.loadingService.setLoading(false);
      });
    } else {
      this.loadingService.setLoading(false);
    }
  }
  
  confirmBooking(): void {
    if (!this.selectedService || !this.selectedDate || !this.selectedTime) {
      this.errorMessage = 'Fehlende Buchungsinformationen. Bitte beginnen Sie den Buchungsprozess erneut.';
      return;
    }
    
    this.loadingService.setLoading(true, 'Termin wird gebucht...');
    this.errorMessage = '';
    
    this.appointmentCreationService.createAppointment(
      this.selectedService,
      this.selectedDate,
      this.selectedTime,
      this.notes
    ).subscribe({
      next: (appointmentId) => {
        console.log('Appointment created with ID:', appointmentId);
        this.loadingService.setLoading(false);
        
        // Buchungsdaten bereinigen
        this.appointmentCreationService.cleanupAfterBooking();
        
        // Zur Bestätigungsseite navigieren
        this.router.navigate(['/booking-confirmation'], { 
          queryParams: { appointmentId: appointmentId } 
        });
      },
      error: (error) => {
        console.error('Error creating appointment:', error);
        this.loadingService.setLoading(false);
        this.errorMessage = error.message || 'Fehler bei der Terminbuchung. Bitte versuchen Sie es später erneut.';
        
        // Wenn der Fehler eine Überschneidung meldet, zurück zur Terminauswahl navigieren
        if (error.message && error.message.includes('nicht mehr verfügbar')) {
          setTimeout(() => {
            // ProviderId aus Cart holen
            const providerId = this.cartService.getProviderId();
            if (providerId) {
              this.router.navigate(['/appointment-selection', providerId]);
            } else {
              this.router.navigate(['/']);
            }
          }, 3000); // 3 Sekunden warten, damit die Fehlermeldung gelesen werden kann
        }
      }
    });
  }
  
  cancelBooking(): void {
    // Zur vorherigen Seite zurückkehren
    window.history.back();
  }
  
  // Formatierungshilfen
  formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  
  formatTime(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
}