import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { 
  Firestore, 
  collection, 
  doc, 
  collectionData, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  getDoc
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

  // Load customer relations for a provider
  getCustomerRelationsByProvider(providerId: string): Observable<(ProviderCustomerRelation & { id: string })[]> {
    return new Observable<(ProviderCustomerRelation & { id: string })[]>(observer => {
      this.ngZone.run(() => {
        try {
          console.log(`Fetching customer relations for provider: ${providerId}`);
          const relationsCollection = collection(this.firestore, this.collectionName);
          const q = query(relationsCollection, where('providerId', '==', providerId));
          
          const subscription = collectionData(q, { idField: 'id' }).pipe(
            map(relations => {
              console.log(`Found ${relations.length} customer relations for provider ${providerId}`);
              return relations as (ProviderCustomerRelation & { id: string })[];
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
        return;
      });
    });
  }

  // Get a specific provider-customer relation
  getRelation(providerId: string, customerId: string): Observable<(ProviderCustomerRelation & { id: string }) | undefined> {
    return new Observable<(ProviderCustomerRelation & { id: string }) | undefined>(observer => {
      this.ngZone.run(() => {
        try {
          console.log(`Looking for relation between provider ${providerId} and customer ${customerId}`);
          const relationsCollection = collection(this.firestore, this.collectionName);
          const q = query(
            relationsCollection, 
            where('providerId', '==', providerId),
            where('customerId', '==', customerId)
          );
          
          const subscription = collectionData(q, { idField: 'id' }).pipe(
            map(relations => {
              if (relations.length > 0) {
                console.log(`Relation found between provider ${providerId} and customer ${customerId}`);
                return relations[0] as (ProviderCustomerRelation & { id: string });
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
        return;
      });
    });
  }
  
  // Update customer notes
  async updateCustomerNotes(providerId: string, customerId: string, notes: string): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        console.log(`Updating notes for customer ${customerId} by provider ${providerId}`);
        
        // Check if a relation already exists
        const relationsCollection = collection(this.firestore, this.collectionName);
        const q = query(
          relationsCollection,
          where('providerId', '==', providerId),
          where('customerId', '==', customerId)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Update existing relation
          const relationDoc = querySnapshot.docs[0];
          const docRef = doc(this.firestore, this.collectionName, relationDoc.id);
          
          console.log(`Updating existing relation with ID: ${relationDoc.id}`);
          return updateDoc(docRef, { 
            notes, 
            updatedAt: new Date() 
          });
        } else {
          // Create new relation
          console.log(`Creating new relation between provider ${providerId} and customer ${customerId}`);
          const newRelation: ProviderCustomerRelation = {
            providerId,
            customerId,
            notes,
            firstVisit: new Date(),
            lastVisit: new Date(),
            visitCount: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Document ID is automatically generated by Firestore
          await addDoc(relationsCollection, newRelation);
          return;
        }
      } catch (error) {
        console.error('Error updating customer notes:', error);
        throw error;
      }
    });
  }
  
  // Update relation after appointment
  async updateRelationAfterAppointment(
    providerId: string, 
    customerId: string, 
    appointmentDate: Date, 
    amount: number = 0,
    customerData?: { firstName?: string; lastName?: string; email?: string; phone?: string }
  ): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        console.log(`Updating relation for provider: ${providerId}, customer: ${customerId}`);
        
        // ÄNDERUNG: Nur nach providerId filtern (entspricht den Sicherheitsregeln)
        const relationsCollection = collection(this.firestore, this.collectionName);
        const q = query(
          relationsCollection,
          where('providerId', '==', providerId)
        );
        
        const querySnapshot = await getDocs(q);
        
        // ÄNDERUNG: Clientseitig nach customerId filtern MIT BRACKET-NOTATION
        const relationDoc = querySnapshot.docs.find(doc => 
          doc.data()['customerId'] === customerId
        );
        
        if (relationDoc) {
          // Update existing relation
          const docRef = doc(this.firestore, this.collectionName, relationDoc.id);
          const existingData = relationDoc.data() as ProviderCustomerRelation;
          
          console.log(`Updating existing relation with ID: ${relationDoc.id}`);
          
          const updateData: any = { 
            lastVisit: appointmentDate,
            visitCount: (existingData.visitCount || 0) + 1,
            totalSpent: (existingData.totalSpent || 0) + amount,
            updatedAt: new Date()
          };
          
          // Include additional customer data if provided
          if (customerData) {
            if (customerData.firstName) updateData.customerFirstName = customerData.firstName;
            if (customerData.lastName) updateData.customerLastName = customerData.lastName;
            if (customerData.email) updateData.customerEmail = customerData.email;
            if (customerData.phone) updateData.customerPhone = customerData.phone;
          }
          
          return updateDoc(docRef, updateData);
        } else {
          // Create new relation
          console.log(`Creating new relation between provider ${providerId} and customer ${customerId}`);
          const newRelation: ProviderCustomerRelation = {
            providerId,
            customerId,
            firstVisit: appointmentDate,
            lastVisit: appointmentDate,
            visitCount: 1,
            totalSpent: amount,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Include additional customer data if provided
          if (customerData) {
            (newRelation as any).customerFirstName = customerData.firstName;
            (newRelation as any).customerLastName = customerData.lastName;
            if (customerData.email) (newRelation as any).customerEmail = customerData.email;
            if (customerData.phone) (newRelation as any).customerPhone = customerData.phone;
          }
          
          console.log('Creating relation with data:', newRelation);
          
          // Create document with addDoc
          await addDoc(relationsCollection, newRelation);
          return;
        }
      } catch (error) {
        console.error('Error updating relation after appointment:', error);
        throw error;
      }
    });
  }
  
  // Delete a relation
  async deleteRelation(relationId: string): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        const docRef = doc(this.firestore, this.collectionName, relationId);
        return deleteDoc(docRef);
      } catch (error) {
        console.error('Error deleting relation:', error);
        throw error;
      }
    });
  }
}