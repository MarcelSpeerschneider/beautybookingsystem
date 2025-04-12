import { Injectable, inject } from '@angular/core';
import { Service } from '../models/service.model';
import { Observable, of } from 'rxjs';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, DocumentReference, query, where } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ServiceService {
  private collectionName = 'services';
  firestore: Firestore = inject(Firestore);
  constructor() {
  }

  getServices(): Observable<Service[]> {
    const collectionRef = collection(this.firestore, this.collectionName);
    return collectionData(collectionRef, { idField: 'serviceId' }) as Observable<Service[]>;
  }

  getService(serviceId: string): Observable<Service> {
    const documentRef = doc(this.firestore, `${this.collectionName}/${serviceId}`);
    return docData(documentRef, { idField: 'serviceId' }) as Observable<Service>;
  }

  createService(service: Service): Promise<DocumentReference> {
    const servicesCollection = collection(this.firestore, this.collectionName);
    return addDoc(servicesCollection, service);
  }

  updateService(service: Service): Promise<void> {
    const documentRef = doc(this.firestore, `${this.collectionName}/${service.serviceId}`);
    return updateDoc(documentRef, { ...service });
  }

  deleteService(serviceId: string): Promise<void> {
    const documentRef = doc(this.firestore, `${this.collectionName}/${serviceId}`);
    return deleteDoc(documentRef);
  }

  getServicesByProvider(providerId: string): Observable<Service[]> {
    const servicesCollection = collection(this.firestore, this.collectionName);
    const q = query(servicesCollection, where('providerId', '==', providerId));
    return collectionData(q, { idField: 'serviceId' }) as Observable<Service[]>;
  }
  isServiceAvailable(serviceId: string, date: Date, time: string): Observable<boolean> { return of(true); }
}
