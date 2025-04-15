import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, take, catchError } from 'rxjs/operators';
import { 
  Firestore, collection, doc, collectionData, docData, 
  addDoc, updateDoc, deleteDoc, query, where, DocumentReference, 
  setDoc, getDoc, QuerySnapshot, DocumentData, QueryDocumentSnapshot, getDocs,
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

  // Verbesserte Methode zum Abrufen der Kundenbeziehungen eines Providers
  getCustomerRelationsByProvider(providerId: string): Observable<ProviderCustomerRelation[]> {
    return new Observable<ProviderCustomerRelation[]>(observer => {
      this.ngZone.run(() => {
        try {
          console.log('Lade Kundenbeziehungen für Provider:', providerId);
          
          const relationsCollection = collection(this.firestore, this.collectionName);
          const q = query(relationsCollection, where('providerId', '==', providerId));
          
          // Verwende collectionData anstelle von getDocs für ein reaktives Observable
          const subscription = collectionData(q, { idField: 'relationId' }).pipe(
            map(relations => {
              console.log(`${relations.length} Kundenbeziehungen gefunden`);
              return relations as ProviderCustomerRelation[];
            }),
            catchError(error => {
              console.error('Fehler beim Laden der Kundenbeziehungen:', error);
              return of([]);
            })
          ).subscribe({
            next: relations => this.ngZone.run(() => observer.next(relations)),
            error: err => this.ngZone.run(() => observer.error(err)),
            complete: () => this.ngZone.run(() => observer.complete())
          });
          
          // Aufräumen beim Abbestellen
          return () => subscription.unsubscribe();
          
        } catch (error) {
          console.error('Fehler in getCustomerRelationsByProvider:', error);
          observer.next([]);
          observer.complete();
        }
      });
    });
  }

  // Beziehung zwischen Provider und Kunde abrufen
  getRelation(providerId: string, customerId: string): Observable<ProviderCustomerRelation | undefined> {
    return new Observable<ProviderCustomerRelation | undefined>(observer => {
      this.ngZone.run(() => {
        try {
          const relationsCollection = collection(this.firestore, this.collectionName);
          const q = query(
            relationsCollection, 
            where('providerId', '==', providerId),
            where('customerId', '==', customerId)
          );
          
          const subscription = collectionData(q, { idField: 'relationId' }).pipe(
            map(relations => relations.length > 0 ? relations[0] as ProviderCustomerRelation : undefined),
            catchError(error => {
              console.error('Error fetching provider-customer relation:', error);
              return of(undefined);
            })
          ).subscribe({
            next: relation => this.ngZone.run(() => observer.next(relation)),
            error: err => this.ngZone.run(() => observer.error(err)),
            complete: () => this.ngZone.run(() => observer.complete())
          });
          
          // Aufräumen beim Abbestellen
          return () => subscription.unsubscribe();
          
        } catch (error) {
          console.error('Error in getRelation:', error);
          observer.next(undefined);
          observer.complete();
        }
      });
    });
  }
  
  // Notizen zu einem Kunden für einen Provider aktualisieren
  updateCustomerNotes(providerId: string, customerId: string, notes: string): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        // Bestehende Beziehung prüfen
        const relationObservable = this.getRelation(providerId, customerId);
        const relation = await firstValueFrom(relationObservable);
        
        if (relation) {
          // Bestehende Beziehung aktualisieren
          const docRef = doc(this.firestore, `${this.collectionName}/${relation.relationId}`);
          return updateDoc(docRef, { 
            notes, 
            updatedAt: new Date() 
          });
        } else {
          // Neue Beziehung erstellen
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
          
          const relationsCollection = collection(this.firestore, this.collectionName);
          await addDoc(relationsCollection, newRelation);
          return;
        }
      } catch (error) {
        console.error('Error updating customer notes:', error);
        throw error;
      }
    });
  }
  
  // Beziehung nach einem Termin aktualisieren
  updateRelationAfterAppointment(providerId: string, customerId: string, appointmentDate: Date, amount: number = 0): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        console.log(`Trying to update relation for provider: ${providerId}, customer: ${customerId}`);
        
        // Bestehende Beziehung prüfen
        const relationObservable = this.getRelation(providerId, customerId);
        const relation = await firstValueFrom(relationObservable);
        
        if (relation) {
          console.log('Existing relation found, updating...', relation);
          // Bestehende Beziehung aktualisieren
          const docRef = doc(this.firestore, `${this.collectionName}/${relation.relationId}`);
          return updateDoc(docRef, { 
            lastVisit: appointmentDate,
            visitCount: (relation.visitCount || 0) + 1,
            totalSpent: (relation.totalSpent || 0) + amount,
            updatedAt: new Date() 
          });
        } else {
          console.log('No existing relation, creating new one');
          
          // Einen neuen Doc-Ref mit automatisch generierter ID erstellen
          const relationsCollection = collection(this.firestore, this.collectionName);
          const newDocRef = doc(relationsCollection);
          const newRelationId = newDocRef.id;
          
          console.log('Generated new relation ID:', newRelationId);
          
          // Neue Beziehung mit der generierten ID
          const newRelation: ProviderCustomerRelation = {
            relationId: newRelationId,
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
          
          // Dokument mit setDoc und der generierten ID erstellen
          return setDoc(newDocRef, newRelation);
        }
      } catch (error) {
        console.error('Error updating relation after appointment:', error);
        throw error;
      }
    });
  }
}

// Hilfsfunktion für firstValueFrom (da rxjs 6 noch kein firstValueFrom hat)
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