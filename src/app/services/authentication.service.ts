import { Injectable, inject, NgZone } from '@angular/core';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User,
         updateProfile, onAuthStateChanged } from 'firebase/auth';
import { BehaviorSubject, Observable, of, from, catchError, switchMap, map, take } from 'rxjs';
import { CustomerService } from './customer.service';
import { ProviderService } from './provider.service';
import { Customer } from '../models/customer.model';
import { Provider } from '../models/provider.model';
import { Router } from '@angular/router';
import { LoadingService } from './loading.service';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';


export interface UserWithCustomer {
    user: User | null;
    customer: Customer | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  auth = inject(Auth);
  firestore = inject(Firestore);
  private ngZone = inject(NgZone);
  private customerService = inject(CustomerService);
  private providerService = inject(ProviderService);
  private router = inject(Router);
  private loadingService = inject(LoadingService);

  // Track if we're in the registration process to prevent duplicate customer creation
  private registrationInProgress = false;
  
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
            // Check for provider registration in progress
            const isRegisteringProvider = sessionStorage.getItem('registering_provider') === 'true' || 
                                          localStorage.getItem('registering_provider') === 'true';
                                         
            // If registration is in progress, don't try to load/create customer
            if (this.registrationInProgress || isRegisteringProvider) {
              console.log("Registration in progress, skipping customer auto-creation");
              
              // Clear temporary marker once used
              localStorage.removeItem('registering_provider');
              sessionStorage.removeItem('registering_provider');
              return;
            }
            
            // Check if user is a provider - enhanced check with multiple methods
            const userRole = localStorage.getItem(`user_role_${user.uid}`);
            
