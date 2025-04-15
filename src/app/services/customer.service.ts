import { Injectable, inject, NgZone } from '@angular/core';
import { Customer } from '../models/customer.model';
import { Observable, from, of, catchError } from 'rxjs';
import { map, switchMap, timeout } from 'rxjs/operators';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  collectionData, 
  docData, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  DocumentReference, 
  DocumentData, 
  getDocs 
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private customersCollection = 'customers';
  firestore: Firestore = inject(Firestore);
  private ngZone = inject(NgZone);
  private auth: Auth = inject(Auth);
  
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

  // Updated method with better error handling and direct document access
  getCustomer(customerId: string): Observable<Customer | undefined> {
    return this.ngZone.run(() => {
      console.log('Lade Kundendaten für ID:', customerId);
      
      // Get the authenticated user ID for permission logging
      const currentUserId = this.auth.currentUser?.uid;
      if (!currentUserId) {
        console.error('No authenticated user found');
        return of(undefined);
      }
      
      // Direct document access instead of using a query
      const customerDoc = doc(this.firestore, `${this.customersCollection}/${customerId}`);
      
      return from(getDoc(customerDoc)).pipe(
        map(docSnapshot => {
          if (!docSnapshot.exists()) {
            console.log(`Kunde mit ID ${customerId} nicht gefunden`);
            return undefined;
          }
          
          const customerData = docSnapshot.data() as any;
          console.log(`Kunde gefunden: ${customerId}`);
          
          // Check permissions for diagnostic purposes
          const isOwner = customerData.userId === currentUserId;
          const isProviderRef = customerData.providerRef === currentUserId || 
                               customerData.createdBy === currentUserId;
          
          if (!isOwner && !isProviderRef) {
            console.log(`Berechtigungsproblem: Benutzer ${currentUserId} hat keinen Zugriff auf Kunde ${customerId}`);
            console.log(`Customer userId: ${customerData.userId}, providerRef: ${customerData.providerRef || 'nicht gesetzt'}, createdBy: ${customerData.createdBy || 'nicht gesetzt'}`);
          }
          
          return { ...customerData, customerId: docSnapshot.id } as Customer;
        }),
        catchError(error => {
          console.error(`Fehler beim Laden des Kunden ${customerId}:`, error);
          return of(undefined);
        })
      );
    });
  }

  getCustomerByUserId(userId: string): Observable<Customer | undefined> {
    return new Observable<Customer | undefined>(observer => {
      this.ngZone.run(() => {
        try {
          console.log('Fetching customer for userId:', userId);
          const customerCollection = collection(this.firestore, this.customersCollection);
          const q = query(customerCollection, where('userId', '==', userId));
          
          collectionData(q, { idField: 'customerId' }).pipe(
            map(data => {
              const customers = data as Customer[];
              // If multiple customers found, log a warning
              if (customers.length > 1) {
                console.warn(`Multiple customers found for userId ${userId}, using the first one.`);
              }
              const customer = customers.length > 0 ? customers[0] : undefined;
              console.log('Customer query result:', customer ? 'Found' : 'Not found');
              return customer;
            }),
            catchError(error => {
              console.error(`Error fetching customer for user ID ${userId}:`, error);
              if (error.code === 'permission-denied') {
                console.warn('Permission denied. Check Firestore rules.');
              }
              return of(undefined);
            })
          ).subscribe({
            next: customer => observer.next(customer),
            error: err => observer.error(err),
            complete: () => observer.complete()
          });
        } catch (error) {
          console.error('Error in getCustomerByUserId:', error);
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
        
        // Ensure required fields are present
        const customerToSave = {
          userId: customer.userId,
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          email: customer.email || '',
          phone: customer.phone || '',
          createdBy: this.auth.currentUser?.uid, // Add createdBy field for permission tracking
          createdAt: new Date()
        };
        
        // If the customer is being created by a provider, include providerRef field
        if (customer.providerRef || (this.auth.currentUser && customer.userId !== this.auth.currentUser.uid)) {
          customerToSave['providerRef'] = customer.providerRef || this.auth.currentUser?.uid;
        }
        
        // Log each field individually to verify values
        console.log('Customer fields being saved:', {
          userId: customerToSave.userId,
          firstName: customerToSave.firstName,
          lastName: customerToSave.lastName,
          email: customerToSave.email,
          phone: customerToSave.phone,
          createdBy: customerToSave['createdBy'],
          providerRef: customerToSave['providerRef'] || 'not set'
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
        
        // Don't overwrite certain fields that might be needed for permissions
        const update = {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          updatedAt: new Date(),
          updatedBy: this.auth.currentUser?.uid
        };
        
        return updateDoc(customerDocument, update);
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