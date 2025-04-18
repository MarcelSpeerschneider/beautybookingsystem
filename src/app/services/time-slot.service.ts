// src/app/services/time-slot.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AppointmentService } from './appointment.service';
import { AppointmentWithId } from './appointment.service';
import { Service } from '../models/service.model';
import { Provider } from '../models/provider.model';
import { BusinessHours } from '../models/business-hours.model';

export interface TimeSlot {
  time: Date;
  available: boolean;
  isSelected?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TimeSlotService {
  private appointmentService = inject(AppointmentService);
  
  // Zeitslot-Intervall in Minuten (z.B. 15-Minuten-Intervalle)
  private readonly SLOT_INTERVAL_MIN = 15;
  
  // Standardöffnungszeiten falls keine Provider-spezifischen vorhanden sind
  private defaultBusinessHours = {
    openingTime: '09:00',
    closingTime: '18:00'
  };
  
  /**
   * Generiert alle verfügbaren Zeitslots für einen bestimmten Tag und Provider
   * unter Berücksichtigung der ausgewählten Dienstleistung und bestehender Termine
   */
  getAvailableTimeSlots(
    date: Date,
    providerId: string,
    selectedService: Service | null
  ): Observable<TimeSlot[]> {
    // Wenn keine Dienstleistung ausgewählt wurde, leere Liste zurückgeben
    if (!selectedService) {
      return of([]);
    }
    
    // 1. Öffnungszeiten für den Tag und Provider abrufen
    // 2. Bestehende Termine für den Tag und Provider abrufen
    // 3. Verfügbare Zeitslots basierend auf beiden berechnen
    
    // Zuerst holen wir die Geschäftszeiten für den gewählten Wochentag
    // Hier könnten wir den BusinessHoursService nutzen, falls vorhanden
    const businessHours = this.getBusinessHoursForDay(date, providerId);
    
    // Dann holen wir alle bestehenden Termine für diesen Tag
    return businessHours.pipe(
      switchMap(hours => {
        // Alle möglichen Zeitslots basierend auf den Öffnungszeiten erzeugen
        const allTimeSlots = this.generateTimeSlots(date, hours, selectedService.duration);
        
        // Bestehende Termine für den Tag abrufen
        return this.appointmentService.getAppointmentsByUserAndDate(
          providerId, 
          date, 
          true // isProvider = true
        ).pipe(
          map(appointments => {
            // Bestehende Termine berücksichtigen und Zeitslots filtern
            return this.filterUnavailableTimeSlots(
              allTimeSlots, 
              appointments, 
              selectedService.duration
            );
          })
        );
      }),
      catchError(error => {
        console.error('Error getting available time slots:', error);
        return of([]);
      })
    );
  }
  
  /**
   * Simuliert das Abrufen der Geschäftszeiten für einen bestimmten Tag
   * In einer realen Anwendung würde dieser Methode BusinessHours vom Server abrufen
   */
  private getBusinessHoursForDay(date: Date, providerId: string): Observable<BusinessHours> {
    // Dies ist eine Platzhaltermethode - hier sollte die tatsächliche Logik zum Abrufen 
    // der Geschäftszeiten aus Firestore oder einem anderen Service eingebaut werden
    
    // Ermittle den Wochentag (0 = Sonntag, 1 = Montag, ...)
    const dayOfWeek = date.getDay();
    
    // Hier simulieren wir unterschiedliche Öffnungszeiten je nach Wochentag
    // In einer realen Anwendung würden diese aus der Datenbank kommen
    let businessHours: BusinessHours = {
      businessHoursId: 'placeholder-id',
      providerId: providerId,
      dayOfWeek: dayOfWeek.toString(),
      openingTime: this.defaultBusinessHours.openingTime,
      closingTime: this.defaultBusinessHours.closingTime
    };
    
    // Beispiel für spezifische Tage - Samstags kürzere Stunden, Sonntags geschlossen
    if (dayOfWeek === 6) { // Samstag
      businessHours.openingTime = '10:00';
      businessHours.closingTime = '14:00';
    } else if (dayOfWeek === 0) { // Sonntag
      businessHours.openingTime = '00:00'; // Geschlossen
      businessHours.closingTime = '00:00'; // Geschlossen
    }
    
    return of(businessHours);
  }
  
  /**
   * Generiert alle möglichen Zeitslots für einen Tag basierend auf den Geschäftszeiten
   */
  private generateTimeSlots(
    date: Date, 
    businessHours: BusinessHours,
    serviceDuration: number
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    
    // Wenn die Öffnungs- und Schließzeiten identisch sind, ist der Laden geschlossen
    if (businessHours.openingTime === businessHours.closingTime) {
      return slots; // Leeres Array zurückgeben
    }
    
    // Öffnungs- und Schließzeiten parsen
    const [openHour, openMinute] = businessHours.openingTime.split(':').map(Number);
    const [closeHour, closeMinute] = businessHours.closingTime.split(':').map(Number);
    
    // Startzeit des Tages erzeugen
    const startTime = new Date(date);
    startTime.setHours(openHour, openMinute, 0, 0);
    
    // Endzeit des Tages erzeugen
    const endTime = new Date(date);
    endTime.setHours(closeHour, closeMinute, 0, 0);
    
    // Berücksichtige, dass der letzte Termin so viel Zeit vor Schließung starten muss,
    // wie die Dienstleistung dauert
    const latestStartTime = new Date(endTime);
    latestStartTime.setMinutes(latestStartTime.getMinutes() - serviceDuration);
    
    // Generiere Zeitslots in Intervallen
    const currentTime = new Date(startTime);
    while (currentTime <= latestStartTime) {
      slots.push({
        time: new Date(currentTime),
        available: true // Zunächst als verfügbar markieren
      });
      
      // Zum nächsten Zeitslot springen
      currentTime.setMinutes(currentTime.getMinutes() + this.SLOT_INTERVAL_MIN);
    }
    
    return slots;
  }
  
  /**
   * Filtert Zeitslots basierend auf bestehenden Terminen
   */
  private filterUnavailableTimeSlots(
    allSlots: TimeSlot[], 
    existingAppointments: AppointmentWithId[],
    serviceDuration: number
  ): TimeSlot[] {
    // Wenn keine Slots oder keine Termine vorhanden sind, einfach alle Slots zurückgeben
    if (allSlots.length === 0 || existingAppointments.length === 0) {
      return allSlots;
    }
    
    // Prüfe jeden Zeitslot auf Überschneidungen mit bestehenden Terminen
    return allSlots.map(slot => {
      // Berechne Endzeit des potenziellen Termins für diesen Slot
      const potentialEndTime = new Date(slot.time);
      potentialEndTime.setMinutes(potentialEndTime.getMinutes() + serviceDuration);
      
      // Prüfe ob sich dieser Zeitslot mit bestehenden Terminen überschneidet
      const hasOverlap = existingAppointments.some(appointment => {
        // Parse appointment times if necessary
        const appointmentStart = appointment.startTime instanceof Date ? 
                              appointment.startTime : 
                              new Date(appointment.startTime);
        const appointmentEnd = appointment.endTime instanceof Date ? 
                            appointment.endTime : 
                            new Date(appointment.endTime);
        
        // Ein Termin überschneidet sich, wenn:
        // - der Start des neuen Termins vor dem Ende eines bestehenden liegt UND
        // - das Ende des neuen Termins nach dem Start eines bestehenden liegt
        return (
          slot.time < appointmentEnd && 
          potentialEndTime > appointmentStart && 
          // Nur bestätigte und anstehende Termine berücksichtigen
          (appointment.status === 'confirmed' || appointment.status === 'pending')
        );
      });
      
      // Return the slot with updated availability
      return {
        ...slot,
        available: !hasOverlap
      };
    });
  }
  
  /**
   * Hilfsfunktion zum Formatieren eines Datums im HH:MM-Format
   */
  formatTimeSlot(date: Date): string {
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  }
}