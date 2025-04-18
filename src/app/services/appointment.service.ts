import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,  // Import für die Terminüberlappungsprüfung
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
import { ProviderCustomerService } from './provider-customer.service'; // Importieren des Services

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
  private providerCustomerService = inject(ProviderCustomerService); // Service injizieren

  // Firebase operation helpers that run in NgZone
  private getDocInZone(docRef: any): Promise<any> {
    return this.ngZone.run(() => getDoc(docRef));
  }

  private docInZone(path: string, ...pathSegments: string[]): any {
    return this.ngZone.run(() => doc(this.firestore, path, ...pathSegments));
  }

  private collectionInZone(path: string): any {
    return this.ngZone.run(() => collection(this.firestore, path));
  }

  private queryInZone(collectionRef: any, ...queryConstraints: any[]): any {
    return this.ngZone.run(() => query(collectionRef, ...queryConstraints));
  }

  private collectionDataInZone(collectionRef: any, options: any): Observable<any> {
    return this.ngZone.run(() => collectionData(collectionRef, options));
  }

  /**
   * Holt alle Termine aus der Datenbank
   */
  getAppointments(): Observable<AppointmentWithId[]> {
    return ZoneUtils.wrapObservable(() => {
      console.log('AppointmentService: Fetching all appointments');
      this.loadingService.setLoading(true, 'Lade Termine...');

      const appointmentsCollection = this.collectionInZone(this.collectionName);
      const limitedQuery = this.queryInZone(appointmentsCollection, limit(500));

      return this.collectionDataInZone(limitedQuery, { idField: 'id' }).pipe(
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

      const appointmentDocument = this.docInZone(`${this.collectionName}/${appointmentId}`);

      return this.ngZone.run(() => docData(appointmentDocument, { idField: 'id' })).pipe(
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
   * Prüft, ob sich zwei Zeiträume überschneiden
   */
  private doDateRangesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Prüft, ob ein Termin sich mit bestehenden Terminen überschneidet
   * @returns Promise<boolean> true wenn Überschneidung gefunden, false wenn keine Überschneidung
   */
  private async checkForOverlappingAppointments(appointment: Appointment): Promise<boolean> {
    try {
      const appointmentDate = appointment.startTime instanceof Date ?
        appointment.startTime :
        new Date(appointment.startTime);
  
      const startOfDay = new Date(appointmentDate);
      startOfDay.setHours(0, 0, 0, 0);
  
      const endOfDay = new Date(appointmentDate);
      endOfDay.setHours(23, 59, 59, 999);
  
      // WICHTIGE ÄNDERUNG: Nur nach providerId filtern, nicht nach Status
      const appointmentsCollection = this.collectionInZone(this.collectionName);
      const q = this.queryInZone(
        appointmentsCollection,
        where('providerId', '==', appointment.providerId)
      );
  
      // Abfrage ausführen
      const snapshot = await this.ngZone.run(() => getDocs(q));
      const existingAppointments = snapshot.docs.map(doc => {
        const data = doc.data() as Record<string, any>;
        return { id: doc.id, ...data } as AppointmentWithId;
      });
  
      // Clientseitig filtern nach Tag UND Status
      const appointmentsToCheck = existingAppointments.filter(app => {
        const appStartDate = app.startTime instanceof Date ?
          app.startTime :
          new Date(app.startTime);
        
        // Termin muss am selben Tag sein...
        const isSameDay = appStartDate >= startOfDay && appStartDate <= endOfDay;
        
        // ... und den Status 'pending' oder 'confirmed' haben
        const hasRelevantStatus = app.status === 'pending' || app.status === 'confirmed';
        
        return isSameDay && hasRelevantStatus;
      });
  
      // Bei Aktualisierung den eigenen Termin ausschließen
      const filteredAppointments = 'id' in appointment
        ? appointmentsToCheck.filter(app => app.id !== (appointment as AppointmentWithId).id)
        : appointmentsToCheck;
  
      console.log(`Prüfe auf Überschneidungen mit ${filteredAppointments.length} anderen Terminen am selben Tag`);
  
      // Überschneidungsprüfung (Rest bleibt gleich)
      const newAppointmentStart = appointment.startTime instanceof Date ?
        appointment.startTime :
        new Date(appointment.startTime);
      const newAppointmentEnd = appointment.endTime instanceof Date ?
        appointment.endTime :
        new Date(appointment.endTime);
  
      for (const existingAppointment of filteredAppointments) {
        const existingStart = existingAppointment.startTime instanceof Date ?
          existingAppointment.startTime :
          new Date(existingAppointment.startTime);
        const existingEnd = existingAppointment.endTime instanceof Date ?
          existingAppointment.endTime :
          new Date(existingAppointment.endTime);
  
        if (this.doDateRangesOverlap(newAppointmentStart, newAppointmentEnd, existingStart, existingEnd)) {
          console.log(`Überschneidung gefunden mit Termin: ${existingAppointment.id}`);
          return true; // Überschneidung gefunden
        }
      }
  
      return false; // Keine Überschneidung gefunden
    } catch (error) {
      console.error('Fehler bei der Überschneidungsprüfung:', error);
      
      // WICHTIGE ÄNDERUNG: Bei Fehlern 'false' zurückgeben, damit Termine trotzdem erstellt werden können
      return false;
    }
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

        // NEUE VALIDIERUNG: Prüfe auf Terminüberschneidungen
        const hasOverlap = await this.checkForOverlappingAppointments(appointment);
        if (hasOverlap) {
          this.loadingService.setLoading(false);
          throw new Error('Der Termin überschneidet sich mit einem bereits bestehenden Termin. Bitte wählen Sie eine andere Zeit.');
        }

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

        const appointmentsCollection = this.collectionInZone(this.collectionName);

        const docRef = await this.ngZone.run(() => addDoc(appointmentsCollection, appointmentToSave));
        console.log('Appointment created successfully with ID:', docRef.id);

        // Nach dem Erstellen des Termins, aktualisiere die Provider-Customer-Beziehung
        try {
          await this.providerCustomerService.updateRelationAfterAppointment(
            appointment.providerId,
            appointment.customerId,
            appointmentToSave.startTime,
            0, // Betrag könnte aus dem Service-Preis ermittelt werden bei Bedarf
            {
              firstName: appointment.customerName?.split(' ')[0] || '',
              lastName: appointment.customerName?.split(' ').slice(1).join(' ') || '',
              email: '', // Wenn vorhanden, könnte hier die E-Mail-Adresse übergeben werden
              phone: '' // Wenn vorhanden, könnte hier die Telefonnummer übergeben werden
            }
          );
          console.log('Provider-customer relation updated successfully');
        } catch (relationError) {
          console.error('Error updating provider-customer relation:', relationError);
          // Wir werfen diesen Fehler nicht, da der Termin trotzdem erfolgreich erstellt wurde
        }

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

        // NEUE VALIDIERUNG: Prüfe auf Terminüberschneidungen
        const hasOverlap = await this.checkForOverlappingAppointments(appointment);
        if (hasOverlap) {
          this.loadingService.setLoading(false);
          throw new Error('Die Terminänderung würde zu einer Überschneidung mit einem anderen Termin führen. Bitte wählen Sie eine andere Zeit.');
        }

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

        const appointmentDocument = this.docInZone(this.collectionName, id);

        await this.ngZone.run(() => updateDoc(appointmentDocument, updatedAppointment));
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

        const appointmentDocument = this.docInZone(this.collectionName, appointmentId);

        await this.ngZone.run(() => deleteDoc(appointmentDocument));
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
      const appointmentsCollection = this.collectionInZone(this.collectionName);
      const q = this.queryInZone(
        appointmentsCollection,
        where('customerId', '==', customerId),
        limit(500)
      );

      return this.collectionDataInZone(q, { idField: 'id' }).pipe(
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

      // Erstelle die Abfrage - alle in NgZone
      const appointmentsCollection = this.collectionInZone(this.collectionName);
      const q = this.queryInZone(
        appointmentsCollection,
        where('providerId', '==', providerId),
        limit(500)
      );

      return this.collectionDataInZone(q, { idField: 'id' }).pipe(
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
      const appointmentsCollection = this.collectionInZone(this.collectionName);
      const q = this.queryInZone(
        appointmentsCollection,
        where(fieldName, '==', userId),
        limit(500)
      );

      return this.collectionDataInZone(q, { idField: 'id' }).pipe(
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
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.loadingService.setLoading(true, 'Termin wird als erledigt markiert...');

        // Zuerst den Termin laden, um die Provider- und Customer-IDs zu bekommen
        const appointmentDoc = this.docInZone(this.collectionName, appointmentId);
        const appointmentSnap = await this.getDocInZone(appointmentDoc);

        if (appointmentSnap.exists()) {
          const appointmentData = appointmentSnap.data();

          // Terminstatuts aktualisieren
          await this.ngZone.run(() => updateDoc(appointmentDoc, {
            status: 'completed',
            updatedAt: new Date()
          }));

          // Auch die Provider-Customer-Beziehung aktualisieren
          try {
            await this.providerCustomerService.updateRelationAfterAppointment(
              appointmentData.providerId,
              appointmentData.customerId,
              appointmentData.startTime,
              0, // Betrag könnte aus dem Service-Preis ermittelt werden
              {
                firstName: appointmentData.customerName?.split(' ')[0] || '',
                lastName: appointmentData.customerName?.split(' ').slice(1).join(' ') || '',
                email: '', // Wenn vorhanden
                phone: '' // Wenn vorhanden
              }
            );
            console.log('Provider-customer relation updated after completion');
          } catch (relationError) {
            console.error('Error updating provider-customer relation after completion:', relationError);
            // Wir werfen diesen Fehler nicht, da der Termin trotzdem als erledigt markiert wurde
          }

          console.log(`Successfully updated appointment ${appointmentId} status to completed`);
          this.loadingService.setLoading(false);
          return true;
        } else {
          console.error(`Appointment ${appointmentId} not found`);
          this.loadingService.setLoading(false);
          return false;
        }
      } catch (error) {
        console.error(`Error completing appointment:`, error);
        this.loadingService.setLoading(false);
        throw error;
      }
    }, this.ngZone);
  }

  /**
   * Hilfsmethode zum Aktualisieren des Terminstatus
   */
  private updateAppointmentStatus(
    appointmentId: string,
    status: 'pending' | 'confirmed' | 'canceled' | 'completed'
  ): Promise<boolean> {
    // Für 'completed' Status verwenden wir unsere spezielle Methode
    if (status === 'completed') {
      return this.completeAppointment(appointmentId);
    }

    return ZoneUtils.wrapPromise(async () => {
      try {
        this.loadingService.setLoading(true, `Setze Terminstatus auf ${status}...`);
        console.log(`Updating appointment ${appointmentId} status to ${status}`);

        const appointmentDocument = this.docInZone(this.collectionName, appointmentId);

        await this.ngZone.run(() => updateDoc(appointmentDocument, {
          status: status,
          updatedAt: new Date()
        }));

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