import { Injectable, inject, NgZone } from '@angular/core';
import { Service } from '../models/service.model';
import { Observable, of, from } from 'rxjs';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { map, catchError } from 'rxjs/operators';
import { ZoneUtils } from '../utils/zone-utils';

@Injectable({
  providedIn: 'root'
})
export class ServiceService {
  private collectionName = 'services';
  firestore: Firestore = inject(Firestore);
  private ngZone = inject(NgZone);

  // Helper methods for Firebase operations
  private docInZone(path: string, ...pathSegments: string[]): any {
    return this.ngZone.run(() => doc(this.firestore, path, ...pathSegments));
  }
  
  private docDataInZone(docRef: any, options?: any): Observable<any> {
    return this.ngZone.run(() => docData(docRef, options));
  }
  
  private collectionInZone(path: string): any {
    return this.ngZone.run(() => collection(this.firestore, path));
  }
  
  private queryInZone(collectionRef: any, ...queryConstraints: any[]): any {
    return this.ngZone.run(() => query(collectionRef, ...queryConstraints));
  }

  getServices(): Observable<(Service & { id: string })[]> {
    return ZoneUtils.wrapObservable(() => {
      try {
        const collectionRef = this.collectionInZone(this.collectionName);
        return this.ngZone.run(() => collectionData(collectionRef, { idField: 'id' }))
          .pipe(
            map(data => data as (Service & { id: string })[]),
            catchError(error => {
              console.error('Error fetching services:', error);
              return of([]);
            })
          );
      } catch (error) {
        console.error('Error in getServices:', error);
        return of([]);
      }
    }, this.ngZone);
  }

  getService(serviceId: string): Observable<Service & { id: string }> {
    return ZoneUtils.wrapObservable(() => {
      try {
        const documentRef = this.docInZone(`${this.collectionName}/${serviceId}`);
        // Hier docData mit NgZone umwickeln
        return this.docDataInZone(documentRef, { idField: 'id' })
          .pipe(
            map(data => data as (Service & { id: string })),
            catchError(error => {
              console.error(`Error fetching service with ID ${serviceId}:`, error);
              return of(null as any);
            })
          );
      } catch (error) {
        console.error('Error in getService:', error);
        return of(null as any);
      }
    }, this.ngZone);
  }

  createService(service: Service): Promise<string> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        console.log('Creating service:', service);
        const servicesCollection = this.collectionInZone(this.collectionName);
        
        // Erstelle ein Service-Objekt ohne ID (wird von Firestore generiert)
        const serviceToSave = {
          ...service,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const docRef = await this.ngZone.run(() => addDoc(servicesCollection, serviceToSave));
        console.log('Service created with ID:', docRef.id);
        return docRef.id;
      } catch (error) {
        console.error('Error creating service:', error);
        throw error;
      }
    }, this.ngZone);
  }

  updateService(service: Service & { id: string }): Promise<void> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        // Extrahiere die ID und aktualisiere die Daten ohne die ID
        const { id, ...serviceData } = service;
        
        const documentRef = this.docInZone(this.collectionName, id);
        
        // Aktualisiere auch das updatedAt-Feld
        const updatedService = {
          ...serviceData,
          updatedAt: new Date()
        };
        
        return this.ngZone.run(() => updateDoc(documentRef, updatedService));
      } catch (error) {
        console.error('Error updating service:', error);
        throw error;
      }
    }, this.ngZone);
  }

  deleteService(serviceId: string): Promise<void> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        const documentRef = this.docInZone(this.collectionName, serviceId);
        return this.ngZone.run(() => deleteDoc(documentRef));
      } catch (error) {
        console.error('Error deleting service:', error);
        throw error;
      }
    }, this.ngZone);
  }

  getServicesByProvider(providerId: string): Observable<(Service & { id: string })[]> {
    return ZoneUtils.wrapObservable(() => {
      try {
        const servicesCollection = this.collectionInZone(this.collectionName);
        const q = this.queryInZone(servicesCollection, where('providerId', '==', providerId));
        
        return this.ngZone.run(() => collectionData(q, { idField: 'id' }))
          .pipe(
            map(data => data as (Service & { id: string })[]),
            catchError(error => {
              console.error(`Error fetching services for provider ${providerId}:`, error);
              return of([]);
            })
          );
      } catch (error) {
        console.error('Error in getServicesByProvider:', error);
        return of([]);
      }
    }, this.ngZone);
  }
}