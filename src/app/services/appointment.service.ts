import { Injectable, inject, NgZone } from '@angular/core';
import { Appointment } from '../models/appointment.model';
import { Observable, from, of, catchError } from 'rxjs';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, DocumentReference, query, where } from '@angular/fire/firestore';
import { map, switchMap } from 'rxjs/operators';
import { convertAppointmentDates } from '../utils/date-utils';
import { ProviderCustomerService } from './provider-customer.service';


@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
    firestore: Firestore = inject(Firestore);
    private ngZone = inject(NgZone);
    private collectionName = 'appointments';

    constructor(
        private providerCustomerService: ProviderCustomerService
    ) {
    }

    getAppointments(): Observable<Appointment[]> {
        return new Observable<Appointment[]>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentsCollection = collection(this.firestore, this.collectionName);
                    collectionData(appointmentsCollection, { idField: 'appointmentId' }).pipe(
                        map(data => {
                            // Datumswerte konvertieren
                            return (data as any[]).map(item => convertAppointmentDates(item) as Appointment);
                        }),
                        catchError(error => {
                            console.error('Error fetching appointments:', error);
                            return of([]);
                        })
                    ).subscribe({
                        next: appointments => observer.next(appointments),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in getAppointments:', error);
                    observer.next([]);
                    observer.complete();
                }
            });
        });
    }

    getAppointment(appointmentId: string): Observable<Appointment> {
        return new Observable<Appointment>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
                    docData(appointmentDocument, { idField: 'appointmentId' }).pipe(
                        map(data => {
                            // Datumswerte konvertieren
                            return convertAppointmentDates(data) as Appointment;
                        }),
                        catchError(error => {
                            console.error(`Error fetching appointment with ID ${appointmentId}:`, error);
                            return of(null as any);
                        })
                    ).subscribe({
                        next: appointment => observer.next(appointment),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in getAppointment:', error);
                    observer.next(null as any);
                    observer.complete();
                }
            });
        });
    }

    createAppointment(appointment: Appointment): Promise<DocumentReference> {
        return this.ngZone.run(async () => {
          try {
            console.log('Creating new appointment:', appointment);
            const appointmentsCollection = collection(this.firestore, this.collectionName);
            
            // Zuerst Termin speichern
            const docRef = await addDoc(appointmentsCollection, appointment);
            console.log('Appointment created successfully with ID:', docRef.id);
            
            // Dann Provider-Kunden-Beziehung aktualisieren
            try {
              // Preis-Berechnung könnte hier aus der Service-ID ermittelt werden
              const price = 0; // In einer echten Implementierung würde hier der Preis des Services stehen
              
              await this.providerCustomerService.updateRelationAfterAppointment(
                appointment.providerId,
                appointment.customerId,
                appointment.startTime,
                price
              );
              console.log('Provider-customer relation updated successfully');
            } catch (relationError) {
              console.error('Error updating provider-customer relation:', relationError);
              // Wir werfen den Fehler hier nicht, da der Termin bereits erstellt wurde
            }
            
            return docRef;
          } catch (error) {
            console.error('Error creating appointment:', error);
            throw error;
          }
        });
      }

    updateAppointment(appointment: Appointment): Observable<Appointment> {
        return new Observable<Appointment>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointment.appointmentId}`);
                    from(updateDoc(appointmentDocument, { ...appointment })).pipe(
                        switchMap(() => this.getAppointment(appointment.appointmentId)),
                        catchError(error => {
                            console.error(`Error updating appointment with ID ${appointment.appointmentId}:`, error);
                            return of(null as any);
                        })
                    ).subscribe({
                        next: updatedAppointment => observer.next(updatedAppointment),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in updateAppointment:', error);
                    observer.next(null as any);
                    observer.complete();
                }
            });
        });
    }

    // Methode für Kunden, um ihre Termine zu sehen
    getAppointmentsByUser(userId: string): Observable<Appointment[]> {
        return new Observable<Appointment[]>(observer => {
            this.ngZone.run(() => {
                try {
                    console.log("AppointmentService: Getting appointments for user ID (customer):", userId);
                    const appointmentsCollection = collection(this.firestore, this.collectionName);
                    
                    // IMPORTANT: Immer innerhalb von ngZone.run() arbeiten
                    const q = query(appointmentsCollection, where('customerId', '==', userId));
                    const subscription = collectionData(q, { idField: 'appointmentId' }).pipe(
                        map(data => {
                            console.log("AppointmentService: Raw results:", data);
                            // Datumswerte konvertieren
                            return (data as any[]).map(item => convertAppointmentDates(item) as Appointment);
                        }),
                        catchError(error => {
                            console.error(`Error fetching appointments for user ${userId}:`, error);
                            return of([]);
                        })
                    ).subscribe({
                        next: appointments => this.ngZone.run(() => observer.next(appointments)),
                        error: err => this.ngZone.run(() => observer.error(err)),
                        complete: () => this.ngZone.run(() => observer.complete())
                    });
                    
                    // Aufräumen beim Abbestellen
                    return () => subscription.unsubscribe();
                } catch (error) {
                    console.error('Error in getAppointmentsByUser:', error);
                    observer.next([]);
                    observer.complete();
                }
            });
        });
    }

    // Verbesserte Methode für Termine nach Benutzer und Datum
    getAppointmentsByUserAndDate(userId: string, date: Date, isProvider: boolean = false): Observable<Appointment[]> {
        return new Observable<Appointment[]>(observer => {
            this.ngZone.run(() => {
                try {
                    console.log(`AppointmentService: Getting appointments for ${isProvider ? 'provider' : 'customer'} ID: ${userId} on date: ${date}`);
                    const appointmentsCollection = collection(this.firestore, this.collectionName);
                    
                    // Entscheide, ob wir nach customerId oder providerId filtern
                    const fieldName = isProvider ? 'providerId' : 'customerId';
                    const q = query(appointmentsCollection, where(fieldName, '==', userId));
                    
                    collectionData(q, { idField: 'appointmentId' }).pipe(
                        map(data => {
                            console.log(`AppointmentService: Raw results for ${fieldName}=${userId}:`, data);
                            
                            // Konvertiere Datumswerte und erstelle Appointment-Objekte
                            const appointments = (data as any[]).map(item => convertAppointmentDates(item) as Appointment);
                            
                            // Filtere nach Datum
                            // Wir vergleichen nur das Datum, nicht die Uhrzeit
                            const compareDate = new Date(date);
                            compareDate.setHours(0, 0, 0, 0);
                            
                            return appointments.filter(appointment => {
                                if (!appointment.startTime) return false;
                                
                                const appointmentDate = new Date(appointment.startTime);
                                appointmentDate.setHours(0, 0, 0, 0);
                                
                                return appointmentDate.getTime() === compareDate.getTime();
                            });
                        }),
                        catchError(error => {
                            console.error(`Error fetching appointments for ${fieldName} ${userId} on date ${date}:`, error);
                            return of([]);
                        })
                    ).subscribe({
                        next: appointments => observer.next(appointments),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in getAppointmentsByUserAndDate:', error);
                    observer.next([]);
                    observer.complete();
                }
            });
        });
    }
    
    getAvailableAppointments(userId: string, date: Date, serviceId: string): Observable<Appointment[]> {
        return this.ngZone.run(() => {
            // TODO: Implementieren Sie die Logik für verfügbare Termine
            return of([]);
        });
    }

    confirmAppointment(appointmentId: string): Observable<Appointment> {
        return new Observable<Appointment>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
                    from(updateDoc(appointmentDocument, { status: 'confirmed' })).pipe(
                        switchMap(() => this.getAppointment(appointmentId)),
                        catchError(error => {
                            console.error(`Error confirming appointment with ID ${appointmentId}:`, error);
                            return of(null as any);
                        })
                    ).subscribe({
                        next: appointment => observer.next(appointment),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in confirmAppointment:', error);
                    observer.next(null as any);
                    observer.complete();
                }
            });
        });
    }

    cancelAppointment(appointmentId: string): Observable<Appointment> {
        return new Observable<Appointment>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
                    from(updateDoc(appointmentDocument, { status: 'canceled' })).pipe(
                        switchMap(() => this.getAppointment(appointmentId)),
                        catchError(error => {
                            console.error(`Error canceling appointment with ID ${appointmentId}:`, error);
                            return of(null as any);
                        })
                    ).subscribe({
                        next: appointment => observer.next(appointment),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in cancelAppointment:', error);
                    observer.next(null as any);
                    observer.complete();
                }
            });
        });
    }

    completeAppointment(appointmentId: string): Observable<Appointment> {
        return new Observable<Appointment>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
                    from(updateDoc(appointmentDocument, { status: 'completed' })).pipe(
                        switchMap(() => this.getAppointment(appointmentId)),
                        catchError(error => {
                            console.error(`Error completing appointment with ID ${appointmentId}:`, error);
                            return of(null as any);
                        })
                    ).subscribe({
                        next: appointment => observer.next(appointment),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in completeAppointment:', error);
                    observer.next(null as any);
                    observer.complete();
                }
            });
        });
    }

    deleteAppointment(appointmentId: string): Observable<void> {
        return new Observable<void>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
                    from(deleteDoc(appointmentDocument)).pipe(
                        catchError(error => {
                            console.error(`Error deleting appointment with ID ${appointmentId}:`, error);
                            return of(undefined);
                        })
                    ).subscribe({
                        next: () => observer.next(),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in deleteAppointment:', error);
                    observer.next();
                    observer.complete();
                }
            });
        });
    }

    // Korrigierte Methode für Provider-Appointments
    getAppointmentsByProvider(providerId: string): Observable<Appointment[]> {
        return new Observable<Appointment[]>(observer => {
            this.ngZone.run(() => {
                try {
                    console.log("AppointmentService: Getting appointments for provider ID:", providerId);
                    const appointmentsCollection = collection(this.firestore, this.collectionName);
                    // Nutze providerId zum Filtern
                    const q = query(appointmentsCollection, where('providerId', '==', providerId));
                    collectionData(q, { idField: 'appointmentId' }).pipe(
                        map(data => {
                            console.log("AppointmentService: Raw results for provider:", data);
                            
                            // Konvertiere alle Appointments mit korrekten Datumswerten
                            return (data as any[]).map(item => convertAppointmentDates(item) as Appointment);
                        }),
                        catchError(error => {
                            console.error(`Error fetching appointments for provider ${providerId}:`, error);
                            return of([]);
                        })
                    ).subscribe({
                        next: appointments => {
                            // Log some examples for debugging
                            if (appointments.length > 0) {
                                console.log("Beispiel-Appointment nach Konvertierung:", {
                                    startTime: appointments[0].startTime,
                                    isDate: appointments[0].startTime instanceof Date,
                                    endTime: appointments[0].endTime,
                                    createdAt: appointments[0].createdAt
                                });
                            }
                            observer.next(appointments);
                        },
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in getAppointmentsByProvider:', error);
                    observer.next([]);
                    observer.complete();
                }
            });
        });
    }
}