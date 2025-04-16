import { Injectable, inject, NgZone } from '@angular/core';
import { Appointment } from '../models/appointment.model';
import { Observable, from, of, catchError } from 'rxjs';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, query, where, limit } from '@angular/fire/firestore';
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
                    collectionData(appointmentsCollection, { idField: 'id' }).pipe(
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
                    docData(appointmentDocument, { idField: 'id' }).pipe(
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

    async createAppointment(appointment: Omit<Appointment, 'id'>): Promise<string> {
        return this.ngZone.run(async () => {
            try {
                console.log('Creating new appointment:', appointment);
                const appointmentsCollection = collection(this.firestore, this.collectionName);

                // Appointment-Objekt vorbereiten (ohne ID)
                const appointmentToSave = {
                    ...appointment,
                    createdAt: new Date() // Stelle sicher, dass createdAt gesetzt ist
                };

                // First save the appointment
                const docRef = await addDoc(appointmentsCollection, appointmentToSave);
                console.log('Appointment created successfully with ID:', docRef.id);

                // Check if we have at least the customer name
                const hasCustomerData = appointment.customerName;

                // Then update provider-customer relationship
                try {
                    // Price calculation could be done here from the service ID
                    const price = 0; // In a real implementation, get the price from the service

                    // Parse customer name if available
                    let firstName = '';
                    let lastName = '';

                    if (appointment.customerName) {
                        const nameParts = appointment.customerName.split(' ');
                        firstName = nameParts[0] || '';
                        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
                    }

                    await this.providerCustomerService.updateRelationAfterAppointment(
                        appointment.providerId,
                        appointment.customerId,
                        appointment.startTime,
                        price,
                        hasCustomerData ? {
                            firstName: firstName,
                            lastName: lastName,
                            // We don't have email and phone in the Appointment model
                            // so we're only passing the name data
                        } : undefined
                    );
                    console.log('Provider-customer relation updated successfully');
                } catch (relationError) {
                    console.error('Error updating provider-customer relation:', relationError);
                    // We don't throw the error here since the appointment was already created
                }

                return docRef.id;
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
                    const { id, ...appointmentData } = appointment;

                    // Aktualisiere auch den updatedAt-Timestamp
                    const updatedAppointment = {
                        ...appointmentData,
                        updatedAt: new Date()
                    };

                    const appointmentDocument = doc(this.firestore, this.collectionName, id);
                    from(updateDoc(appointmentDocument, updatedAppointment)).pipe(
                        switchMap(() => this.getAppointment(id)),
                        catchError(error => {
                            console.error(`Error updating appointment with ID ${id}:`, error);
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
    getAppointmentsByCustomer(customerId: string): Observable<Appointment[]> {
        return new Observable<Appointment[]>(observer => {
            this.ngZone.run(() => {
                try {
                    console.log("AppointmentService: Getting appointments for customer ID:", customerId);
                    const appointmentsCollection = collection(this.firestore, this.collectionName);

                    // IMPORTANT: Immer innerhalb von ngZone.run() arbeiten
                    const q = query(appointmentsCollection, where('customerId', '==', customerId));
                    const subscription = collectionData(q, { idField: 'id' }).pipe(
                        map(data => {
                            console.log("AppointmentService: Raw results:", data);
                            // Datumswerte konvertieren
                            return (data as any[]).map(item => convertAppointmentDates(item) as Appointment);
                        }),
                        catchError(error => {
                            console.error(`Error fetching appointments for customer ${customerId}:`, error);
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
                    console.error('Error in getAppointmentsByCustomer:', error);
                    observer.next([]);
                    observer.complete();
                }
                return;
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

                    // Datum für die Firestore-Abfrage aufbereiten
                    const startOfDay = new Date(date);
                    startOfDay.setHours(0, 0, 0, 0);

                    const endOfDay = new Date(date);
                    endOfDay.setHours(23, 59, 59, 999);

                    // VERBESSERT: Filtere nach Benutzer UND Datum direkt in der Firestore-Abfrage
                    const q = query(
                        appointmentsCollection,
                        where(fieldName, '==', userId),
                        where('startTime', '>=', startOfDay),
                        where('startTime', '<=', endOfDay)
                    );

                    collectionData(q, { idField: 'id' }).pipe(
                        map(data => {
                            console.log(`AppointmentService: Raw results for ${fieldName}=${userId} on date ${date}:`, data);

                            // Konvertiere Datumswerte und erstelle Appointment-Objekte
                            return (data as any[]).map(item => convertAppointmentDates(item) as Appointment);

                            // Die Datums-Filterung erfolgt jetzt in der Firestore-Abfrage,
                            // nicht mehr im Client-Code
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
                return;
            });
        });
    }

    confirmAppointment(appointmentId: string): Observable<Appointment> {
        return new Observable<Appointment>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentDocument = doc(this.firestore, this.collectionName, appointmentId);
                    from(updateDoc(appointmentDocument, {
                        status: 'confirmed',
                        updatedAt: new Date()
                    })).pipe(
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
                return;
            });
        });
    }

    cancelAppointment(appointmentId: string): Observable<Appointment> {
        return new Observable<Appointment>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentDocument = doc(this.firestore, this.collectionName, appointmentId);
                    from(updateDoc(appointmentDocument, {
                        status: 'canceled',
                        updatedAt: new Date()
                    })).pipe(
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
                return;
            });
        });
    }

    completeAppointment(appointmentId: string): Observable<Appointment> {
        return new Observable<Appointment>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentDocument = doc(this.firestore, this.collectionName, appointmentId);
                    from(updateDoc(appointmentDocument, {
                        status: 'completed',
                        updatedAt: new Date()
                    })).pipe(
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
                return;
            });
        });
    }

    deleteAppointment(appointmentId: string): Observable<void> {
        return new Observable<void>(observer => {
            this.ngZone.run(() => {
                try {
                    const appointmentDocument = doc(this.firestore, this.collectionName, appointmentId);
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
                return;
            });
        });
    }

    // Methode für Provider-Appointments
    getAppointmentsByProvider(providerId: string): Observable<Appointment[]> {
        return new Observable<Appointment[]>(observer => {
            this.ngZone.run(() => {
                try {
                    console.log("AppointmentService: Getting appointments for provider ID:", providerId);
                    const appointmentsCollection = collection(this.firestore, this.collectionName);
                    
                    // WICHTIG: Der providerId-Filter muss als erster Filter verwendet werden
                    // und genau so formuliert sein, wie in den Firestore-Regeln erwartet
                    const q = query(
                        appointmentsCollection, 
                        where('providerId', '==', providerId),
                        limit(500) // Optional: Begrenze die Anzahl der zurückgegebenen Dokumente
                    );
                    
                    collectionData(q, { idField: 'id' }).pipe(
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
                return;
            });
        });
    }
}