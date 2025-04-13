import { Injectable, inject, NgZone } from '@angular/core';
import { Customer } from '../models/customer.model';
import { Observable, from, of, catchError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Firestore, collection, doc, collectionData, docData, addDoc, updateDoc, deleteDoc, query, where, DocumentReference, DocumentData } from '@angular/fire/firestore';

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
          const customerDocument = doc(this.firestore, `${this.customersCollection}/${customerId}`);
          docData(customerDocument, { idField: 'customerId' }).pipe(
            map(data => data as Customer),
            catchError(error => {
              console.error(`Error fetching customer with ID ${customerId}:`, error);
              return of(undefined);
            })
          ).subscribe({
            next: customer => observer.next(customer),
            error: err => observer.error(err),
            complete: () => observer.complete()
          });
        } catch (error) {
          console.error('Error in getCustomer:', error);
          observer.next(undefined);
          observer.complete();
        }
      });
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
        const customerCollection = collection(this.firestore, this.customersCollection);
        const docRef = await addDoc(customerCollection, customer);
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