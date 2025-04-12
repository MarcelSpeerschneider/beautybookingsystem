import { Injectable, inject } from '@angular/core';
import { Provider } from '../models/provider.model';
import { BusinessHours } from '../models/business-hours.model';
import { ServiceBreak } from '../models/break.model';
import { from, Observable } from 'rxjs';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, query, where, DocumentReference } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ProviderService {
    private collectionName = 'providers';
    private businessHoursCollectionName = 'businessHours';
    private breaksCollectionName = 'breaks';

    firestore: Firestore = inject(Firestore);
    constructor() { }

    getProviders(): Observable<Provider[]> {
        const myCollection = collection(this.firestore, this.collectionName);
        return collectionData(myCollection, { idField: 'providerId' }) as Observable<Provider[]>;
    }

    getProvidersByService(service: string): Observable<Provider[]> {
        const providersCollection = collection(this.firestore, this.collectionName);
        const q = query(providersCollection, where('services', 'array-contains', service));
        return collectionData(q, { idField: 'providerId' }) as Observable<Provider[]>;
      }

    getProviderByUserId(userId: string): Observable<Provider | undefined> {
      const myCollection = collection(this.firestore, this.collectionName);
      const q = query(myCollection, where('userId', '==', userId));
      return collectionData(q, { idField: 'providerId' }).pipe(
        map(providers => providers[0])
      ) as Observable<Provider | undefined>;
  }
    
    getProvider(providerId: string): Observable<Provider | undefined> {
        const document = doc(this.firestore, `${this.collectionName}/${providerId}`);
        return docData(document, { idField: 'providerId' }) as Observable<Provider>;
    }
    createProvider(provider: Provider): Promise<DocumentReference> {
        const myCollection = collection(this.firestore, this.collectionName);
        return addDoc(myCollection, provider)
        
    }
    updateProvider(provider: Provider): Observable<void> {
        const document = doc(this.firestore, `${this.collectionName}/${provider.providerId}`);
        return from(updateDoc(document, { ...provider }));
    }
    getOpeningHours(providerId: string): Observable<BusinessHours[]> {
        const businessHoursCollection = collection(this.firestore, 'businessHours');
        const q = query(businessHoursCollection, where('providerId', '==', providerId));
        return collectionData(q) as Observable<BusinessHours[]>;
    }
    getBreaks(providerId: string): Observable<ServiceBreak[]> {
        const breaksCollection = collection(this.firestore, 'breaks');
        const q = query(breaksCollection, where('providerId', '==', providerId));
        return collectionData(q) as Observable<ServiceBreak[]>;
    }
    deleteProvider(providerId:string): Observable<void> {
        const document = doc(this.firestore, `${this.collectionName}/${providerId}`);
        return from(deleteDoc(document));
    }
}



