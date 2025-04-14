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
    private firestore: Firestore = inject(Firestore);

    constructor() { }
    
  
    getProviders(): Observable<Provider[]> {
        return new Observable<Provider[]>(observer => {
            this.ngZone.run(() => {
                try {
                    const myCollection = collection(this.firestore, this.collectionName);
                    from(collectionData(myCollection, { idField: 'providerId' })).pipe(
                        map(data => data.map(d => ({...d} as Provider))),
                        catchError(error => {
                            console.error('Error fetching providers:', error);
                            return of([]); 
                        })
                    ).subscribe({
                        next: (providers) => this.ngZone.run(() => observer.next(providers)),
                        error: (err) => this.ngZone.run(() => observer.error(err)),
                        complete: () => this.ngZone.run(() => observer.complete()),
                    });
                } catch (error) {
                    this.ngZone.run(() => {
                        console.error('Error in getProviders:', error);
                    });

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
                    from(collectionData(q, { idField: 'providerId' })).pipe(
                        map((data) => data.map((d) => ({ ...d } as Provider))),
                        catchError(error => {
                            console.error(`Error fetching providers with service ${service}:`, error);
                            return of([]); 
                        })
                    ).subscribe({
                        next: providers => this.ngZone.run(() => observer.next(providers)),
                        error: err => this.ngZone.run(() => observer.error(err)),
                        complete: () => this.ngZone.run(() => observer.complete())
                    });
                } catch (error) {
                    this.ngZone.run(() => {
                        console.error('Error in getProvidersByService:', error);
                    });
                     observer.next([]);
                    observer.complete();
                }
            });
        });
    }

    getProviderByUserId(userId: string): Observable<Provider | null> {
        return new Observable<Provider | null>(observer => {
            this.ngZone.run(() => {
                try {
                    const myCollection = collection(this.firestore, this.collectionName);                    
                    const q = query(myCollection, where('userId', '==', userId));
                    from(collectionData(q, { idField: 'providerId' })).pipe(
                      map((providers) => {
                        if(providers.length > 0) {
                          return providers[0] as Provider
                        }
                        return null;
                      }),
                      catchError(error => {
                            console.error(`Error fetching provider for user ID ${userId}:`, error);
                            return of(null);

                        })
                    ).subscribe({
                        next: provider => this.ngZone.run(() => observer.next(provider)),
                        error: err => this.ngZone.run(() => observer.error(err)),
                        complete: () => this.ngZone.run(() => observer.complete())
                    });

                } catch (error) {
                   this.ngZone.run(() => {
                        console.error('Error in getProviderByUserId:', error);
                    });
                    observer.next(null);
                    observer.complete();
                }
            });
        });
    }
    
    getProvider(userId: string): Observable<Provider | undefined> {
        return new Observable<Provider | undefined>(observer => {
            this.ngZone.run(() => {
                try {
                    const document = doc(this.firestore, this.collectionName, userId);
                    from(docData(document)).pipe(
                         map(d => ({...d} as Provider)),
                        catchError(error => {
                            console.error(`Error fetching provider with ID ${userId}:`, error);
                            return of(undefined);
                        })
                    ).subscribe({
                        next: provider => this.ngZone.run(() => observer.next(provider)),
                        error: err => this.ngZone.run(() => observer.error(err)),
                        complete: () => this.ngZone.run(() => observer.complete())
                    });
                } catch (error) {
                    this.ngZone.run(() => {
                    console.error('Error in getProvider:', error);
                    observer.next(undefined);
                    observer.complete();
                });
                }
            });
        });
    }
    
    addProvider(provider: Partial<Provider>): Promise<DocumentReference> { 
        return this.ngZone.run(async () => {
            try {
                const providerWithDefaults = {
                    ...provider,
                    subscriptionStatus: provider.subscriptionStatus || 'free'
                };
                
                const myCollection = collection(this.firestore, this.collectionName);                
                const docRef = await addDoc(myCollection, providerWithDefaults);                
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
                    const document = doc(this.firestore, this.collectionName, provider.userId);                    
                    const { userId, ...providerWithoutUserId } = provider;

                    from(updateDoc(document, providerWithoutUserId)).pipe(
                        catchError(error => {                            
                            console.error('Error updating provider:', error);
                            return of(undefined);
                        })
                    ).subscribe({
                        next: () => this.ngZone.run(() => observer.next()),
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
                    const businessHoursCollection = collection(this.firestore, this.businessHoursCollectionName) ;
                    const q = query(businessHoursCollection, where('userId', '==', providerId));
                    from(collectionData(q, { idField: 'businessHoursId' })).pipe(
                         map(data => data.map(d => ({...d} as BusinessHours))),
                        catchError(error => {
                            console.error(`Error fetching business hours for user ${providerId}.`, error);
                            return of([]); 
                         })                        
                    ).subscribe({
                        next: hours => this.ngZone.run(() => observer.next(hours)),
                        error: err => this.ngZone.run(() => observer.error(err)),
                        complete: () => this.ngZone.run(() => observer.complete())

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
                    const q = query(breaksCollection, where('userId', '==', providerId));
                    from(collectionData(q, { idField: 'breakId' })).pipe(
                        map(data => data.map(d => ({...d} as ServiceBreak))),
                        catchError(error => {
                            console.error(`Error fetching breaks for user ${providerId}:`, error);
                            return of([]);                            
                        })
                    ).subscribe({
                        next: breaks => this.ngZone.run(() => observer.next(breaks)),
                        error: err => this.ngZone.run(() => observer.error(err)),
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
    
    deleteProvider(userId: string): Observable<void> {
        return new Observable<void>(observer => {
            this.ngZone.run(() => {
                try {
                    const document = doc(this.firestore, this.collectionName, userId);
                    from(deleteDoc(document)).pipe(
                        catchError(error => {
                            console.error(`Error deleting provider with ID ${userId}:`, error);
                            return of(undefined);                            
                        })
                    ).subscribe({
                        next: () => this.ngZone.run(() => observer.next()),
                        error: err => this.ngZone.run(() => observer.error(err)),
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