import { Injectable, inject } from '@angular/core';
import { Appointment } from '../models/appointment.model';
import { Observable, from, of } from 'rxjs';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, DocumentReference, query, where } from '@angular/fire/firestore';
import { map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
    firestore: Firestore = inject(Firestore);
    private collectionName = 'appointments';
    
    constructor() {
    }

    getAppointments(): Observable<Appointment[]> {
        const appointmentsCollection = collection(this.firestore, this.collectionName);
        return collectionData(appointmentsCollection, { idField: 'appointmentId' }) as Observable<Appointment[]>;
    }

    getAppointment(appointmentId: string): Observable<Appointment> {
        const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
        return docData(appointmentDocument, { idField: 'appointmentId' }) as Observable<Appointment>;
    }

    createAppointment(appointment: Appointment): Promise<DocumentReference> {
        const appointmentsCollection = collection(this.firestore, this.collectionName);
        return addDoc(appointmentsCollection, appointment);

    }

    updateAppointment(appointment: Appointment): Observable<Appointment> {
        const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointment.appointmentId}`);
        return from(updateDoc(appointmentDocument, { ...appointment })).pipe(
            switchMap(() => this.getAppointment(appointment.appointmentId))
        );
    }

    getAppointmentsByProvider(providerId: string): Observable<Appointment[]> {
      const appointmentsCollection = collection(this.firestore, this.collectionName);
      const q = query(appointmentsCollection, where('providerId', '==', providerId));
      return collectionData(q, { idField: 'appointmentId' }) as Observable<Appointment[]>;
    }


    getAppointmentsByProviderAndDate(providerId: string, date: Date): Observable<Appointment[]> {
      const appointmentsCollection = collection(this.firestore, this.collectionName);
      const q = query(appointmentsCollection, where('providerId', '==', providerId));
      return collectionData(q, { idField: 'appointmentId' }) as Observable<Appointment[]>;

    }
  
    getAppointmentsByDate(date: Date): Observable<any[]> {
      // Todo
      return of([] as any[]);
    }
  
    getAvailableAppointments(providerId: string, date: Date, serviceId: string): Observable<Appointment[]> {
      //Todo
      return of([] as any[]);
    }

    confirmAppointment(appointmentId: string): Observable<Appointment> {
        const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
        return from(updateDoc(appointmentDocument, { status: 'confirmed' })).pipe(
            switchMap(() => this.getAppointment(appointmentId))
        );
    }
    cancelAppointment(appointmentId: string): Observable<Appointment> {
        const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
        return from(updateDoc(appointmentDocument, { status: 'canceled' })).pipe(
            switchMap(() => this.getAppointment(appointmentId))
        );
    }
    completeAppointment(appointmentId: string): Observable<Appointment> {
        const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
        return from(updateDoc(appointmentDocument, { status: 'completed' })).pipe(
            switchMap(() => this.getAppointment(appointmentId))
        );
    }

    deleteAppointment(appointmentId: string): Observable<void> {
        const appointmentDocument = doc(this.firestore, `${this.collectionName}/${appointmentId}`);
        return from(deleteDoc(appointmentDocument));
    }
}