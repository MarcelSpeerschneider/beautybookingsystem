import { Injectable, inject, NgZone } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User, 
         updateProfile, onAuthStateChanged, browserLocalPersistence, setPersistence } from '@angular/fire/auth';
import { BehaviorSubject, Observable, of, from, catchError, timeout, switchMap, map, take, tap } from 'rxjs';
import { CustomerService } from './customer.service';
import { Customer } from '../models/customer.model';
import { Router } from '@angular/router';
import { LoadingService } from './loading.service';

// Schnittstelle für das kombinierte User+Customer-Objekt
export interface UserWithCustomer {
  user: User | null;
  customer: Customer | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  auth: Auth = inject(Auth);
  private ngZone = inject(NgZone);
  private customerService = inject(CustomerService);
  private router = inject(Router);
  private loadingService = inject(LoadingService);
  
  // BehaviorSubject für den Firebase Auth-Zustand
  private firebaseUserSubject = new BehaviorSubject<User | null>(null);
  
  // BehaviorSubject für das kombinierte User+Customer-Objekt
  private userWithCustomerSubject = new BehaviorSubject<UserWithCustomer>({
    user: null,
    customer: null
  });
  
  // Öffentliches Observable für den einfachen Firebase-Benutzer
  user$ = this.firebaseUserSubject.asObservable();
  
  // Öffentliches Observable für das kombinierte User+Customer-Objekt
  user = this.userWithCustomerSubject.asObservable();

  constructor() {
    console.log('AuthenticationService initialized');
    
    // Firebase-Persistenz einstellen
    this.setupPersistence();
    
    // Auth-Zustand innerhalb der NgZone überwachen
    this.ngZone.run(() => {
      onAuthStateChanged(this.auth, (user) => {
        this.ngZone.run(() => {
          console.log("Auth state changed:", user ? "Logged in" : "Logged out");
          this.firebaseUserSubject.next(user);
          
          if (user) {
            // Kundendaten von Firestore abrufen
            this.loadingService.setLoading(true, 'Lade Benutzerdaten...');
            this.customerService.getCustomerByUserId(user.uid).subscribe({
              next: (customer) => {
                this.loadingService.setLoading(false);
                this.userWithCustomerSubject.next({
                  user: user,
                  customer: customer || null
                });
                
                if (!customer) {
                  console.log("No customer data found, attempting to create fallback");
                  this.createEmptyCustomerIfNeeded().subscribe();
                }
              },
              error: (error) => {
                this.loadingService.setLoading(false);
                console.error("Error loading customer data:", error);
                
                // Bei Berechtigungsfehlern versuchen, einen leeren Kundendatensatz zu erstellen
                if (error.code === 'permission-denied') {
                  console.log("Permission denied, attempting to create fallback");
                  this.createEmptyCustomerIfNeeded().subscribe();
                }
                
                // Trotz Fehler beim Laden der Kundendaten den User-Teil aktualisieren
                this.userWithCustomerSubject.next({
                  user: user,
                  customer: null
                });
              }
            });
          } else {
            // Wenn kein Benutzer vorhanden ist, setzen wir beide auf null
            this.userWithCustomerSubject.next({
              user: null,
              customer: null
            });
          }
        });
      });
    });
  }

  // Firebase-Persistenz einrichten
  private setupPersistence(): void {
    setPersistence(this.auth, browserLocalPersistence)
      .then(() => console.log('Firebase persistence set up successfully'))
      .catch(error => console.error('Error setting up Firebase persistence:', error));
  }

  async register({ email, password, firstName, lastName, phone }: any) {
    try {
      this.loadingService.setLoading(true, 'Registriere Konto...');
      console.log("Starting registration process");
      
      // Benutzer in Firebase registrieren
      const response = await createUserWithEmailAndPassword(this.auth, email, password);
      console.log("User created in Firebase Auth");
      
      // Displayname aktualisieren
      if (this.auth.currentUser) {
        await updateProfile(this.auth.currentUser, {
          displayName: `${firstName} ${lastName}`,
        });
        console.log("User profile updated with display name");
      }
      
      // Customer-Objekt erstellen, wenn der Benutzer erfolgreich registriert wurde
      if (response.user) {
        const customer: Partial<Customer> = {
          userId: response.user.uid,
          firstName,
          lastName,
          email,
          phone
        };
        
        // Customer in Firestore speichern
        try {
          await this.customerService.createCustomer(customer as Customer);
          console.log("Customer data created in Firestore");
        } catch (customerError) {
          console.error("Error creating customer data:", customerError);
        }
      }
      
      this.loadingService.setLoading(false);
      console.log("Registration complete", response);
      return response;
    } catch (error) {
      this.loadingService.setLoading(false);
      console.error("Registration error", error);
      throw error;
    }
  }

  login({ email, password }: any): Promise<any> {
    this.loadingService.setLoading(true, 'Anmeldung wird durchgeführt...');
    console.log("Attempting login for:", email);
    return signInWithEmailAndPassword(this.auth, email, password)
      .then(result => {
        console.log("Login successful");
        return result;
      })
      .catch(error => {
        console.error("Login failed:", error);
        this.loadingService.setLoading(false);
        throw error;
      });
  }

