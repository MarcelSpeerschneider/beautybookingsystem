import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  collectionData, 
  docData, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  limit
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { LoadingService } from './loading.service';
import { ZoneUtils } from '../utils/zone-utils';
import { convertAppointmentDates } from '../utils/date-utils';
import { Appointment } from '../models/appointment.model';

// Typ mit ID für die Anzeige
export type AppointmentWithId = Appointment & { id: string };

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private readonly collectionName = 'appointments';
  
  // Injizierte Services
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private ngZone = inject(NgZone);
  private loadingService = inject(LoadingService);

  /**
   * Holt alle Termine aus der Datenbank
   */
  getAppointments(): Observable<AppointmentWithId[]> {
    return ZoneUtils.wrapObservable(() => {
      console.log('AppointmentService: Fetching all appointments');
      this.loadingService.setLoading(true, 'Lade Termine...');
      
      const appointmentsCollection = collection(this.firestore, this.collectionName);
      const limitedQuery = query(appointmentsCollection, limit(500));
      
      return collectionData(limitedQuery, { idField: 'id' }).pipe(
        map(data => {
          console.log(`Received ${data.length} total appointments`);
          this.loadingService.setLoading(false);
          return (data as any[]).map(item => convertAppointmentDates(item) as AppointmentWithId);
        }),
        catchError(error => {
          console.error('Error fetching all appointments:', error);
          this.loadingService.setLoading(false);
          return of([]);
        })
      );
    }, this.ngZone);
  }

  /**
   * Holt einen einzelnen Termin anhand seiner ID
   */
  getAppointment(appointmentId: string): Observable<AppointmentWithId | null> {
    return ZoneUtils.wrapObservable(() => {
      console.log(`AppointmentService: Fetching appointment with ID: ${appointmentId}`);
      this.loadingService.setLoading(true, 'Lade Termin...');
      
      const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
      
      return docData(appointmentDocument, { idField: 'id' }).pipe(
        map(data => {
          if (!data) {
            console.log(`No appointment found with ID: ${appointmentId}`);
            this.loadingService.setLoading(false);
            return null;
          }
          console.log(`Found appointment with ID: ${appointmentId}`);
          this.loadingService.setLoading(false);
          return convertAppointmentDates(data) as AppointmentWithId;
        }),
        catchError(error => {
          console.error(`Error fetching appointment with ID ${appointmentId}:`, error);
          this.loadingService.setLoading(false);
          return of(null);
        })
      );
    }, this.ngZone);
  }

  /**
   * Erstellt einen neuen Termin in der Datenbank
   * @returns Promise<string> mit der ID des erstellten Termins
   */
  createAppointment(appointment: Appointment): Promise<string> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.loadingService.setLoading(true, 'Erstelle Termin...');
        console.log('Creating new appointment:', appointment);
        
        // Stellen sicher, dass customerId vorhanden ist oder verwenden die aktuelle User-ID
        if (!appointment.customerId && this.auth.currentUser) {
          appointment.customerId = this.auth.currentUser.uid;
          console.log(`Set missing customerId to current user: ${appointment.customerId}`);
        }
        
        // Stelle sicher, dass Datum-Objekte korrekt formatiert sind
        const appointmentToSave = {
          ...appointment,
          createdAt: new Date(),
          startTime: appointment.startTime instanceof Date ? 
                     appointment.startTime : 
                     new Date(appointment.startTime),
          endTime: appointment.endTime instanceof Date ? 
                   appointment.endTime : 
                   new Date(appointment.endTime)
        };
        
        const appointmentsCollection = collection(this.firestore, this.collectionName);
        
        const docRef = await addDoc(appointmentsCollection, appointmentToSave);
        console.log('Appointment created successfully with ID:', docRef.id);
        this.loadingService.setLoading(false);
        return docRef.id;
      } catch (error) {
        console.error('Error creating appointment:', error);
        this.loadingService.setLoading(false);
        throw error;
      }
    }, this.ngZone);
  }

  /**
   * Aktualisiert einen bestehenden Termin
   * @returns Promise<boolean> mit dem Ergebnis der Aktualisierung
   */
  updateAppointment(appointment: AppointmentWithId): Promise<boolean> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.loadingService.setLoading(true, 'Aktualisiere Termin...');
        console.log('Updating appointment:', appointment);
        
        const { id, ...appointmentData } = appointment;
        
        const updatedAppointment = {
          ...appointmentData,
          updatedAt: new Date(),
          startTime: appointmentData.startTime instanceof Date ? 
                    appointmentData.startTime : 
                    new Date(appointmentData.startTime),
          endTime: appointmentData.endTime instanceof Date ? 
                   appointmentData.endTime : 
                   new Date(appointmentData.endTime)
        };
        
        const appointmentDocument = doc(this.firestore, this.collectionName, id);
        
        await updateDoc(appointmentDocument, updatedAppointment);
        console.log(`Appointment ${id} updated successfully`);
        this.loadingService.setLoading(false);
        return true;
      } catch (error) {
        console.error('Error updating appointment:', error);
        this.loadingService.setLoading(false);
        throw error;
      }
    }, this.ngZone);
  }

  /**
   * Löscht einen Termin aus der Datenbank
   * @returns Promise<boolean> mit dem Ergebnis der Löschung
   */
  deleteAppointment(appointmentId: string): Promise<boolean> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.loadingService.setLoading(true, 'Lösche Termin...');
        console.log(`Deleting appointment with ID: ${appointmentId}`);
        
        const appointmentDocument = doc(this.firestore, this.collectionName, appointmentId);
        
        await deleteDoc(appointmentDocument);
        console.log(`Appointment ${appointmentId} deleted successfully`);
        this.loadingService.setLoading(false);
        return true;
      } catch (error) {
        console.error('Error deleting appointment:', error);
        this.loadingService.setLoading(false);
        throw error;
      }
    }, this.ngZone);
  }

  /**
   * Holt alle Termine eines Kunden
   */
  getAppointmentsByCustomer(customerId: string): Observable<AppointmentWithId[]> {
    return ZoneUtils.wrapObservable(() => {
      console.log(`AppointmentService: Getting appointments for customer ID: ${customerId}`);
      this.loadingService.setLoading(true, 'Lade Kundentermine...');
      
      // Sicherheitscheck
      const currentUser = this.auth.currentUser;
      if (currentUser && currentUser.uid !== customerId) {
        console.warn(`Request customerId (${customerId}) doesn't match current user (${currentUser.uid})`);
      }
      
      // Erstelle die Abfrage
      const appointmentsCollection = collection(this.firestore, this.collectionName);
      const q = query(
        appointmentsCollection, 
        where('customerId', '==', customerId),
        limit(500)
      );
      
      return collectionData(q, { idField: 'id' }).pipe(
        tap(data => console.log(`Found ${data.length} appointments for customer ${customerId}`)),
        map(data => {
          console.log(`Processing ${data.length} appointments`);
          this.loadingService.setLoading(false);
          return (data as any[]).map(item => convertAppointmentDates(item) as AppointmentWithId);
        }),
        catchError(error => {
          console.error(`Error fetching appointments for customer ${customerId}:`, error);
          this.loadingService.setLoading(false);
          return of([]);
        })
      );
    }, this.ngZone);
  }

  /**
   * Holt alle Termine eines Providers
   */
  getAppointmentsByProvider(providerId: string): Observable<AppointmentWithId[]> {
    return ZoneUtils.wrapObservable(() => {
      console.log(`AppointmentService: Getting appointments for provider ID: ${providerId}`);
      this.loadingService.setLoading(true, 'Lade Anbietertermine...');
      
      // Sicherheitscheck
      const currentUser = this.auth.currentUser;
      if (currentUser && currentUser.uid !== providerId) {
        console.warn(`Request providerId (${providerId}) doesn't match current user (${currentUser.uid})`);
      }
      
      // Erstelle die Abfrage
      const appointmentsCollection = collection(this.firestore, this.collectionName);
      const q = query(
        appointmentsCollection, 
        where('providerId', '==', providerId),
        limit(500)
      );
      
      return collectionData(q, { idField: 'id' }).pipe(
        tap(data => console.log(`Raw data received: ${data.length} appointments`)),
        map(data => {
          console.log(`Found ${data.length} appointments for provider ${providerId}`);
          this.loadingService.setLoading(false);
          return (data as any[]).map(item => convertAppointmentDates(item) as AppointmentWithId);
        }),
        catchError(error => {
          console.error(`Error fetching appointments for provider ${providerId}:`, error);
          this.loadingService.setLoading(false);
          return of([]);
        })
      );
    }, this.ngZone);
  }

  /**
   * Termine für einen bestimmten Tag abfragen
   * Verwendet clientseitige Filterung für Datumsbereich
   */
  getAppointmentsByUserAndDate(
    userId: string, 
    date: Date, 
    isProvider: boolean = false
  ): Observable<AppointmentWithId[]> {
    return ZoneUtils.wrapObservable(() => {
      console.log(`AppointmentService: Getting appointments for ${isProvider ? 'provider' : 'customer'} ID: ${userId} on date: ${date}`);
      this.loadingService.setLoading(true, 'Lade Termine...');
      
      // Datumsgrenzen erstellen
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log(`Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
      
      // Feldname bestimmen
      const fieldName = isProvider ? 'providerId' : 'customerId';
      
      // Erstelle Firestore-Abfrage OHNE Datumsfilter - nur mit einem einzigen Filter
      const appointmentsCollection = collection(this.firestore, this.collectionName);
      const q = query(
        appointmentsCollection,
        where(fieldName, '==', userId),
        limit(500)
      );
      
      return collectionData(q, { idField: 'id' }).pipe(
        map(data => {
          const appointments = (data as any[])
            .map(item => convertAppointmentDates(item) as AppointmentWithId)
            // Clientseitige Datumsfilterung
            .filter(appt => {
              const apptDate = new Date(appt.startTime);
              return apptDate >= startOfDay && apptDate <= endOfDay;
            });
          
          console.log(`Found ${appointments.length} appointments for date ${date}`);
          this.loadingService.setLoading(false);
          return appointments;
        }),
        catchError(error => {
          console.error(`Error fetching appointments:`, error);
          this.loadingService.setLoading(false);
          return of([]);
        })
      );
    }, this.ngZone);
  }

  /**
   * Terminbestätigung durch den Provider
   */
  confirmAppointment(appointmentId: string): Promise<boolean> {
    return this.updateAppointmentStatus(appointmentId, 'confirmed');
  }
  
  /**
   * Terminablehnung/Stornierung
   */
  cancelAppointment(appointmentId: string): Promise<boolean> {
    return this.updateAppointmentStatus(appointmentId, 'canceled');
  }
  
  /**
   * Termin als erledigt markieren
   */
  completeAppointment(appointmentId: string): Promise<boolean> {
    return this.updateAppointmentStatus(appointmentId, 'completed');
  }
  
  /**
   * Hilfsmethode zum Aktualisieren des Terminstatus
   */
  private updateAppointmentStatus(
    appointmentId: string, 
    status: 'pending' | 'confirmed' | 'canceled' | 'completed'
  ): Promise<boolean> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.loadingService.setLoading(true, `Setze Terminstatus auf ${status}...`);
        console.log(`Updating appointment ${appointmentId} status to ${status}`);
        
        const appointmentDocument = doc(this.firestore, this.collectionName, appointmentId);
        
        await updateDoc(appointmentDocument, {
          status: status,
          updatedAt: new Date()
        });
        
        console.log(`Successfully updated appointment ${appointmentId} status to ${status}`);
        this.loadingService.setLoading(false);
        return true;
      } catch (error) {
        console.error(`Error updating appointment status:`, error);
        this.loadingService.setLoading(false);
        throw error;
      }
    }, this.ngZone);
  }
}