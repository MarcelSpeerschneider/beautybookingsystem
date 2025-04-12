import { Injectable, inject } from '@angular/core';
import { Customer } from '../models/customer.model';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Firestore, collection, doc, collectionData, docData, addDoc, updateDoc, deleteDoc, query, where, DocumentReference } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private customersCollection = 'customers';
  firestore: Firestore = inject(Firestore);
  constructor(){}

  getCustomers(): Observable<Customer[]> {
    const customerCollection = collection(this.firestore, this.customersCollection);
    return collectionData(customerCollection, { idField: 'customerId' }) as Observable<Customer[]>;
  }

  getCustomer(customerId: string): Observable<Customer | undefined> {
    const customerDocument = doc(this.firestore, `${this.customersCollection}/${customerId}`);
    return docData(customerDocument, { idField: 'customerId' }) as Observable<Customer>;
  }

  getCustomerByUserId(userId: string): Observable<Customer | undefined> {
    const customerCollection = collection(this.firestore, this.customersCollection);
    return collectionData(customerCollection, { idField: 'customerId' }).pipe(
      map(customers => customers.find(customer => customer['userId'] === userId) as Customer) // Add type assertion
    ) as Observable<Customer | undefined>;
  }
  getCustomersBySubscriptionStatus(subscriptionStatus: string): Observable<Customer[]> {
    const customerCollection = collection(this.firestore, this.customersCollection);
    const q = query(customerCollection, where('subscriptionStatus', '==', subscriptionStatus));
    return collectionData(q, { idField: 'customerId' }) as Observable<Customer[]>;
  }

  getCustomerByRole(role: string): Observable<Customer[]> {
    const customerCollection = collection(this.firestore, this.customersCollection);
    const q = query(customerCollection, where('role', '==', role));
    return collectionData(q, { idField: 'customerId' }) as Observable<Customer[]>;
  }


  createCustomer(customer: Customer): Promise<DocumentReference> {
    const customerCollection = collection(this.firestore, this.customersCollection);
    return addDoc(customerCollection, customer);
  }

  updateCustomer(customer: Customer): Promise<any> {
    const customerDocument = doc(this.firestore, `${this.customersCollection}/${customer.customerId}`);
    return updateDoc(customerDocument, {
      userId: customer.userId,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone
    } as Partial<Customer>);
  }

  deleteCustomer(customerId: string): Promise<void> {
    const customerDocument = doc(this.firestore, `${this.customersCollection}/${customerId}`);
    return deleteDoc(customerDocument);
  }
}
