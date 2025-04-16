import { Injectable, inject, NgZone } from '@angular/core';
import { Customer } from '../models/customer.model';
import { Observable, from, of, catchError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
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
  DocumentReference, 
  getDocs 
} from '@angular/fire/firestore';

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
          collectionData(customerCollection, { idField: 'id' }).pipe(
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
          console.log('Lade Kundendaten für ID:', customerId);
          
          const customerDocument = doc(this.firestore, this.customersCollection, customerId);
          
          getDoc(customerDocument)
            .then(docSnap => {
              if (docSnap.exists()) {
                console.log("Kunde gefunden:", docSnap.data());
                const customer = { id: docSnap.id, ...docSnap.data() } as Customer;
                observer.next(customer);
              } else {
                console.log("Kein Kunde mit ID", customerId, "gefunden");
                observer.next(undefined);
              }
              observer.complete();
            })
            .catch((error: any) => {
              console.error("Fehler beim Laden des Kunden mit ID", customerId, ":", error);
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

  // Neue Methode, die besser für die Suche nach Email/anderen Kriterien geeignet ist
  getCustomerByEmail(email: string): Observable<Customer | undefined> {
    return new Observable<Customer | undefined>(observer => {
      this.ngZone.run(() => {
        try {
          const customerCollection = collection(this.firestore, this.customersCollection);
          const q = query(customerCollection, where('email', '==', email));
          
          getDocs(q)
            .then(querySnapshot => {
              if (!querySnapshot.empty) {
                const docSnap = querySnapshot.docs[0];
                const customer = { id: docSnap.id, ...docSnap.data() } as Customer;
                observer.next(customer);
              } else {
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
   * Erstellt einen neuen Kunden mit der angegebenen userId als document ID
   * @param customer Kundendaten ohne ID
   * @param userId Die Auth UID, die als document ID verwendet werden soll
   * @returns Die ID des erstellten Kunden (identisch mit userId)
   */
   async createCustomer(customer: Omit<Customer, 'id'>, userId: string): Promise<string> {
    return this.ngZone.run(async () => {
      try {
        console.log('Creating new customer with specific ID:', userId);
        
        // Prüfe, ob ein Kunde mit dieser E-Mail bereits existiert
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
        
        // Prüfe, ob der Customer mit dieser ID bereits existiert
        const existingCustomerDoc = doc(this.firestore, this.collectionName, userId);
        const existingCustomerSnapshot = await getDoc(existingCustomerDoc);
        
        if (existingCustomerSnapshot.exists()) {
          console.warn(`Customer with ID ${userId} already exists`);
          return userId;
        }
        
        // Bereite die Kundendaten vor
        const customerToSave = {
          ...customer,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Document mit spezifischer ID erstellen (userId = document ID)
        await setDoc(existingCustomerDoc, customerToSave);
        console.log('Customer created successfully with ID:', userId);
        
        return userId;
      } catch (error) {
        console.error('Error creating customer:', error);
        throw error;
      }
    });
  }

  updateCustomer(customer: Customer): Promise<void> {
    return this.ngZone.run(async () => {
      try {
        const { id, ...customerData } = customer;
        const customerDocument = doc(this.firestore, this.customersCollection, id);
        
        // Aktualisiere das updatedAt-Feld
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
        const customerDocument = doc(this.firestore, this.customersCollection, customerId);
        return deleteDoc(customerDocument);
      } catch (error) {
        console.error('Error deleting customer:', error);
        throw error;
      }
    });
  }
}