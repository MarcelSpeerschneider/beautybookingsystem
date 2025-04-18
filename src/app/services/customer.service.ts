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
import { ZoneUtils } from '../utils/zone-utils';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private collectionName = 'customers';
  firestore: Firestore = inject(Firestore);
  private ngZone = inject(NgZone);

  // Helper methods to ensure Firebase operations run in NgZone
  private getDocInZone(docRef: any): Promise<any> {
    return this.ngZone.run(() => getDoc(docRef));
  }
  
  private getDocsInZone(queryRef: any): Promise<any> {
    return this.ngZone.run(() => getDocs(queryRef));
  }

  getCustomers(): Observable<(Customer & { id: string })[]> {
    return ZoneUtils.wrapObservable(() => {
      try {
        const customerCollection = this.ngZone.run(() => collection(this.firestore, this.collectionName));
        return this.ngZone.run(() => collectionData(customerCollection, { idField: 'id' })).pipe(
          map(data => data as (Customer & { id: string })[]),
          catchError(error => {
            console.error('Error fetching customers:', error);
            return of([]);
          })
        );
      } catch (error) {
        console.error('Error in getCustomers:', error);
        return of([]);
      }
    }, this.ngZone);
  }

  getCustomer(customerId: string): Observable<(Customer & { id: string }) | undefined> {
    return ZoneUtils.wrapObservable(() => {
      try {
        console.log('Loading customer data for ID:', customerId);

        const customerDocument = this.ngZone.run(() => doc(this.firestore, this.collectionName, customerId));

        // Use our wrapped method to get the document
        return from(this.getDocInZone(customerDocument)).pipe(
          map(docSnap => {
            if (docSnap.exists()) {
              console.log("Customer found:", docSnap.data());
              return { id: docSnap.id, ...docSnap.data() } as (Customer & { id: string });
            } else {
              console.log("No customer with ID", customerId, "found");
              return undefined;
            }
          }),
          catchError(error => {
            console.error("Error loading customer with ID", customerId, ":", error);
            return of(undefined);
          })
        );
      } catch (error) {
        console.error('Error in getCustomer:', error);
        return of(undefined);
      }
    }, this.ngZone);
  }

  getCustomerByEmail(email: string): Observable<(Customer & { id: string }) | undefined> {
    return ZoneUtils.wrapObservable(() => {
      try {
        console.log('Looking up customer by email:', email);
        const customerCollection = this.ngZone.run(() => collection(this.firestore, this.collectionName));
        const q = this.ngZone.run(() => query(customerCollection, where('email', '==', email)));

        return from(this.getDocsInZone(q)).pipe(
          map(querySnapshot => {
            if (!querySnapshot.empty) {
              const docSnap = querySnapshot.docs[0];
              console.log('Found customer by email:', docSnap.data());
              return { id: docSnap.id, ...docSnap.data() } as (Customer & { id: string });
            } else {
              console.log('No customer found with email', email);
              return undefined;
            }
          }),
          catchError(error => {
            console.error('Error fetching customer by email:', error);
            return of(undefined);
          })
        );
      } catch (error) {
        console.error('Error in getCustomerByEmail:', error);
        return of(undefined);
      }
    }, this.ngZone);
  }

  createCustomer(customer: Customer, userId?: string): Promise<string> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        console.log('Creating new customer' + (userId ? ` with Auth ID ${userId}` : ' with auto-generated ID'));

        // Prepare customer data with timestamps and ensure role is set
        const customerToSave = {
          ...customer,
          role: 'customer', // Immer sicherstellen, dass die Rolle gesetzt ist
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // PREFERRED METHOD: When userId (Auth ID) is provided
        if (userId) {
          // Check if customer with this ID already exists
          const customerDoc = this.ngZone.run(() => doc(this.firestore, this.collectionName, userId));
          const customerSnapshot = await this.getDocInZone(customerDoc);

          if (customerSnapshot.exists()) {
            console.log(`Customer with ID ${userId} already exists`);
            return userId;
          }

          // Use explicit document ID (user's Auth UID)
          await this.ngZone.run(() => setDoc(customerDoc, customerToSave));
          console.log(`Customer created with Auth ID: ${userId}`);
          return userId;
        }
        // FALLBACK: Email check and auto-generated ID
        else {
          // Check if a customer with this email already exists
          if (customer.email) {
            const customersCollection = this.ngZone.run(() => collection(this.firestore, this.collectionName));
            const existingCustomerQuery = this.ngZone.run(() => 
              query(customersCollection, where('email', '==', customer.email))
            );

            const querySnapshot = await this.getDocsInZone(existingCustomerQuery);
            if (!querySnapshot.empty) {
              console.warn(`Customer with email ${customer.email} already exists`);
              return querySnapshot.docs[0].id;
            }
          }

          // Create document with auto-generated ID (FALLBACK, NOT RECOMMENDED)
          console.warn('Creating customer with auto-generated ID is not recommended');
          const customersCollection = this.ngZone.run(() => collection(this.firestore, this.collectionName));
          const docRef = await this.ngZone.run(() => addDoc(customersCollection, customerToSave));
          console.log('Customer created with auto-generated ID:', docRef.id);
          return docRef.id;
        }
      } catch (error) {
        console.error('Error creating customer:', error);
        throw error;
      }
    }, this.ngZone);
  }

  updateCustomer(customer: Customer & { id: string }): Promise<void> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        console.log('Updating customer:', customer);
        const { id, ...customerData } = customer;
        const customerDocument = this.ngZone.run(() => doc(this.firestore, this.collectionName, id));

        // Update the updatedAt field and ensure role is preserved
        const updatedCustomer = {
          ...customerData,
          role: 'customer', // Sicherstellen, dass die Rolle nicht überschrieben wird
          updatedAt: new Date()
        };

        return this.ngZone.run(() => updateDoc(customerDocument, updatedCustomer));
      } catch (error) {
        console.error('Error updating customer:', error);
        throw error;
      }
    }, this.ngZone);
  }

  deleteCustomer(customerId: string): Promise<void> {
    return ZoneUtils.wrapPromise(async () => {
      try {
        console.log('Deleting customer:', customerId);
        const customerDocument = this.ngZone.run(() => doc(this.firestore, this.collectionName, customerId));
        return this.ngZone.run(() => deleteDoc(customerDocument));
      } catch (error) {
        console.error('Error deleting customer:', error);
        throw error;
      }
    }, this.ngZone);
  }
}