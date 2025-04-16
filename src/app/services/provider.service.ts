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

  getProviders(): Observable<(Provider & { providerId: string })[]> {
    return ZoneUtils.wrapObservable(() => {
      try {
        const myCollection = collection(this.firestore, this.collectionName);
        return from(collectionData(myCollection, { idField: 'providerId' })).pipe(
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
        const providersCollection = collection(this.firestore, this.collectionName);
        const q = query(providersCollection, where('services', 'array-contains', service));
        return from(collectionData(q, { idField: 'providerId' })).pipe(
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
        const myCollection = collection(this.firestore, this.collectionName);                    
        const q = query(myCollection, where('email', '==', email));
        return from(collectionData(q, { idField: 'providerId' })).pipe(
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
        const document = doc(this.firestore, this.collectionName, providerId);
        return from(docData(document, { idField: 'providerId' })).pipe(
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
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // GEÄNDERT: Verwende setDoc mit expliziter Dokument-ID (Auth-UID)
        const providerDoc = doc(this.firestore, this.collectionName, userId);             
        await setDoc(providerDoc, providerWithDefaults);                
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
        const document = doc(this.firestore, this.collectionName, providerId);                    
        
        // Update updatedAt field
        const updatedProvider = {
          ...providerData,
          updatedAt: new Date()
        };
        
        return updateDoc(document, updatedProvider);
      } catch (error) {
        console.error('Error in updateProvider:', error);
        throw error;
      }
    }, this.ngZone);
  }
  
  deleteProvider(providerId: string): Promise<void> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        const document = doc(this.firestore, this.collectionName, providerId);
        return deleteDoc(document);
      } catch (error) {
        console.error('Error in deleteProvider:', error);
        throw error;
      }
    }, this.ngZone);
  }
}