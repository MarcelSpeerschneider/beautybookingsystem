// src/app/services/appointment-creation.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Appointment } from '../models/appointment.model';
import { AppointmentService } from './appointment.service';
import { Service } from '../models/service.model';
import { CartService } from './cart.service';
import { AuthenticationService } from './authentication.service';

/**
 * Service zur Erstellung von Terminen im Buchungsprozess.
 * Enthält Logik zur Validierung und zum Erstellen von Terminen basierend
 * auf ausgewählten Dienstleistungen, Datum und Uhrzeit.
 */
@Injectable({
  providedIn: 'root'
})
export class AppointmentCreationService {
  private appointmentService = inject(AppointmentService);
  private cartService = inject(CartService);
  private authService = inject(AuthenticationService);
  
  /**
   * Erstellt einen neuen Termin basierend auf den ausgewählten Parametern
   * im Buchungsprozess.
   * 
   * @returns Observable mit der ID des erstellten Termins oder Fehlermeldung
   */
  createAppointment(
    selectedService: Service, 
    selectedDate: Date, 
    selectedTime: Date,
    notes: string = ''
  ): Observable<string> {
    // Aktuelle Benutzer-ID abrufen
    const currentUser = this.authService.getUser();
    if (!currentUser) {
      return throwError(() => new Error('Benutzer ist nicht angemeldet.'));
    }
    
    // Provider-ID vom CartService abrufen
    const providerId = this.cartService.getProviderId();
    if (!providerId) {
      return throwError(() => new Error('Keine Provider-ID gefunden.'));
    }
    
    // Start- und Endzeit berechnen
    const startTime = new Date(selectedDate);
    startTime.setHours(
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      0,
      0
    );
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + selectedService.duration);
    
    // Termin erstellen
    const appointment: Appointment = {
      customerId: currentUser.uid,
      providerId: providerId,
      serviceIds: [selectedService.id],
      serviceName: selectedService.name,
      customerName: currentUser.displayName || 'Unbekannter Kunde',
      startTime: startTime,
      endTime: endTime,
      status: 'pending', // Neue Termine sind standardmäßig "ausstehend"
      cleaningTime: 15, // Standard-Reinigungszeit
      notes: notes,
      createdAt: new Date()
    };
    
    // Termin über den AppointmentService erstellen
    return from(this.appointmentService.createAppointment(appointment)).pipe(
      catchError(error => {
        // Bei Überschneidungsfehlern benutzerfreundliche Nachricht zurückgeben
        if (error.message && error.message.includes('überschneidet')) {
          return throwError(() => new Error(
            'Der gewählte Termin ist nicht mehr verfügbar. Bitte wählen Sie einen anderen Zeitpunkt.'
          ));
        }
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Bereinigt alle Buchungs-bezogenen Daten nach erfolgreicher Buchung
   */
  cleanupAfterBooking(): void {
    // Warenkorb leeren und Buchungsstatus zurücksetzen
    this.cartService.cleanupBookingData();
    
    // Zwischengespeicherte Datums- und Zeitwerte entfernen
    localStorage.removeItem('selectedDate');
    localStorage.removeItem('selectedTime');
  }
}