import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import { Service } from '../../../models/service.model';
import { Provider } from '../../../models/provider.model';
import { ProviderService } from '../../../services/provider.service';
import { CartService } from '../../../services/cart.service';
import { LoadingService } from '../../../services/loading.service';
import { TimeSlotService, TimeSlot } from '../../../services/time-slot.service';

@Component({
  selector: 'app-appointment-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointment-selection.component.html',
  styleUrls: ['./appointment-selection.component.css'],
})
export class AppointmentSelectionComponent implements OnInit, OnDestroy {
  providerId: string | null = null;
  provider: Provider | null = null;
  selectedService: Service | null = null;
  
  // Datum und Zeitauswahl
  selectedDate: Date = new Date();
  availableTimeSlots: TimeSlot[] = [];
  selectedTimeSlot: TimeSlot | null = null;
  
  // Kalender-Navigation
  calendarDays: Date[] = [];
  currentMonth: Date = new Date();
  
  private subscriptions: Subscription[] = [];
  
  // Services via dependency injection
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private providerService = inject(ProviderService);
  private cartService = inject(CartService);
  private loadingService = inject(LoadingService);
  private timeSlotService = inject(TimeSlotService);
  
  ngOnInit(): void {
    this.loadingService.setLoading(true, 'Lade Buchungsseite...');
    
    // Parameter aus URL extrahieren und Daten laden
    const routeSub = this.route.paramMap.pipe(
      tap(params => {
        this.providerId = params.get('userId');
        
        // Aus cart holen, falls vorhanden
        this.selectedService = this.cartService.getItems()[0] || null;
        
        if (!this.providerId) {
          console.error('Provider ID is missing in URL');
          this.router.navigate(['/']);
          return;
        }
        
        // Provider-ID für spätere Verwendung speichern
        this.cartService.setProviderId(this.providerId);
      }),
      // Provider-Daten laden
      switchMap(() => {
        if (!this.providerId) {
          return [];
        }
        return this.providerService.getProvider(this.providerId);
      })
    ).subscribe({
      next: (provider) => {
        if (provider) {
          this.provider = provider;
          
          // Kalender für aktuelle Monatsansicht generieren
          this.generateCalendarDays();
          
          // Wenn bereits ein Service ausgewählt ist, Zeitslots laden
          if (this.selectedService) {
            this.loadAvailableTimeSlots();
          }
        } else {
          console.error('Provider not found');
          this.router.navigate(['/']);
        }
        this.loadingService.setLoading(false);
      },
      error: (error) => {
        console.error('Error loading provider:', error);
        this.loadingService.setLoading(false);
        this.router.navigate(['/']);
      }
    });
    
    this.subscriptions.push(routeSub);
  }
  
  ngOnDestroy(): void {
    // Alle Subscriptions bereinigen
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  /**
   * Navigation durch Monate
   */
  navigateMonth(delta: number): void {
    const newMonth = new Date(this.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + delta);
    this.currentMonth = newMonth;
    this.generateCalendarDays();
  }
  
  /**
   * Lädt alle verfügbaren Zeitslots für das gewählte Datum und die
   * gewählte Dienstleistung.
   */
  loadAvailableTimeSlots(): void {
    if (!this.providerId || !this.selectedService) {
      this.availableTimeSlots = [];
      return;
    }
    
    this.loadingService.setLoading(true, 'Lade verfügbare Termine...');
    
    const timeSlotsSub = this.timeSlotService
      .getAvailableTimeSlots(this.selectedDate, this.providerId, this.selectedService)
      .subscribe({
        next: (timeSlots) => {
          this.availableTimeSlots = timeSlots;
          // Bisherige Auswahl zurücksetzen falls nicht mehr verfügbar
          if (this.selectedTimeSlot) {
            const stillAvailable = this.availableTimeSlots.find(
              slot => this.isSameTime(slot.time, this.selectedTimeSlot!.time)
            );
            if (!stillAvailable || !stillAvailable.available) {
              this.selectedTimeSlot = null;
            }
          }
          this.loadingService.setLoading(false);
        },
        error: (error) => {
          console.error('Error loading time slots:', error);
          this.availableTimeSlots = [];
          this.loadingService.setLoading(false);
        }
      });
      
    this.subscriptions.push(timeSlotsSub);
  }
  
  /**
   * Wählt einen Zeitslot aus. Nur verfügbare Slots können ausgewählt werden.
   */
  selectTimeSlot(slot: TimeSlot): void {
    if (!slot.available) {
      return; // Nichts tun bei nicht verfügbaren Slots
    }
    
    // Bisherige Auswahl zurücksetzen
    this.availableTimeSlots.forEach(s => s.isSelected = false);
    
    // Neue Auswahl setzen
    slot.isSelected = true;
    this.selectedTimeSlot = slot;
  }
  
  /**
   * Wechselt das ausgewählte Datum und lädt neue Zeitslots
   */
  selectDate(date: Date): void {
    this.selectedDate = new Date(date);
    this.selectedTimeSlot = null;
    this.loadAvailableTimeSlots();
  }
  
  /**
   * Geht zum nächsten Schritt im Buchungsprozess.
   * Speichert ausgewählte Zeit in localStorage für spätere Verwendung.
   */
  proceedToBooking(): void {
    if (!this.selectedService || !this.selectedTimeSlot || !this.providerId) {
      alert('Bitte wählen Sie einen Dienst und einen Zeitpunkt aus.');
      return;
    }
    
    // Speichert die ausgewählte Zeit für die spätere Verarbeitung
    localStorage.setItem('selectedDate', this.selectedDate.toISOString());
    localStorage.setItem('selectedTime', this.selectedTimeSlot.time.toISOString());
    localStorage.setItem('bookingFlow', 'active');
    
    // Zur Login- oder Übersichtsseite navigieren
    this.router.navigate(['/booking-login', this.providerId]);
  }
  
  /**
   * Generiert ein Array von Tagen für die Kalenderansicht
   */
  generateCalendarDays(): void {
    const days: Date[] = [];
    const today = new Date();
    
    // Nur die nächsten 30 Tage anzeigen, beginnend mit heute
    for (let i = 0; i < 30; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      days.push(day);
    }
    
    this.calendarDays = days;
  }
  
  /**
   * Hilfsmethode: Prüft ob zwei Zeitpunkte gleich sind (ohne Sekunden/Millisekunden)
   */
  isSameTime(date1: Date, date2: Date): boolean {
    return date1.getHours() === date2.getHours() && 
           date1.getMinutes() === date2.getMinutes();
  }
  
  /**
   * Formatiert einen Zeitpunkt als lesbaren String
   */
  formatTime(date: Date): string {
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  }
  
  /**
   * Prüft ob ein Datum heute ist
   */
  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }
  
  /**
   * Prüft ob ein Datum das aktuell ausgewählte ist
   */
  isSelected(date: Date): boolean {
    return date.getDate() === this.selectedDate.getDate() &&
           date.getMonth() === this.selectedDate.getMonth() &&
           date.getFullYear() === this.selectedDate.getFullYear();
  }
  
  /**
   * Navigiert zurück zur Dienstleistungsübersicht
   */
  goBack(): void {
    // Go back to provider page
    if (this.provider && this.provider.businessName) {
      this.router.navigate(['/', this.provider.businessName]);
    } else {
      this.router.navigate(['/']); 
    }
  }
}