            if (userRole === 'provider') {
              console.log("User is a provider, loading provider data");
              // Load provider data instead of customer
              this.loadingService.setLoading(true, 'Lade Anbieter-Daten...');
              this.providerService.getProviderByUserId(user.uid).subscribe({
                next: (provider) => {
                  console.log("Provider data loaded:", provider ? "Found" : "Not found");
                  this.userWithCustomerSubject.next({
                    user: user,
                    customer: null // No customer for providers
                  });
                  this.loadingService.setLoading(false);
                },
                error: (error) => {
                  console.error("Error loading provider data:", error);
                  this.loadingService.setLoading(false);
                }
              });
            } else {
              // Before proceeding with customer flow, check if a provider exists
              this.providerService.getProviderByUserId(user.uid).subscribe({
                next: (provider) => {
                  if (provider) {
                    console.log("Provider found for user, skipping customer creation");
                    localStorage.setItem(`user_role_${user.uid}`, 'provider');
                    
                    this.userWithCustomerSubject.next({
                      user: user,
                      customer: null // No customer for providers
                    });
                    this.loadingService.setLoading(false);
                  } else {
                    // No provider found, proceed with regular customer flow
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
                          
                          // Add a slight delay to prevent race conditions with recent registrations
                          setTimeout(() => {
                            // Check once more if customer exists before creating
                            this.customerService.getCustomerByUserId(user.uid).subscribe(
                              latestCustomer => {
                                if (!latestCustomer && !this.registrationInProgress) {
                                  this.createEmptyCustomerIfNeeded().subscribe();
                                }
                              }
                            );
                          }, 1000);
                        }
                      },
                      error: (error) => {
                        this.loadingService.setLoading(false);
                        console.error("Error loading customer data:", error);
                        
                        // Bei Berechtigungsfehlern versuchen, einen leeren Kundendatensatz zu erstellen
                        if (error.code === 'permission-denied' && !this.registrationInProgress) {
                          console.log("Permission denied, attempting to create fallback");
                          this.createEmptyCustomerIfNeeded().subscribe();
                        }
                      }
                    });
                  }
                },
                error: (error) => {
                  console.error("Error checking for provider:", error);
                  // Continue with regular customer flow
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
                        
                        // Add a slight delay to prevent race conditions with recent registrations
                        setTimeout(() => {
                          // Check once more if customer exists before creating
                          this.customerService.getCustomerByUserId(user.uid).subscribe(
                            latestCustomer => {
                              if (!latestCustomer && !this.registrationInProgress) {
                                this.createEmptyCustomerIfNeeded().subscribe();
                              }
                            }
                          );
                        }, 1000);
                      }
                    },
                    error: (error) => {
                      this.loadingService.setLoading(false);
                      console.error("Error loading customer data:", error);
                      
                      // Bei Berechtigungsfehlern versuchen, einen leeren Kundendatensatz zu erstellen
                      if (error.code === 'permission-denied' && !this.registrationInProgress) {
                        console.log("Permission denied, attempting to create fallback");
                        this.createEmptyCustomerIfNeeded().subscribe();
                      }
                    }
                  });
                }
              });
            }
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

  // Diese Methode versucht einen leeren Customer zu erstellen, wenn noch keiner existiert
  private createEmptyCustomerIfNeeded(): Observable<any> {
    const currentUser = this.getUser();
    if (!currentUser) {
      return of(null);
    }

    // Check if this is a provider before creating a customer
    const userRole = localStorage.getItem(`user_role_${currentUser.uid}`);
    if (userRole === 'provider') {
      console.log("User is a provider, skipping customer creation");
      return of(null);
    }

    // Make one final check to see if a provider record exists
    return from(this.providerService.getProviderByUserId(currentUser.uid)).pipe(
      switchMap(provider => {
        if (provider) {
          console.log("Provider record exists, skipping customer creation");
          return of(null);
        }

        // Erstellen eines minimalen Kundendatensatzes basierend auf Auth-Daten
        const email = currentUser.email || '';
        const displayName = currentUser.displayName || '';
        const nameParts = displayName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        const customer: Customer = {
          customerId: '', // Wird von Firestore generiert
          userId: currentUser.uid,
          firstName: firstName,
          lastName: lastName,
          email: email,
          phone: ''
        };

        return from(this.customerService.createCustomer(customer)).pipe(
          switchMap((docRef) => {
            console.log("Empty customer created with ID:", docRef.id);
            // Customer-Objekt mit der neuen ID aktualisieren
            customer.customerId = docRef.id;
            
            // Aktualisiere das kombinierte Objekt
            this.userWithCustomerSubject.next({
              user: currentUser,
              customer: customer
            });
            
            return of(customer);
          }),
          catchError((error) => {
            console.error("Error creating empty customer:", error);
            return of(null);
          })
        );
      }),
      catchError(error => {
        console.error("Error checking for provider:", error);
        return of(null);
      })
    );
  }

  async register({ email, password, firstName, lastName, phone }: any) {
    try {
      // Set the flag to prevent duplicate customer creation
      this.registrationInProgress = true;
      
      this.loadingService.setLoading(true, 'Registriere Konto...');
      console.log("Starting registration process with data:", { 
        email, 
        firstName: firstName || "", 
        lastName: lastName || "", 
        phone: phone || "" 
      });
      
      // Firebase user registration
      const response = await createUserWithEmailAndPassword(this.auth, email, password);
      console.log("User created in Firebase Auth:", response.user.uid);
      
      // Update display name
      if (this.auth.currentUser) {
        await updateProfile(this.auth.currentUser, {
          displayName: `${firstName || ""} ${lastName || ""}`,
        });
        console.log("User profile updated with display name:", `${firstName || ""} ${lastName || ""}`);
      }
      
      // Create customer object if user registration successful
      if (response.user) {
        // Explicitly define all fields and convert undefined to empty string if needed
        const customer: Customer = {
          customerId: '', // Will be generated by Firestore
          userId: response.user.uid,
          firstName: firstName || "",
          lastName: lastName || "",
          email: email || "",
          phone: phone || ""
        };
        
        console.log("Creating customer data with explicit fields:", customer);
        
        // Save customer to Firestore
        try {
          const customerRef = await this.customerService.createCustomer(customer);
          console.log("Customer data created in Firestore successfully with ID:", customerRef.id);
          
          // Get the customer with ID and update the state
          const createdCustomer = {...customer, customerId: customerRef.id};
          this.userWithCustomerSubject.next({
            user: response.user,
            customer: createdCustomer
          });
        } catch (customerError) {
          console.error("Error creating customer data:", customerError);
        }
      }
      
      this.loadingService.setLoading(false);
      
      // Reset the flag after a short delay to ensure auth state changes complete
      setTimeout(() => {
        this.registrationInProgress = false;
        console.log("Registration process completed");
      }, 2000);
      
      return response;
    } catch (error) {
      this.loadingService.setLoading(false);
      // Reset the flag in case of error
      this.registrationInProgress = false;
      console.error("Registration error", error);
      throw error;
    }
  }
  
  async registerProvider({ email, password, firstName, lastName, phone, companyName, description, street, zip, city, logo, website, openingHours, specialties, facebook, instagram, acceptsOnlinePayments }: any) {
    try {
      this.registrationInProgress = true;
      
      // Set this flag to permanently mark this account as a provider
      sessionStorage.setItem('registering_provider', 'true');
      localStorage.setItem('registering_provider', 'true');
      
      this.loadingService.setLoading(true, 'Registriere Provider-Konto...');
      
      // Create Firebase user
      const response = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Update display name
      if (this.auth.currentUser) {
        await updateProfile(this.auth.currentUser, {
          displayName: `${firstName} ${lastName}`,
        });
      }
      
      // IMPORTANT: Set user role in localStorage immediately after user creation
      if (response.user) {
        localStorage.setItem(`user_role_${response.user.uid}`, 'provider');
        
        // Create a custom claim or custom user data field if possible
        // This is more reliable than localStorage
        const metadata = {
          userType: 'provider',
          creationTime: new Date().toISOString()
        };
        
        // Store this in Firestore if possible in a 'user_metadata' collection
        try {
          const metadataCollection = collection(this.firestore, 'user_metadata');
          await addDoc(metadataCollection, {
            userId: response.user.uid,
            userType: 'provider',
            createdAt: new Date()
          });
        } catch (error) {
          console.error("Could not save user metadata", error);
        }
      }
      
      // Don't create the provider object here - let the component handle that
      this.loadingService.setLoading(false);
      
      // Reset flags
      setTimeout(() => {
        this.registrationInProgress = false;
        sessionStorage.removeItem('registering_provider');
      }, 2000);
      
      return response;
    } catch (error) {
      this.loadingService.setLoading(false);
      this.registrationInProgress = false;
      sessionStorage.removeItem('registering_provider');
      localStorage.removeItem('registering_provider');
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
    return this.user$.pipe(
      map(user => !!user),
      take(1)
    );
  }

  // Prüft, ob ein Benutzer mit Customer-Daten vollständig geladen ist
  isUserWithCustomerReady(): Observable<boolean> {
    return this.user.pipe(
      map(userWithCustomer => {
        // If user doesn't exist, return false
        if (!userWithCustomer.user) return false;
        
        // Check if this is a provider
        const userRole = localStorage.getItem(`user_role_${userWithCustomer.user.uid}`);
        if (userRole === 'provider') {
          // For providers, we only need the user to be logged in
          return true;
        } else {
          // For customers, we need both user and customer data
          return !!userWithCustomer.customer;
        }
      }),
      take(1)
    );
  }
}