  logout(): Promise<void> {
    this.loadingService.setLoading(true, 'Abmeldung...');
    console.log("Logging out");
    
    // Nach dem Logout setzen wir das kombinierte Objekt zurück
    this.userWithCustomerSubject.next({
      user: null,
      customer: null
    });
    
    return signOut(this.auth).finally(() => {
      this.loadingService.setLoading(false);
    });
  }

  getUser(): User | null {
    return this.auth.currentUser;
  }
  
  getCurrentUserWithCustomer(): UserWithCustomer {
    return this.userWithCustomerSubject.getValue();
  }
  
  // Hilfsmethode zur Überprüfung, ob ein Benutzer angemeldet ist
  isLoggedIn(): Observable<boolean> {
    console.log("Checking if user is logged in");
    return new Observable<boolean>(observer => {
      const unsubscribe = onAuthStateChanged(
        this.auth,
        user => {
          this.ngZone.run(() => {
            const isLoggedIn = !!user;
            console.log("isLoggedIn check result:", isLoggedIn);
            observer.next(isLoggedIn);
          });
        },
        error => {
          this.ngZone.run(() => {
            console.error("Error checking login status:", error);
            observer.error(error);
          });
        }
      );
      return unsubscribe;
    });
  }
  
  // Hilfsmethode zur Erstellung eines leeren Kundendatensatzes, falls keiner vorhanden ist
  createEmptyCustomerIfNeeded(): Observable<boolean> {
    console.log('Checking if customer data needs to be created');
    
    return this.user.pipe(
      take(1),
      switchMap(userWithCustomer => {
        // Wenn der Benutzer angemeldet ist, aber keine Kundendaten hat
        if (userWithCustomer.user && !userWithCustomer.customer) {
          this.loadingService.setLoading(true, 'Erstelle Kundenprofil...');
          console.log('User exists but no customer data found, creating placeholder');
          
          const user = userWithCustomer.user;
          const displayName = user.displayName || 'New User';
          let firstName = displayName;
          let lastName = '';
          
          // Versuchen, Vor- und Nachnamen aus displayName zu extrahieren
          if (displayName.includes(' ')) {
            const nameParts = displayName.split(' ');
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
          }
          
          const newCustomer: Partial<Customer> = {
            userId: user.uid,
            firstName: firstName,
            lastName: lastName,
            email: user.email || '',
            phone: ''
          };
          
          // Customer erstellen und zurückgeben
          return from(this.customerService.createCustomer(newCustomer as Customer)).pipe(
            map(docRef => {
              this.loadingService.setLoading(false);
              console.log('Placeholder customer created with ID:', docRef.id);
              
              // Aktualisieren des BehaviorSubject mit den neuen Kundendaten
              // Da die ID erst nach dem Erstellen bekannt ist, müssen wir sie hinzufügen
              const customer = {
                ...newCustomer, 
                customerId: docRef.id
              } as Customer;
              
              this.userWithCustomerSubject.next({
                user: userWithCustomer.user,
                customer: customer
              });
              
              return true;
            }),
            catchError(error => {
              this.loadingService.setLoading(false);
              console.error('Error creating placeholder customer:', error);
              return of(false);
            })
          );
        }
        
        // Wenn bereits alles in Ordnung ist oder der Benutzer nicht angemeldet ist
        return of(!!userWithCustomer.user && !!userWithCustomer.customer);
      })
    );
  }
  
  // Methode zur Überprüfung, ob ein vollständiges UserWithCustomer-Objekt vorliegt
  isUserWithCustomerReady(): Observable<boolean> {
    console.log('isUserWithCustomerReady called');
    
    // Überprüfen, ob bereits Daten im Subject vorhanden sind
    const currentValue = this.userWithCustomerSubject.getValue();
    if (currentValue.user && currentValue.customer) {
      console.log('User and customer data already available');
      return of(true);
    }
    
    // Wenn der User eingeloggt ist, aber Customer-Daten noch nicht geladen sind
    if (this.auth.currentUser && !currentValue.customer) {
      console.log('User logged in, but customer data not yet loaded. Waiting...');
      
      // Zuerst versuchen, die Daten zu laden, dann Fallback verwenden
      return this.user.pipe(
        take(1),
        switchMap(userWithCustomer => {
          if (userWithCustomer.user && !userWithCustomer.customer) {
            // Wenn nach dem ersten Versuch keine Kundendaten da sind, versuchen wir sie zu erstellen
            return this.createEmptyCustomerIfNeeded();
          }
          return of(!!userWithCustomer.user && !!userWithCustomer.customer);
        }),
        timeout(3000),  // Längere Wartezeit, da wir möglicherweise einen neuen Kunden erstellen
        catchError(error => {
          console.log('Timeout or error checking customer data', error);
          return of(false);
        }),
        tap(result => console.log('Final auth check result with fallback:', result))
      );
    }
    
    // Standard-Fallback
    return this.user.pipe(
      take(1),
      map(userWithCustomer => {
        const result = !!userWithCustomer.user && !!userWithCustomer.customer;
        console.log('User with customer check result:', result);
        return result;
      })
    );
  }
}