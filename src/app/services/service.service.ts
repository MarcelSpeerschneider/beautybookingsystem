import { Injectable, inject, NgZone } from '@angular/core';
import { Service } from '../models/service.model';
import { Observable, of, from } from 'rxjs';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, DocumentReference, query, where } from '@angular/fire/firestore';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ServiceService {
  private collectionName = 'services';
  firestore: Firestore = inject(Firestore);
  private ngZone = inject(NgZone);

  constructor() { }

  getServices(): Observable<Service[]> {
    // Zone-spezifischer Ansatz: Verwenden Sie ngZone zum Umschließen der Firebase-Aufrufe
    return new Observable<Service[]>(observer => {
      this.ngZone.run(() => {
        try {
          const collectionRef = collection(this.firestore, this.collectionName);
          collectionData(collectionRef, { idField: 'serviceId' })
            .pipe(
              map(data => data as Service[]),
              catchError(error => {
                console.error('Error fetching services:', error);
                return of([]);
              })
            )
            .subscribe({
              next: services => observer.next(services),
              error: err => observer.error(err),
              complete: () => observer.complete()
            });
        } catch (error) {
          console.error('Error in getServices:', error);
          observer.next([]);
          observer.complete();
        }
      });
    });
  }

  getService(serviceId: string): Observable<Service> {
    return new Observable<Service>(observer => {
      this.ngZone.run(() => {
        try {
          const documentRef = doc(this.firestore, `${this.collectionName}/${serviceId}`);
          docData(documentRef, { idField: 'serviceId' })
            .pipe(
              map(data => data as Service),
              catchError(error => {
                console.error(`Error fetching service with ID ${serviceId}:`, error);
                return of(null as any);
              })
            )
            .subscribe({
              next: service => observer.next(service),
              error: err => observer.error(err),
              complete: () => observer.complete()
            });
        } catch (error) {
          console.error('Error in getService:', error);
          observer.next(null as any);
          observer.complete();
        }
      });
    });
  }

  createService(service: Service): Promise<DocumentReference> {
    return this.ngZone.run(() => {
      const servicesCollection = collection(this.firestore, this.collectionName);
      return addDoc(servicesCollection, service);
    });
  }

  updateService(service: Service): Promise<void> {
    return this.ngZone.run(() => {
      const documentRef = doc(this.firestore, `${this.collectionName}/${service.id}`);
      return updateDoc(documentRef, { ...service });
    });
  }

  deleteService(serviceId: string): Promise<void> {
    return this.ngZone.run(() => {
      const documentRef = doc(this.firestore, `${this.collectionName}/${serviceId}`);
      return deleteDoc(documentRef);
    });
  }

  getServicesByUser(userId: string): Observable<Service[]> {
    return new Observable<Service[]>(observer => {
      this.ngZone.run(() => {
        try {
          const servicesCollection = collection(this.firestore, this.collectionName);
          const q = query(servicesCollection, where('userId', '==', userId));
          collectionData(q, { idField: 'serviceId' })
            .pipe(
              map(data => data as Service[]),
              catchError(error => {
                return of([]);
              })
            )
            .subscribe({
              next: services => observer.next(services),
              error: err => observer.error(err),
              complete: () => observer.complete()
            });
        } catch (error) {
          console.error('Error in getServicesByUser:', error);
          observer.next([]);
          observer.complete();
        }
      });
    });
  }

  isServiceAvailable(serviceId: string, date: Date, time: string): Observable<boolean> {
    return this.ngZone.run(() => of(true));
  }
}