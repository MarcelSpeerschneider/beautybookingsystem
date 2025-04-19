import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
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
import { ProviderCustomerService } from './provider-customer.service';

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
  private providerCustomerService = inject(ProviderCustomerService);

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
   * Prüft, ob der aktuelle Benutzer ein Provider ist
   * Vereinfachte Version: Prüft nur die role-Eigenschaft
   */
  private async isCurrentUserProvider(): Promise<boolean> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return false;
    
    try {
      const providerDoc = this.docInZone('providers', currentUser.uid);
      const providerSnap = await this.getDocInZone(providerDoc);
      
      if (providerSnap.exists()) {
        const data = providerSnap.data();
        // Prüfe nur die role-Eigenschaft
        return data['role'] === 'provider';
      }
      
      return false;
    } catch (error) {
      console.error('Fehler bei der Provider-Rollenprüfung:', error);
      return false;
    }
  }

  /**
   * Prüft, ob der aktuelle Benutzer ein Kunde ist
   * Vereinfachte Version: Prüft nur die role-Eigenschaft
   */
  private async isCurrentUserCustomer(): Promise<boolean> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return false;
    
    try {
      const customerDoc = this.docInZone('customers', currentUser.uid);
      const customerSnap = await this.getDocInZone(customerDoc);
      
      if (customerSnap.exists()) {
        const data = customerSnap.data();
        // Prüfe nur die role-Eigenschaft 
        return data['role'] === 'customer';
      }
      
      return false;
    } catch (error) {
      console.error('Fehler bei der Kunden-Rollenprüfung:', error);
      return false;
    }
  }

  /**
   * Prüft die Berechtigungen für den Zugriff auf einen Termin
   * basierend auf der Rolle des Benutzers
   */
  private async checkAppointmentAccess(appointment: AppointmentWithId): Promise<boolean> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return false;
    
    // Provider dürfen nur ihre eigenen Termine sehen und müssen die Provider-Rolle haben
    if (await this.isCurrentUserProvider()) {
      return appointment.providerId === currentUser.uid;
    }
    
    // Kunden dürfen nur ihre eigenen Termine sehen und müssen die Customer-Rolle haben
    if (await this.isCurrentUserCustomer()) {
      return appointment.customerId === currentUser.uid;
    }
    
    return false;
  }

  /**
   * Holt alle Termine aus der Datenbank
   * mit rollenbasierter Filterung (vereinfacht)
   */
  getAppointments(): Observable<AppointmentWithId[]> {
    return ZoneUtils.wrapObservable(() => {
      console.log('AppointmentService: Fetching all appointments');
      this.loadingService.setLoading(true, 'Lade Termine...');

      // Zuerst prüfen, ob der Benutzer ein Provider oder Customer ist (anhand role)
      return from(Promise.all([this.isCurrentUserProvider(), this.isCurrentUserCustomer()])).pipe(
        switchMap(([isProvider, isCustomer]) => {
          const currentUser = this.auth.currentUser;
          
          if (!currentUser) {
            this.loadingService.setLoading(false);
            return of([]);
          }
          
          const appointmentsCollection = this.collectionInZone(this.collectionName);
          
          // Provider sehen nur ihre eigenen Termine (mit Provider-Rolle)
          if (isProvider) {
            console.log('Benutzer ist Provider, zeige Provider-Termine');
            const providerQuery = this.queryInZone(
              appointmentsCollection, 
              where('providerId', '==', currentUser.uid),
              limit(1000)
            );
            
            return this.collectionDataInZone(providerQuery, { idField: 'id' });
          }
          
          // Kunden sehen nur ihre eigenen Termine (mit Customer-Rolle)
          if (isCustomer) {
            console.log('Benutzer ist Kunde, zeige Kunden-Termine');
            const customerQuery = this.queryInZone(
              appointmentsCollection, 
              where('customerId', '==', currentUser.uid),
              limit(1000)
            );
            
            return this.collectionDataInZone(customerQuery, { idField: 'id' });
          }
          
          // Wenn keine Rolle identifiziert werden kann, keine Termine anzeigen
          console.log('Benutzerrolle nicht erkannt, keine Termine anzeigen');
          this.loadingService.setLoading(false);
          return of([]);
        }),
        map(data => {
          console.log(`Received ${data.length} total appointments`);
          this.loadingService.setLoading(false);
          return (data as any[]).map(item => convertAppointmentDates(item) as AppointmentWithId);
        }),
        catchError(error => {
          console.error('Error fetching appointments:', error);
          this.loadingService.setLoading(false);
          return of([]);
        })
      );
    }, this.ngZone);
  }

  /**
   * Holt einen einzelnen Termin anhand seiner ID
   * mit rollenbasierter Zugangskontrolle
   */
  getAppointment(appointmentId: string): Observable<AppointmentWithId | null> {
    return ZoneUtils.wrapObservable(() => {
      console.log(`AppointmentService: Fetching appointment with ID: ${appointmentId}`);
      this.loadingService.setLoading(true, 'Lade Termin...');

      const appointmentDocument = this.docInZone(`${this.collectionName}/${appointmentId}`);

      return from(this.getDocInZone(appointmentDocument)).pipe(
        switchMap(docSnap => {
          if (!docSnap.exists()) {
            console.log(`No appointment found with ID: ${appointmentId}`);
            this.loadingService.setLoading(false);
            return of(null);
          }
          
          const appointmentData = { id: docSnap.id, ...docSnap.data() } as AppointmentWithId;
          
          // Prüfen der rollenbasierten Zugriffsberechtigungen
          return from(this.checkAppointmentAccess(appointmentData)).pipe(
            map(hasAccess => {
              if (!hasAccess) {
                console.warn(`User has no access to appointment ${appointmentId} based on role`);
                this.loadingService.setLoading(false);
                return null;
              }
              
              console.log(`Found appointment with ID: ${appointmentId}`);
              this.loadingService.setLoading(false);
              return convertAppointmentDates(appointmentData) as AppointmentWithId;
            })
          );
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
   * mit rollenbasierter Zugangskontrolle (vereinfacht)
   * @returns Promise<string> mit der ID des erstellten Termins
   */
  createAppointment(appointment: Appointment): Promise<string> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.loadingService.setLoading(true, 'Erstelle Termin...');
        console.log('Creating new appointment:', appointment);

        // Rollenbasierte Zugangskontrolle: Nur Provider und Kunden dürfen Termine erstellen
        const isProvider = await this.isCurrentUserProvider();
        const isCustomer = await this.isCurrentUserCustomer();
        
        if (!isProvider && !isCustomer) {
          this.loadingService.setLoading(false);
          throw new Error('Nur Provider oder Kunden dürfen Termine erstellen.');
        }
        
        // Wenn Provider, prüfen, ob es sein eigener Termin ist
        if (isProvider && this.auth.currentUser?.uid !== appointment.providerId) {
          this.loadingService.setLoading(false);
          throw new Error('Provider dürfen nur ihre eigenen Termine erstellen.');
        }
        
        // Wenn Kunde, prüfen, ob es sein eigener Termin ist
        if (isCustomer && this.auth.currentUser?.uid !== appointment.customerId) {
          this.loadingService.setLoading(false);
          throw new Error('Kunden dürfen nur ihre eigenen Termine erstellen.');
        }

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
   * mit rollenbasierter Zugangskontrolle (vereinfacht)
   * @returns Promise<boolean> mit dem Ergebnis der Aktualisierung
   */
  updateAppointment(appointment: AppointmentWithId): Promise<boolean> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.loadingService.setLoading(true, 'Aktualisiere Termin...');
        console.log('Updating appointment:', appointment);

        // Rollenbasierte Zugangskontrolle
        const isProvider = await this.isCurrentUserProvider();
        const isCustomer = await this.isCurrentUserCustomer();
        
        if (!isProvider && !isCustomer) {
          this.loadingService.setLoading(false);
          throw new Error('Nur Provider oder Kunden dürfen Termine aktualisieren.');
        }
        
        // Provider dürfen nur ihre eigenen Termine aktualisieren
        if (isProvider && this.auth.currentUser?.uid !== appointment.providerId) {
          this.loadingService.setLoading(false);
          throw new Error('Provider dürfen nur ihre eigenen Termine aktualisieren.');
        }
        
        // Kunden dürfen nur ihre eigenen Termine aktualisieren
        if (isCustomer && this.auth.currentUser?.uid !== appointment.customerId) {
          this.loadingService.setLoading(false);
          throw new Error('Kunden dürfen nur ihre eigenen Termine aktualisieren.');
        }

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
   * mit rollenbasierter Zugangskontrolle (vereinfacht)
   * @returns Promise<boolean> mit dem Ergebnis der Löschung
   */
  deleteAppointment(appointmentId: string): Promise<boolean> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.loadingService.setLoading(true, 'Lösche Termin...');
        console.log(`Deleting appointment with ID: ${appointmentId}`);

        // Zuerst den Termin laden, um seine Daten zu überprüfen
        const appointmentDoc = this.docInZone(this.collectionName, appointmentId);
        const appointmentSnap = await this.getDocInZone(appointmentDoc);
        
        if (!appointmentSnap.exists()) {
          this.loadingService.setLoading(false);
          throw new Error('Termin nicht gefunden.');
        }
        
        const appointmentData = { id: appointmentId, ...appointmentSnap.data() } as AppointmentWithId;
        
        // Rollenbasierte Zugangskontrolle (vereinfacht)
        const isProvider = await this.isCurrentUserProvider();
        const isCustomer = await this.isCurrentUserCustomer();
        
        // Nur Provider und Kunden dürfen Termine löschen
        if (!isProvider && !isCustomer) {
          this.loadingService.setLoading(false);
          throw new Error('Nur Provider oder Kunden dürfen Termine löschen.');
        }
        
        // Provider dürfen nur ihre eigenen Termine löschen
        if (isProvider && this.auth.currentUser?.uid !== appointmentData.providerId) {
          this.loadingService.setLoading(false);
          throw new Error('Provider dürfen nur ihre eigenen Termine löschen.');
        }
        
        // Kunden dürfen nur ihre eigenen Termine löschen
        if (isCustomer && this.auth.currentUser?.uid !== appointmentData.customerId) {
          this.loadingService.setLoading(false);
          throw new Error('Kunden dürfen nur ihre eigenen Termine löschen.');
        }

        await this.ngZone.run(() => deleteDoc(appointmentDoc));
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
   * mit rollenbasierter Zugangskontrolle (vereinfacht)
   */
  getAppointmentsByCustomer(customerId: string): Observable<AppointmentWithId[]> {
    return ZoneUtils.wrapObservable(() => {
      console.log(`AppointmentService: Getting appointments for customer ID: ${customerId}`);
      this.loadingService.setLoading(true, 'Lade Kundentermine...');

      // Rollenbasierte Zugangskontrolle
      return from(Promise.all([this.isCurrentUserProvider(), this.isCurrentUserCustomer()])).pipe(
        switchMap(([isProvider, isCustomer]) => {
          const currentUser = this.auth.currentUser;
          
          // Benutzer muss angemeldet sein
          if (!currentUser) {
            this.loadingService.setLoading(false);
            return of([]);
          }
          
          // Provider dürfen Termine aller Kunden sehen
          if (isProvider) {
            // Kann bleiben wie es ist
          } 
          // Kunden dürfen nur ihre eigenen Termine sehen
          else if (isCustomer) {
            if (currentUser.uid !== customerId) {
              console.warn(`Customer ${currentUser.uid} trying to access appointments of customer ${customerId}`);
              this.loadingService.setLoading(false);
              return of([]);
            }
          } 
          // Wenn keine Rolle erkannt wird, keinen Zugriff gewähren
          else {
            console.warn('Benutzer ohne erkannte Rolle versucht, auf Kundentermine zuzugreifen');
            this.loadingService.setLoading(false);
            return of([]);
          }

          // Erstelle die Abfrage
          const appointmentsCollection = this.collectionInZone(this.collectionName);
          const q = this.queryInZone(
            appointmentsCollection,
            where('customerId', '==', customerId),
            limit(1000)
          );
          
          return this.collectionDataInZone(q, { idField: 'id' }).pipe(
            tap(data => console.log(`Found ${data.length} appointments for customer ${customerId}`)),
            map(data => {
              console.log(`Processing ${data.length} appointments`);
              this.loadingService.setLoading(false);
              return (data as any[]).map(item => convertAppointmentDates(item) as AppointmentWithId);
            })
          );
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
   * mit rollenbasierter Zugangskontrolle (vereinfacht)
   */
  getAppointmentsByProvider(providerId: string): Observable<AppointmentWithId[]> {
    return ZoneUtils.wrapObservable(() => {
      console.log(`AppointmentService: Getting appointments for provider ID: ${providerId}`);
      this.loadingService.setLoading(true, 'Lade Anbietertermine...');

      // Rollenbasierte Zugangskontrolle
      return from(Promise.all([this.isCurrentUserProvider(), this.isCurrentUserCustomer()])).pipe(
        switchMap(([isProvider, isCustomer]) => {
          const currentUser = this.auth.currentUser;
          
          // Benutzer muss angemeldet sein
          if (!currentUser) {
            this.loadingService.setLoading(false);
            return of([]);
          }
          
          // Nur Provider dürfen ihre eigenen Termine oder Kunden sehen ihre gebuchten Termine
          if (isProvider) {
            if (currentUser.uid !== providerId) {
              console.warn(`Provider ${currentUser.uid} trying to access appointments of provider ${providerId}`);
              this.loadingService.setLoading(false);
              return of([]);
            }
          } else if (!isCustomer) {
            console.warn('Benutzer ohne erkannte Rolle versucht, auf Provider-Termine zuzugreifen');
            this.loadingService.setLoading(false);
            return of([]);
          }

          // Erstelle die Abfrage - alle in NgZone
          const appointmentsCollection = this.collectionInZone(this.collectionName);
          const q = this.queryInZone(
            appointmentsCollection,
            where('providerId', '==', providerId),
            limit(1000)
          );
          
          return this.collectionDataInZone(q, { idField: 'id' }).pipe(
            tap(data => console.log(`Raw data received: ${data.length} appointments`)),
            map(data => {
              console.log(`Found ${data.length} appointments for provider ${providerId}`);
              
              // Für Kunden filtern wir die Ergebnisse nach ihren eigenen Terminen
              if (isCustomer && !isProvider) {
                const filteredData = (data as any[]).filter(item => item.customerId === currentUser.uid);
                console.log(`Filtered to ${filteredData.length} appointments for customer ${currentUser.uid}`);
                this.loadingService.setLoading(false);
                return filteredData.map(item => convertAppointmentDates(item) as AppointmentWithId);
              }
              
              this.loadingService.setLoading(false);
              return (data as any[]).map(item => convertAppointmentDates(item) as AppointmentWithId);
            })
          );
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
   * mit rollenbasierter Zugangskontrolle (vereinfacht)
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

      // Rollenbasierte Zugangskontrolle
      return from(Promise.all([this.isCurrentUserProvider(), this.isCurrentUserCustomer()])).pipe(
        switchMap(([userIsProvider, userIsCustomer]) => {
          const currentUser = this.auth.currentUser;
          
          // Benutzer muss angemeldet sein
          if (!currentUser) {
            this.loadingService.setLoading(false);
            return of([]);
          }
          
          // Wenn der Benutzer ein Provider ist und nach Provider-Terminen fragt,
          // muss er seine eigenen Termine abfragen
          if (userIsProvider && isProvider && currentUser.uid !== userId) {
            console.warn(`Provider ${currentUser.uid} trying to access appointments of provider ${userId}`);
            this.loadingService.setLoading(false);
            return of([]);
          }
          
          // Wenn der Benutzer ein Kunde ist und nach Kunden-Terminen fragt,
          // muss er seine eigenen Termine abfragen
          if (userIsCustomer && !isProvider && currentUser.uid !== userId) {
            console.warn(`Customer ${currentUser.uid} trying to access appointments of customer ${userId}`);
            this.loadingService.setLoading(false);
            return of([]);
          }
          
          // Wenn keine Rolle erkannt wird, keinen Zugriff gewähren
          if (!userIsProvider && !userIsCustomer) {
            console.warn('Benutzer ohne erkannte Rolle versucht, auf Termine zuzugreifen');
            this.loadingService.setLoading(false);
            return of([]);
          }

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
            limit(1000)
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
            })
          );
        }),
        catchError(error => {
          console.error(`Error fetching appointments:`, error);
          this.loadingService.setLoading(false);
          return of([]);
        })
      );
    }, this.ngZone);
  }

    // Hier fügen wir eine neue Methode hinzu, um direkt die Anzahl der offenen Anfragen zu zählen

  getPendingAppointmentsCount(providerId: string): Observable<number> {
    console.log('Zähle direkt die offenen Anfragen für Provider ID:', providerId);
    
    const appointmentsRef = collection(this.firestore, 'appointments');
    const q = query(
      appointmentsRef,
      where('providerId', '==', providerId),
      where('status', '==', 'pending'),
      limit(1000) 
    );
    
    return from(getDocs(q)).pipe(
      map(snapshot => {
        const count = snapshot.docs.length;
        console.log(`Gefundene offene Anfragen: ${count}`);
        return count;
      }),
      catchError(error => {
        console.error('Fehler beim Zählen der offenen Anfragen:', error);
        return of(0);
      })
    );
  }

  /**
   * Terminbestätigung durch den Provider
   * mit rollenbasierter Zugangskontrolle (vereinfacht)
   */
  confirmAppointment(appointmentId: string): Promise<boolean> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        // Prüfen, ob der Benutzer ein Provider ist
        const isProvider = await this.isCurrentUserProvider();
        if (!isProvider) {
          console.error('Nur Provider können Termine bestätigen');
          return false;
        }
        
        // Rest der Implementierung wie zuvor...
        return this.updateAppointmentStatus(appointmentId, 'confirmed');
      } catch (error) {
        console.error('Fehler bei der Terminbestätigung:', error);
        return false;
      }
    }, this.ngZone);
  }

  /**
   * Terminablehnung/Stornierung
   * mit rollenbasierter Zugangskontrolle (vereinfacht)
   */
  cancelAppointment(appointmentId: string): Promise<boolean> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        // Zuerst den Termin laden, um seine Daten zu überprüfen
        const appointmentDoc = this.docInZone(this.collectionName, appointmentId);
        const appointmentSnap = await this.getDocInZone(appointmentDoc);
        
        if (!appointmentSnap.exists()) {
          console.error('Termin nicht gefunden');
          return false;
        }
        
        const appointmentData = appointmentSnap.data();
        const currentUser = this.auth.currentUser;
        
        if (!currentUser) {
          console.error('Kein Benutzer angemeldet');
          return false;
        }
        
        // Rollenbasierte Zugangskontrolle
        const isProvider = await this.isCurrentUserProvider();
        const isCustomer = await this.isCurrentUserCustomer();
        
        // Provider dürfen nur ihre eigenen Termine stornieren
        if (isProvider && appointmentData.providerId !== currentUser.uid) {
          console.error('Provider dürfen nur ihre eigenen Termine stornieren');
          return false;
        }
        
        // Kunden dürfen nur ihre eigenen Termine stornieren
        if (isCustomer && appointmentData.customerId !== currentUser.uid) {
          console.error('Kunden dürfen nur ihre eigenen Termine stornieren');
          return false;
        }
        
        // Wenn keine erkannte Rolle, keinen Zugriff gewähren
        if (!isProvider && !isCustomer) {
          console.error('Benutzer ohne erkannte Rolle versucht, einen Termin zu stornieren');
          return false;
        }
        
        // Rest der Implementierung wie zuvor...
        return this.updateAppointmentStatus(appointmentId, 'canceled');
      } catch (error) {
        console.error('Fehler bei der Terminstornierung:', error);
        return false;
      }
    }, this.ngZone);
  }

  /**
   * Termin als erledigt markieren
   * mit rollenbasierter Zugangskontrolle (vereinfacht)
   */
  completeAppointment(appointmentId: string): Promise<boolean> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.loadingService.setLoading(true, 'Termin wird als erledigt markiert...');

        // Prüfen, ob der Benutzer ein Provider ist - nur Provider dürfen Termine abschließen
        const isProvider = await this.isCurrentUserProvider();
        if (!isProvider) {
          console.error('Nur Provider können Termine als erledigt markieren');
          this.loadingService.setLoading(false);
          return false;
        }

        // Zuerst den Termin laden, um die Provider- und Customer-IDs zu bekommen
        const appointmentDoc = this.docInZone(this.collectionName, appointmentId);
        const appointmentSnap = await this.getDocInZone(appointmentDoc);

        if (appointmentSnap.exists()) {
          const appointmentData = appointmentSnap.data();
          const currentUser = this.auth.currentUser;
          
          // Prüfen, ob es der Provider des Termins ist
          if (currentUser && appointmentData.providerId !== currentUser.uid) {
            console.error('Provider können nur ihre eigenen Termine als erledigt markieren');
            this.loadingService.setLoading(false);
            return false;
          }

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

        // Zuerst den Termin laden, um die Berechtigungen zu prüfen
        const appointmentDoc = this.docInZone(this.collectionName, appointmentId);
        const appointmentSnap = await this.getDocInZone(appointmentDoc);
        
        if (!appointmentSnap.exists()) {
          console.error('Termin nicht gefunden');
          this.loadingService.setLoading(false);
          return false;
        }
        
        const appointmentData = appointmentSnap.data();
        const currentUser = this.auth.currentUser;
        
        if (!currentUser) {
          console.error('Kein Benutzer angemeldet');
          this.loadingService.setLoading(false);
          return false;
        }
        
        // Rollenbasierte Zugangskontrolle je nach Status
        const isProvider = await this.isCurrentUserProvider();
        const isCustomer = await this.isCurrentUserCustomer();
        
        // Bestätigung darf nur der Provider des Termins durchführen
        if (status === 'confirmed' && (!isProvider || appointmentData.providerId !== currentUser.uid)) {
          console.error('Nur der Provider des Termins darf diesen bestätigen');
          this.loadingService.setLoading(false);
          return false;
        }
        
        // Stornierung darf der Provider des Termins oder der Kunde durchführen
        if (status === 'canceled') {
          const isAuthorized = 
            (isProvider && appointmentData.providerId === currentUser.uid) ||
            (isCustomer && appointmentData.customerId === currentUser.uid);
            
          if (!isAuthorized) {
            console.error('Nur der Provider oder der Kunde des Termins darf diesen stornieren');
            this.loadingService.setLoading(false);
            return false;
          }
        }

        await this.ngZone.run(() => updateDoc(appointmentDoc, {
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