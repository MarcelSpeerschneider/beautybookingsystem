import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppointmentService } from '../../../services/appointment.service';
import { ProviderService } from '../../../services/provider.service';
import { CartService } from '../../../services/cart.service';
import { LoadingService } from '../../../services/loading.service';
import { ZoneUtils } from '../../../utils/zone-utils';
import { NgZone } from '@angular/core';

@Component({
  selector: 'app-booking-confirmation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-confirmation.component.html',
  styleUrls: ['./booking-confirmation.component.css']
})
export class BookingConfirmationComponent implements OnInit {
  // Services
  private router = inject(Router);
  private appointmentService = inject(AppointmentService);
  private providerService = inject(ProviderService);
  private cartService = inject(CartService);
  private loadingService = inject(LoadingService);
  private ngZone = inject(NgZone);

  // Data for the template
  appointment: any = null;
  provider: any = null;
  errorMessage: string = '';

  ngOnInit(): void {
    ZoneUtils.wrapPromise(async () => {
      try {
        // Get appointment ID and provider ID from localStorage
        const appointmentId = localStorage.getItem('confirmedAppointmentId');
        const providerId = localStorage.getItem('confirmedProviderId');
        
        if (!appointmentId) {
          console.error('No appointment ID found in localStorage');
          this.router.navigate(['/']);
          return;
        }
        
        // Load appointment details
        this.loadingService.setLoading(true, 'Lade Termindetails...');
        console.log('Loading appointment with ID:', appointmentId);
        
        this.appointmentService.getAppointment(appointmentId).subscribe({
          next: (appointment) => {
            console.log('Appointment loaded:', appointment);
            this.appointment = appointment;
            
            // If provider ID is available, load provider details
            if (providerId) {
              console.log('Loading provider with ID:', providerId);
              this.providerService.getProvider(providerId).subscribe({
                next: (provider) => {
                  console.log('Provider loaded:', provider);
                  this.provider = provider;
                  this.loadingService.setLoading(false);
                },
                error: (error) => {
                  console.error('Error loading provider:', error);
                  this.loadingService.setLoading(false);
                }
              });
            } else {
              // Try to use the provider ID from the appointment
              if (appointment && appointment.providerId) {
                console.log('Using provider ID from appointment:', appointment.providerId);
                this.providerService.getProvider(appointment.providerId).subscribe({
                  next: (provider) => {
                    console.log('Provider loaded from appointment ID:', provider);
                    this.provider = provider;
                    this.loadingService.setLoading(false);
                  },
                  error: (error) => {
                    console.error('Error loading provider from appointment ID:', error);
                    this.loadingService.setLoading(false);
                  }
                });
              } else {
                this.loadingService.setLoading(false);
              }
            }
          },
          error: (error) => {
            console.error('Error loading appointment:', error);
            this.loadingService.setLoading(false);
            this.errorMessage = 'Der Termin konnte nicht gefunden werden.';
          }
        });
        
        // Clean up temporary data after 2 seconds
        setTimeout(() => {
          this.cartService.cleanupBookingData();
          localStorage.removeItem('confirmedAppointmentId');
          localStorage.removeItem('confirmedProviderId');
        }, 2000);
      } catch (error) {
        console.error('Error in ngOnInit:', error);
        this.loadingService.setLoading(false);
        this.errorMessage = 'Ein Fehler ist aufgetreten.';
      }
    }, this.ngZone);
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  formatDate(date: any): string {
    if (!date) return 'Nicht verfügbar';
    
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Ungültiges Datum';
    }
  }

  formatTime(date: any): string {
    if (!date) return 'Nicht verfügbar';
    
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Ungültige Zeit';
    }
  }
}