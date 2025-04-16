// src/app/services/customer.service.ts

import { Injectable, inject, NgZone } from '@angular/core';
import { Customer } from '../models/customer.model';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  collectionData,
  docData,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs
} from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private collectionName = 'customers';
  firestore: Firestore = inject(Firestore);
  private ngZone = inject(NgZone);

  constructor() { }

  getCustomers(): Observable<(Customer & { id: string })[]> {
    return new Observable<(Customer & { id: string })[]>(observer => {
      this.ngZone.run(() => {
        try {
          const customerCollection = collection(this.firestore, this.collectionName);
          collectionData(customerCollection, { idField: 'id' }).pipe(
            map(data => data as (Customer & { id: string })[]),
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

  getCustomer(customerId: string): Observable<(Customer & { id: string }) | undefined> {
    return new Observable<(Customer & { id: string }) | undefined>(observer => {
      this.ngZone.run(() => {
        try {
          console.log('Loading customer data for ID:', customerId);

          const customerDocument = doc(this.firestore, this.collectionName, customerId);

          // Use a more robust method to get the document
          getDoc(customerDocument)
            .then(docSnap => {
              if (docSnap.exists()) {
                console.log("Customer found:", docSnap.data());
                const customer = { id: docSnap.id, ...docSnap.data() } as (Customer & { id: string });
                observer.next(customer);
              } else {
                console.log("No customer with ID", customerId, "found");
                observer.next(undefined);
              }
              observer.complete();
            })
            .catch((error: any) => {
              console.error("Error loading customer with ID", customerId, ":", error);
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

  getCustomerByEmail(email: string): Observable<(Customer & { id: string }) | undefined> {
    return new Observable<(Customer & { id: string }) | undefined>(observer => {
      this.ngZone.run(() => {
        try {
          console.log('Looking up customer by email:', email);
          const customerCollection = collection(this.firestore, this.collectionName);
          const q = query(customerCollection, where('email', '==', email));

          getDocs(q)
            .then(querySnapshot => {
              if (!querySnapshot.empty) {
                const docSnap = querySnapshot.docs[0];
                console.log('Found customer by email:', docSnap.data());
                const customer = { id: docSnap.id, ...docSnap.data() } as (Customer & { id: string });
                observer.next(customer);
              } else {
                console.log('No customer found with email', email);
                observer.next(undefined);
              }
              observer.complete();
            })
            .catch(error => {
              console.error('Error fetching customer by email:', error);
              observer.next(undefined);
              observer.complete();
            });
        } catch (error) {
          console.error('Error in getCustomerByEmail:', error);
          observer.next(undefined);
          observer.complete();
        }
      });
    });
  }

  /**
   * Creates a new customer
   * @param customer Customer data without ID
   * @param userId Optional user ID to use as document ID
   * @returns The ID of the created customer
   */
  async createCustomer(customer: Customer, userId?: string): Promise<string> {
    return this.ngZone.run(async () => {
      try {
        console.log('Creating new customer' + (userId ? ` with Auth ID ${userId}` : ' with auto-generated ID'));

        // Prepare customer data with timestamps
        const customerToSave = {
          ...customer,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // PREFERRED METHOD: When userId (Auth ID) is provided
        if (userId) {
          // Check if customer with this ID already exists
          const customerDoc = doc(this.firestore, this.collectionName, userId);
          const customerSnapshot = await getDoc(customerDoc);

          if (customerSnapshot.exists()) {
            console.log(`Customer with ID ${userId} already exists`);
            return userId;
          }

          // Use explicit document ID (user's Auth UID)
          await setDoc(customerDoc, customerToSave);
          console.log(`Customer created with Auth ID: ${userId}`);
          return userId;
        }
        // FALLBACK: Email check and auto-generated ID
        else {
          // Check if a customer with this email already exists
          if (customer.email) {
            const existingCustomerQuery = query(
              collection(this.firestore, this.collectionName),
              where('email', '==', customer.email)
            );

            const querySnapshot = await getDocs(existingCustomerQuery);
            if (!querySnapshot.empty) {
              console.warn(`Customer with email ${customer.email} already exists`);
              return querySnapshot.docs[0].id;
            }
          }

          // Create document with auto-generated ID (FALLBACK, NOT RECOMMENDED)
          console.warn('Creating customer with auto-generated ID is not recommended');
          const customersCollection = collection(this.firestore, this.collectionName);
          const docRef = await addDoc(customersCollection, customerToSave);
          console.log('Customer created with auto-generated ID:', docRef.id);
          return docRef.id;
        }
      } catch (error) {
        console.error('Error creating customer:', error);
        throw error;
      }
    });
  }

  updateCustomer(customer: Customer & { id: string }): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        console.log('Updating customer:', customer);
        const { id, ...customerData } = customer;
        const customerDocument = doc(this.firestore, this.collectionName, id);

        // Update the updatedAt field
        const updatedCustomer = {
          ...customerData,
          updatedAt: new Date()
        };

        return updateDoc(customerDocument, updatedCustomer);
      } catch (error) {
        console.error('Error updating customer:', error);
        throw error;
      }
    });
  }

  deleteCustomer(customerId: string): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        console.log('Deleting customer:', customerId);
        const customerDocument = doc(this.firestore, this.collectionName, customerId);
        return deleteDoc(customerDocument);
      } catch (error) {
        console.error('Error deleting customer:', error);
        throw error;
      }
    });
  }
}