import { Injectable, inject, NgZone } from '@angular/core';
import { Customer } from '../models/customer.model';
import { Observable, from, of, catchError } from 'rxjs';
import { map, switchMap, timeout } from 'rxjs/operators';
import { Firestore, collection, doc, getDoc, collectionData, docData, addDoc, updateDoc, deleteDoc, query, where, DocumentReference, DocumentData, getDocs } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private customersCollection = 'customers';
  firestore: Firestore = inject(Firestore);
  private ngZone = inject(NgZone);
  
  constructor(){}

  getCustomers(): Observable<Customer[]> {
    return new Observable<Customer[]>(observer => {
      this.ngZone.run(() => {
        try {
          const customerCollection = collection(this.firestore, this.customersCollection);
          collectionData(customerCollection, { idField: 'customerId' }).pipe(
            map(data => data as Customer[]),
            catchError(error => {
              console.error('Error fetching customers:', error);
              return of([]);
            })
          ).subscribe({
            next: customers => observer.next(customers),
            error: err => observer.error(err),
            complete: () => observer.complete()
          });
        } catch (error) {
          console.error('Error in getCustomers:', error);
          observer.next([]);
          observer.complete();
        }
      });
    });
  }

  getCustomer(customerId: string): Observable<Customer | undefined> {
  return new Observable<Customer | undefined>(observer => {
    this.ngZone.run(() => {
      try {
        console.log('Lade Kundendaten für customerId:', customerId);
        
        const customerDocument = doc(this.firestore, this.customersCollection, customerId);
        
        getDoc(customerDocument)
          .then(docSnap => {
            if (docSnap.exists()) {
              console.log("Kunde gefunden:", docSnap.data());
              const customer = { customerId: docSnap.id, ...docSnap.data() } as Customer;
              observer.next(customer);
            } else {
              console.log("Kein Kunde mit customerId", customerId, "gefunden");
              observer.next(undefined);
            }
            observer.complete();
          })
          .catch((error: any) => { // Now explicitly typed as any or FirebaseError
            console.error("Fehler beim Laden des Kunden mit customerId", customerId, ":", error);
            observer.next(undefined);
            observer.complete();
          });

      } catch (error) {
        console.error('Error in getCustomer:', error);
        observer.next(undefined);
        observer.complete();
      }
    });
  });
}

  getCustomersBySubscriptionStatus(subscriptionStatus: string): Observable<Customer[]> {
    return new Observable<Customer[]>(observer => {
      this.ngZone.run(() => {
        try {
          const customerCollection = collection(this.firestore, this.customersCollection);
          const q = query(customerCollection, where('subscriptionStatus', '==', subscriptionStatus));
          collectionData(q, { idField: 'customerId' }).pipe(
            map(data => data as Customer[]),
            catchError(error => {
              console.error(`Error fetching customers with subscription status ${subscriptionStatus}:`, error);
              return of([]);
            })
          ).subscribe({
            next: customers => observer.next(customers),
            error: err => observer.error(err),
            complete: () => observer.complete()
          });
        } catch (error) {
          console.error('Error in getCustomersBySubscriptionStatus:', error);
          observer.next([]);
          observer.complete();
        }
      });
    });
  }

  getCustomerByRole(role: string): Observable<Customer[]> {
    return new Observable<Customer[]>(observer => {
      this.ngZone.run(() => {
        try {
          const customerCollection = collection(this.firestore, this.customersCollection);
          const q = query(customerCollection, where('role', '==', role));
          collectionData(q, { idField: 'customerId' }).pipe(
            map(data => data as Customer[]),
            catchError(error => {
              console.error(`Error fetching customers with role ${role}:`, error);
              return of([]);
            })
          ).subscribe({
            next: customers => observer.next(customers),
            error: err => observer.error(err),
            complete: () => observer.complete()
          });
        } catch (error) {
          console.error('Error in getCustomerByRole:', error);
          observer.next([]);
          observer.complete();
        }
      });
    });
  }

  async createCustomer(customer: Customer): Promise<DocumentReference> {
    return this.ngZone.run(async () => {
      try {
        console.log('Creating new customer:', customer);
        
        // First check if a customer with this userId already exists
        const existingCustomerQuery = query(
          collection(this.firestore, this.customersCollection), 
          where('userId', '==', customer.userId)
        );
        
        const querySnapshot = await getDocs(existingCustomerQuery);
        if (!querySnapshot.empty) {
          console.warn(`Customer for userId ${customer.userId} already exists, returning existing reference`);
          const existingDoc = querySnapshot.docs[0];
          return doc(this.firestore, `${this.customersCollection}/${existingDoc.id}`) as DocumentReference;
        }
        
        const customerCollection = collection(this.firestore, this.customersCollection);
        
        // Make sure all fields are properly defined and not null/undefined
        const customerToSave = {
          userId: customer.userId,
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          email: customer.email || '',
          phone: customer.phone || ''
        };
        
        // Log each field individually to verify values
        console.log('Customer fields being saved:', {
          userId: customerToSave.userId,
          firstName: customerToSave.firstName,
          lastName: customerToSave.lastName,
          email: customerToSave.email,
          phone: customerToSave.phone
        });
        
        const docRef = await addDoc(customerCollection, customerToSave);
        console.log('Customer created successfully with ID:', docRef.id);
        return docRef;
      } catch (error) {
        console.error('Error creating customer:', error);
        throw error;
      }
    });
  }

  updateCustomer(customer: Customer): Promise<any> {
    return this.ngZone.run(async () => {
      try {
        const customerDocument = doc(this.firestore, `${this.customersCollection}/${customer.customerId}`);
        return updateDoc(customerDocument, {
          userId: customer.userId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone
        } as Partial<Customer>);
      } catch (error) {
        console.error('Error updating customer:', error);
        throw error;
      }
    });
  }

  deleteCustomer(customerId: string): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        const customerDocument = doc(this.firestore, `${this.customersCollection}/${customerId}`);
        return deleteDoc(customerDocument);
      } catch (error) {
        console.error('Error deleting customer:', error);
        throw error;
      }
    });
  }
}