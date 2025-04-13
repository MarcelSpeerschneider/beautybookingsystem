import { Injectable, inject, NgZone } from '@angular/core';
import { Provider } from '../models/provider.model';
import { BusinessHours } from '../models/business-hours.model';
import { ServiceBreak } from '../models/break.model';
import { from, Observable, of, catchError } from 'rxjs';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, query, where, DocumentReference } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})

export class ProviderService {
    private collectionName = 'providers';
    private businessHoursCollectionName = 'businessHours';
    private breaksCollectionName = 'breaks';

    private ngZone = inject(NgZone);

    constructor(private firestore: Firestore) {
        this.firestore = inject(Firestore);
     }
    
  
    getProviders(): Observable<Provider[]> {
        return new Observable<Provider[]>(observer => {
            this.ngZone.run(() => {
                try {
                    const myCollection = collection(this.firestore, this.collectionName);
                    collectionData(myCollection, { idField: 'providerId' }).pipe(
                        map(data => data as Provider[]),
                        catchError(error => {
                            console.error('Error fetching providers:', error);
                            return of([]);
                        })
                    ).subscribe({
                        next: providers => observer.next(providers),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in getProviders:', error);
                    observer.next([]);
                    observer.complete();
                }
            });
        });
    }

    getProvidersByService(service: string): Observable<Provider[]> {
        return new Observable<Provider[]>(observer => {
            this.ngZone.run(() => {
                try {
                    const providersCollection = collection(this.firestore, this.collectionName);
                    const q = query(providersCollection, where('services', 'array-contains', service));
                    collectionData(q, { idField: 'providerId' }).pipe(
                        map(data => data as Provider[]),
                        catchError(error => {
                            console.error(`Error fetching providers with service ${service}:`, error);
                            return of([]);
                        })
                    ).subscribe({
                        next: providers => observer.next(providers),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in getProvidersByService:', error);
                    observer.next([]);
                    observer.complete();
                }
            });
        });
    }

    getProviderByUserId(userId: string): Observable<Provider | undefined> {
        return new Observable<Provider | undefined>(observer => {
            this.ngZone.run(() => {
                try {
                    console.log('Fetching provider for userId:', userId);
                    const myCollection = collection(this.firestore, this.collectionName);
                    const q = query(myCollection, where('userId', '==', userId));
                    collectionData(q, { idField: 'providerId' }).pipe(
                        map(providers => {
                            const providerArray = providers as Provider[];
                            console.log('Provider query result:', providerArray.length > 0 ? 'Found' : 'Not found');
                            return providerArray.length > 0 ? providerArray[0] : undefined;
                        }),
                        catchError(error => {
                            console.error(`Error fetching provider for user ID ${userId}:`, error);
                            return of(undefined);
                        })
                    ).subscribe({
                        next: provider => observer.next(provider),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in getProviderByUserId:', error);
                    observer.next(undefined);
                    observer.complete();
                }
            });
        });
    }
    
    getProvider(providerId: string): Observable<Provider | undefined> {
        return new Observable<Provider | undefined>(observer => {
            this.ngZone.run(() => {
                try {
                    const document = doc(this.firestore, `${this.collectionName}/${providerId}`);
                    docData(document, { idField: 'providerId' }).pipe(
                        map(data => data as Provider),
                        catchError(error => {
                            console.error(`Error fetching provider with ID ${providerId}:`, error);
                            return of(undefined);
                        })
                    ).subscribe({
                        next: provider => observer.next(provider),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in getProvider:', error);
                    observer.next(undefined);
                    observer.complete();
                }
            });
        });
    }
    
    addProvider(provider: Partial<Provider>): Promise<DocumentReference> { 
        return this.ngZone.run(async () => {
            try {
                console.log('Creating new provider:', provider);
                const myCollection = collection(this.firestore, 'providers');
                const docRef = await addDoc(myCollection, provider);
                console.log('Provider created successfully with ID:', docRef.id);
                return docRef;
            } catch (error) {
                console.error('Error creating provider:', error);
                throw error;
            }
        });
    }
    
    updateProvider(provider: Provider): Observable<void> {
        return new Observable<void>(observer => {
            this.ngZone.run(() => {
                try {
                    const document = doc(this.firestore, `${this.collectionName}/${provider.providerId}`);
                    from(updateDoc(document, { ...provider })).pipe(
                        catchError(error => {
                            console.error(`Error updating provider with ID ${provider.providerId}:`, error);
                            return of(undefined);
                        })
                    ).subscribe({
                        next: () => observer.next(),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in updateProvider:', error);
                    observer.next();
                    observer.complete();
                }
            });
        });
    }
    
    getOpeningHours(providerId: string): Observable<BusinessHours[]> {
        return new Observable<BusinessHours[]>(observer => {
            this.ngZone.run(() => {
                try {
                    const businessHoursCollection = collection(this.firestore, this.businessHoursCollectionName);
                    const q = query(businessHoursCollection, where('providerId', '==', providerId));
                    collectionData(q).pipe(
                        map(data => data as BusinessHours[]),
                        catchError(error => {
                            console.error(`Error fetching business hours for provider ${providerId}:`, error);
                            return of([]);
                        })
                    ).subscribe({
                        next: hours => observer.next(hours),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in getOpeningHours:', error);
                    observer.next([]);
                    observer.complete();
                }
            });
        });
    }
    
    getBreaks(providerId: string): Observable<ServiceBreak[]> {
        return new Observable<ServiceBreak[]>(observer => {
            this.ngZone.run(() => {
                try {
                    const breaksCollection = collection(this.firestore, this.breaksCollectionName);
                    const q = query(breaksCollection, where('providerId', '==', providerId));
                    collectionData(q).pipe(
                        map(data => data as ServiceBreak[]),
                        catchError(error => {
                            console.error(`Error fetching breaks for provider ${providerId}:`, error);
                            return of([]);
                        })
                    ).subscribe({
                        next: breaks => observer.next(breaks),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in getBreaks:', error);
                    observer.next([]);
                    observer.complete();
                }
            });
        });
    }
    
    deleteProvider(providerId: string): Observable<void> {
        return new Observable<void>(observer => {
            this.ngZone.run(() => {
                try {
                    const document = doc(this.firestore, `${this.collectionName}/${providerId}`);
                    from(deleteDoc(document)).pipe(
                        catchError(error => {
                            console.error(`Error deleting provider with ID ${providerId}:`, error);
                            return of(undefined);
                        })
                    ).subscribe({
                        next: () => observer.next(),
                        error: err => observer.error(err),
                        complete: () => observer.complete()
                    });
                } catch (error) {
                    console.error('Error in deleteProvider:', error);
                    observer.next();
                    observer.complete();
                }
            });
        });
    }
}