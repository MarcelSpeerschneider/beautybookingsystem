import { Injectable, inject, NgZone } from '@angular/core';
import { Auth, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User,
         updateProfile, onAuthStateChanged, } from 'firebase/auth';
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
  auth = inject(Auth);
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
        }
      })
    })
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

  async registerProvider({ email, password, firstName, lastName, phone }: any) {
    try {
      this.loadingService.setLoading(true, 'Registriere Provider-Konto...');
      console.log("Starting provider registration process");
      
      // Benutzer in Firebase registrieren
      const response = await createUserWithEmailAndPassword(this.auth, email, password).catch((error) => {
        console.error('Firebase Authentication Error:', error);
        throw error;});
      
      // Displayname aktualisieren
      if (this.auth.currentUser) {
        await updateProfile(this.auth.currentUser, {
          displayName: `${firstName} ${lastName}`,
        });
      }

      // Hier wird KEIN Customer-Objekt erstellt
      // stattdessen wird nur die Firebase Auth-Registrierung zurückgegeben

      this.loadingService.setLoading(false);
      return response;
    } catch (error) {
        this.loadingService.setLoading(false);
        console.error("Provider registration error", error);
          }
        });
      }
    })
  }

  async registerProvider({ email, password, firstName, lastName, phone }: any) {
    try {
      this.loadingService.setLoading(true, 'Registriere Provider-Konto...');
      console.log("Starting provider registration process");
      
      // Benutzer in Firebase registrieren
      const response = await createUserWithEmailAndPassword(this.auth, email, password).catch((error) => {
        console.error('Firebase Authentication Error:', error);
        throw error;});
      
      // Displayname aktualisieren
      if (this.auth.currentUser) {
        await updateProfile(this.auth.currentUser, {
          displayName: `${firstName} ${lastName}`,
        });
      }
      
      // Hier wird KEIN Customer-Objekt erstellt
      // stattdessen wird nur die Firebase Auth-Registrierung zurückgegeben
      
      this.loadingService.setLoading(false);
      return response;
    } catch (error) {
      this.loadingService.setLoading(false);
      console.error("Provider registration error", error);
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