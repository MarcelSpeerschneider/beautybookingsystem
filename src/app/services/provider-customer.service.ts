import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, take, catchError } from 'rxjs/operators';
import { 
  Firestore, collection, doc, collectionData, docData, 
  addDoc, updateDoc, deleteDoc, query, where, DocumentReference, 
  setDoc, getDoc, getDocs,
} from '@angular/fire/firestore';
import { ProviderCustomerRelation } from '../models/provider-customer-relation.model';

@Injectable({
  providedIn: 'root'
})
export class ProviderCustomerService {
  private collectionName = 'providerCustomerRelations';
  firestore: Firestore = inject(Firestore);
  private ngZone = inject(NgZone);

  constructor() { }

  // Kundenbeziehungen für einen Provider laden
  getCustomerRelationsByProvider(providerId: string): Observable<ProviderCustomerRelation[]> {
    return new Observable<ProviderCustomerRelation[]>(observer => {
      this.ngZone.run(() => {
        try {
          console.log(`Fetching customer relations for provider: ${providerId}`);
          const relationsCollection = collection(this.firestore, this.collectionName);
          const q = query(relationsCollection, where('providerId', '==', providerId));
          
          const subscription = collectionData(q, { idField: 'relationId' }).pipe(
            map(relations => {
              console.log(`Found ${relations.length} customer relations for provider ${providerId}`);
              return relations as ProviderCustomerRelation[];
            }),
            catchError(error => {
              console.error('Error loading customer relations:', error);
              return of([]);
            })
          ).subscribe({
            next: relations => this.ngZone.run(() => observer.next(relations)),
            error: err => this.ngZone.run(() => observer.error(err)),
            complete: () => this.ngZone.run(() => observer.complete())
          });
          
          return () => subscription.unsubscribe();
        } catch (error) {
          console.error('Error in getCustomerRelationsByProvider:', error);
          observer.next([]);
          observer.complete();
        }
      });
    });
  }

  // Eine spezifische Provider-Kunden-Beziehung abrufen
  getRelation(providerId: string, customerId: string): Observable<ProviderCustomerRelation | undefined> {
    return new Observable<ProviderCustomerRelation | undefined>(observer => {
      this.ngZone.run(() => {
        try {
          console.log(`Looking for relation between provider ${providerId} and customer ${customerId}`);
          const relationsCollection = collection(this.firestore, this.collectionName);
          const q = query(
            relationsCollection, 
            where('providerId', '==', providerId),
            where('customerId', '==', customerId)
          );
          
          const subscription = collectionData(q, { idField: 'relationId' }).pipe(
            map(relations => {
              if (relations.length > 0) {
                console.log(`Relation found between provider ${providerId} and customer ${customerId}`);
                return relations[0] as ProviderCustomerRelation;
              } else {
                console.log(`No relation found between provider ${providerId} and customer ${customerId}`);
                return undefined;
              }
            }),
            catchError(error => {
              console.error('Error fetching provider-customer relation:', error);
              return of(undefined);
            })
          ).subscribe({
            next: relation => this.ngZone.run(() => observer.next(relation)),
            error: err => this.ngZone.run(() => observer.error(err)),
            complete: () => this.ngZone.run(() => observer.complete())
          });
          
          return () => subscription.unsubscribe();
        } catch (error) {
          console.error('Error in getRelation:', error);
          observer.next(undefined);
          observer.complete();
        }
      });
    });
  }
  
  // Kundennotes aktualisieren - Vereinfacht, speichert nur Notizen
  updateCustomerNotes(providerId: string, customerId: string, notes: string): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        console.log(`Updating notes for customer ${customerId} by provider ${providerId}`);
        
        // Prüfen, ob bereits eine Beziehung existiert
        const relationsCollection = collection(this.firestore, this.collectionName);
        const q = query(
          relationsCollection,
          where('providerId', '==', providerId),
          where('customerId', '==', customerId)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Bestehende Beziehung aktualisieren
          const relationDoc = querySnapshot.docs[0];
          const docRef = doc(this.firestore, `${this.collectionName}/${relationDoc.id}`);
          
          console.log(`Updating existing relation with ID: ${relationDoc.id}`);
          return updateDoc(docRef, { 
            notes, 
            updatedAt: new Date() 
          });
        } else {
          // Neue Beziehung erstellen
          console.log(`Creating new relation between provider ${providerId} and customer ${customerId}`);
          const newRelation: ProviderCustomerRelation = {
            relationId: '',  // Wird von Firestore generiert
            providerId,
            customerId,
            notes,
            firstVisit: new Date(),
            lastVisit: new Date(),
            visitCount: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await addDoc(relationsCollection, newRelation);
          return;
        }
      } catch (error) {
        console.error('Error updating customer notes:', error);
        throw error;
      }
    });
  }
  
  // Beziehung nach Termin aktualisieren
  updateRelationAfterAppointment(
    providerId: string, 
    customerId: string, 
    appointmentDate: Date, 
    amount: number = 0,
    customerData?: { firstName?: string; lastName?: string; email?: string; phone?: string }
  ): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        console.log(`Updating relation for provider: ${providerId}, customer: ${customerId}`);
        
        // Prüfen, ob bereits eine Beziehung existiert
        const relationsCollection = collection(this.firestore, this.collectionName);
        const q = query(
          relationsCollection,
          where('providerId', '==', providerId),
          where('customerId', '==', customerId)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          console.log('Existing relation found, updating...');
          // Bestehende Beziehung aktualisieren
          const relationDoc = querySnapshot.docs[0];
          const docRef = doc(this.firestore, `${this.collectionName}/${relationDoc.id}`);
          const existingData = relationDoc.data() as ProviderCustomerRelation;
          
          const updateData: any = { 
            lastVisit: appointmentDate,
            visitCount: (existingData.visitCount || 0) + 1,
            totalSpent: (existingData.totalSpent || 0) + amount,
            updatedAt: new Date()
          };
          
          return updateDoc(docRef, updateData);
        } else {
          console.log('No existing relation, creating new one');
          
          // Neue Beziehung erstellen
          const newRelation: any = {
            providerId,
            customerId,
            firstVisit: appointmentDate,
            lastVisit: appointmentDate,
            visitCount: 1,
            totalSpent: amount,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          console.log('Creating relation with data:', newRelation);
          
          // Dokument mit addDoc erstellen
          await addDoc(relationsCollection, newRelation);
          return;
        }
      } catch (error) {
        console.error('Error updating relation after appointment:', error);
        throw error;
      }
    });
  }
}

// Hilfsfunktion für firstValueFrom
export function firstValueFrom<T>(source: Observable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const subscription = source.pipe(
      take(1)
    ).subscribe({
      next: value => {
        resolve(value);
        subscription.unsubscribe();
      },
      error: err => {
        reject(err);
        subscription.unsubscribe();
      }
    });
  });
}