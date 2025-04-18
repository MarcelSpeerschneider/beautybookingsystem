import { Injectable, inject, NgZone } from '@angular/core';
import { Provider } from '../models/provider.model';
import { BusinessHours } from '../models/business-hours.model';
import { ServiceBreak } from '../models/break.model';
import { Observable, from, of } from 'rxjs';
import { 
  Firestore, 
  collection, 
  collectionData, 
  doc, 
  docData, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs 
} from '@angular/fire/firestore';
import { map, catchError } from 'rxjs/operators';
import { ZoneUtils } from '../utils/zone-utils';

@Injectable({
  providedIn: 'root'
})
export class ProviderService {
  private collectionName = 'providers';
  private businessHoursCollectionName = 'businessHours';
  private breaksCollectionName = 'breaks';

  private ngZone = inject(NgZone);
  private firestore: Firestore = inject(Firestore);

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
  
  private getDocsInZone(queryRef: any): Promise<any> {
    return this.ngZone.run(() => getDocs(queryRef));
  }

  getProviders(): Observable<(Provider & { providerId: string })[]> {
    return ZoneUtils.wrapObservable(() => {
      try {
        const myCollection = this.collectionInZone(this.collectionName);
        return from(this.ngZone.run(() => collectionData(myCollection, { idField: 'providerId' }))).pipe(
          map(data => data.map(d => ({...d} as (Provider & { providerId: string })))),
          catchError(error => {
            console.error('Error fetching providers:', error);
            return of([]); 
          })
        );
      } catch (error) {
        console.error('Error in getProviders:', error);
        return of([]);
      }
    }, this.ngZone);
  }

  getProvidersByService(service: string): Observable<(Provider & { providerId: string })[]> {
    return ZoneUtils.wrapObservable(() => {
      try {
        const providersCollection = this.collectionInZone(this.collectionName);
        const q = this.queryInZone(providersCollection, where('services', 'array-contains', service));
        return from(this.ngZone.run(() => collectionData(q, { idField: 'providerId' }))).pipe(
          map((data) => data.map((d) => ({ ...d } as (Provider & { providerId: string })))),
          catchError(error => {
            console.error(`Error fetching providers with service ${service}:`, error);
            return of([]); 
          })
        );
      } catch (error) {
        console.error('Error in getProvidersByService:', error);
        return of([]);
      }
    }, this.ngZone);
  }

  getProviderByEmail(email: string): Observable<(Provider & { providerId: string }) | null> {
    return ZoneUtils.wrapObservable(() => {
      try {
        const myCollection = this.collectionInZone(this.collectionName);                    
        const q = this.queryInZone(myCollection, where('email', '==', email));
        return from(this.ngZone.run(() => collectionData(q, { idField: 'providerId' }))).pipe(
          map((providers) => {
            if(providers.length > 0) {
              return providers[0] as (Provider & { providerId: string });
            }
            return null;
          }),
          catchError(error => {
            console.error(`Error fetching provider for email ${email}:`, error);
            return of(null);
          })
        );
      } catch (error) {
        console.error('Error in getProviderByEmail:', error);
        return of(null);
      }
    }, this.ngZone);
  }
  
  getProvider(providerId: string): Observable<(Provider & { providerId: string }) | undefined> {
    return ZoneUtils.wrapObservable(() => {
      try {
        const document = this.docInZone(this.collectionName, providerId);
        // Hier docData mit NgZone umwickeln
        return from(this.docDataInZone(document, { idField: 'providerId' })).pipe(
          map(d => ({...d} as (Provider & { providerId: string }))),
          catchError(error => {
            console.error(`Error fetching provider with ID ${providerId}:`, error);
            return of(undefined);
          })
        );
      } catch (error) {
        console.error('Error in getProvider:', error);
        return of(undefined);
      }
    }, this.ngZone);
  }
  
  addProvider(provider: Provider, userId: string): Promise<string> { 
    return ZoneUtils.wrapPromise(async () => {
      try {
        console.log('Creating provider with data:', provider);
        
        const providerWithDefaults = {
          ...provider,
          subscriptionStatus: provider.subscriptionStatus || 'free',
          role: 'provider', // Immer die Rolle 'provider' setzen
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // GEÄNDERT: Verwende setDoc mit expliziter Dokument-ID (Auth-UID)
        const providerDoc = this.docInZone(this.collectionName, userId);             
        await this.ngZone.run(() => setDoc(providerDoc, providerWithDefaults));                
        console.log('Provider created successfully with ID:', userId);                
        return userId;       
      } catch (error) {
        console.error('Error creating provider:', error);
        throw error;
      }
    }, this.ngZone);
  }
  
  updateProvider(providerId: string, providerData: Partial<Provider>): Promise<void> {        
    return ZoneUtils.wrapPromise(async () => {
      try {
        const document = this.docInZone(this.collectionName, providerId);                    
        
        // Update updatedAt field and ensure role is preserved
        const updatedProvider = {
          ...providerData,
          role: 'provider', // Stelle sicher, dass die Rolle nicht überschrieben wird
          updatedAt: new Date()
        };
        
        return this.ngZone.run(() => updateDoc(document, updatedProvider));
      } catch (error) {
        console.error('Error in updateProvider:', error);
        throw error;
      }
    }, this.ngZone);
  }
  
  deleteProvider(providerId: string): Promise<void> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        const document = this.docInZone(this.collectionName, providerId);
        return this.ngZone.run(() => deleteDoc(document));
      } catch (error) {
        console.error('Error in deleteProvider:', error);
        throw error;
      }
    }, this.ngZone);
  }
}