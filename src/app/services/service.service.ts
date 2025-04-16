import { Injectable, inject, NgZone } from '@angular/core';
import { Service } from '../models/service.model';
import { Observable, of, from } from 'rxjs';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ServiceService {
  private collectionName = 'services';
  firestore: Firestore = inject(Firestore);
  private ngZone = inject(NgZone);

  constructor() { }

  getServices(): Observable<(Service & { id: string })[]> {
    return new Observable<(Service & { id: string })[]>(observer => {
        this.ngZone.run(() => {
            try {
                const collectionRef = collection(this.firestore, this.collectionName);
                const subscription = collectionData(collectionRef, { idField: 'id' })
                    .pipe(
                        map(data => data as (Service & { id: string })[]),
                        catchError(error => {
                            console.error('Error fetching services:', error);
                            return of([]);
                        })
                    )
                    .subscribe({
                        next: services => this.ngZone.run(() => observer.next(services)),
                        error: err => this.ngZone.run(() => observer.error(err)),
                        complete: () => this.ngZone.run(() => observer.complete())
                    });
                
                // Aufräumen beim Abbestellen    
                return () => subscription.unsubscribe();
            } catch (error) {
                console.error('Error in getServices:', error);
                observer.next([]);
                observer.complete();
            }
            return;
        });
    });
  }

  getService(serviceId: string): Observable<Service & { id: string }> {
    return new Observable<Service & { id: string }>(observer => {
      this.ngZone.run(() => {
        try {
          const documentRef = doc(this.firestore, `${this.collectionName}/${serviceId}`);
          docData(documentRef, { idField: 'id' })
            .pipe(
              map(data => data as (Service & { id: string })),
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
        return;
      });
    });
  }

  async createService(service: Service): Promise<string> {
    return this.ngZone.run(async () => {
      try {
        console.log('Creating service:', service);
        const servicesCollection = collection(this.firestore, this.collectionName);
        
        // Erstelle ein Service-Objekt ohne ID (wird von Firestore generiert)
        const serviceToSave = {
          ...service,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const docRef = await addDoc(servicesCollection, serviceToSave);
        console.log('Service created with ID:', docRef.id);
        return docRef.id;
      } catch (error) {
        console.error('Error creating service:', error);
        throw error;
      }
    });
  }

  updateService(service: Service & { id: string }): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        // Extrahiere die ID und aktualisiere die Daten ohne die ID
        const { id, ...serviceData } = service;
        
        const documentRef = doc(this.firestore, this.collectionName, id);
        
        // Aktualisiere auch das updatedAt-Feld
        const updatedService = {
          ...serviceData,
          updatedAt: new Date()
        };
        
        return updateDoc(documentRef, updatedService);
      } catch (error) {
        console.error('Error updating service:', error);
        throw error;
      }
    });
  }

  deleteService(serviceId: string): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        const documentRef = doc(this.firestore, this.collectionName, serviceId);
        return deleteDoc(documentRef);
      } catch (error) {
        console.error('Error deleting service:', error);
        throw error;
      }
    });
  }

  getServicesByProvider(providerId: string): Observable<(Service & { id: string })[]> {
    return new Observable<(Service & { id: string })[]>(observer => {
      this.ngZone.run(() => {
        try {
          const servicesCollection = collection(this.firestore, this.collectionName);
          const q = query(servicesCollection, where('providerId', '==', providerId));
          
          collectionData(q, { idField: 'id' })
            .pipe(
              map(data => data as (Service & { id: string })[]),
              catchError(error => {
                console.error(`Error fetching services for provider ${providerId}:`, error);
                return of([]);
              })
            )
            .subscribe({
              next: services => observer.next(services),
              error: err => observer.error(err),
              complete: () => observer.complete()
            });
        } catch (error) {
          console.error('Error in getServicesByProvider:', error);
          observer.next([]);
          observer.complete();
        }
        return;
      });
    });
  }
}