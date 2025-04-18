import { Injectable, inject, NgZone } from '@angular/core';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User,
         updateProfile, onAuthStateChanged } from 'firebase/auth';
import { BehaviorSubject, Observable, of, from } from 'rxjs';
import { catchError, switchMap, map, take } from 'rxjs/operators';
import { CustomerService } from './customer.service';
import { ProviderService } from './provider.service';
import { Customer } from '../models/customer.model';
import { Provider } from '../models/provider.model';
import { Router } from '@angular/router';
import { LoadingService } from './loading.service';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, doc, getDoc, setDoc, addDoc } from '@angular/fire/firestore';
import { FirebaseError } from 'firebase/app';
import { ZoneUtils } from '../utils/zone-utils';

export interface UserWithCustomer {
    user: User | null;
    customer: (Customer & { id: string }) | null;
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
  // Make this public so it can be reset by the registration component
  public registrationInProgress = false;
  
  // BehaviorSubject for the Firebase Auth state
  private firebaseUserSubject = new BehaviorSubject<User | null>(null);

  // BehaviorSubject for the combined User+Customer object
  private userWithCustomerSubject = new BehaviorSubject<UserWithCustomer>({
    user: null,
    customer: null
  });

  // Public Observable for the simple Firebase user
  user$ = this.firebaseUserSubject.asObservable();

  // Public Observable for the combined User+Customer object
  user = this.userWithCustomerSubject.asObservable();

  // Helper methods for Firebase operations
  private getDocInZone(docRef: any): Promise<any> {
    return this.ngZone.run(() => getDoc(docRef));
  }
  
  private docInZone(path: string, ...pathSegments: string[]): any {
    return this.ngZone.run(() => doc(this.firestore, path, ...pathSegments));
  }
  
  private collectionInZone(path: string): any {
    return this.ngZone.run(() => collection(this.firestore, path));
  }

  constructor() {
    console.log('AuthenticationService initialized');
    
    // Monitor Auth state inside the NgZone
    this.ngZone.run(() => {
      onAuthStateChanged(this.auth, (user) => {
        this.ngZone.run(() => {
          console.log("Auth state changed:", user ? "Logged in" : "Logged out");
          this.firebaseUserSubject.next(user);
          
          if (user) {
            // Check for provider registration in progress - using both storage types
            const isRegisteringProvider = localStorage.getItem('registering_provider') === 'true' || 
                                        sessionStorage.getItem('registering_provider') === 'true';
            
            // If registration is in progress, don't try to load/create customer
            if (this.registrationInProgress || isRegisteringProvider) {
              console.log("Registration in progress, skipping customer auto-creation");
              return;
            }
            
            this.loadUserData(user);
          } else {
            // If no user, set both to null
            this.userWithCustomerSubject.next({
              user: null,
              customer: null
            });
          }
        });
      });
    });
  }

  private loadUserData(user: User): void {
    ZoneUtils.wrapPromise(async () => {
      try {
        // IMPORTANT: Check if provider registration is in progress - with better detection
        const isRegisteringProvider = localStorage.getItem('registering_provider') === 'true' || 
                                    sessionStorage.getItem('registering_provider') === 'true';
        
        if (isRegisteringProvider || this.registrationInProgress) {
          console.log("Provider registration in progress, skipping customer auto-creation");
          // Don't remove the flag here - let the registration component handle it
          return;
        }

        // Prüfe zuerst die role-Eigenschaft im provider-Dokument
        const providerDoc = this.docInZone('providers', user.uid);
        const providerSnap = await this.getDocInZone(providerDoc);
        
        if (providerSnap.exists() && providerSnap.data().role === 'provider') {
          console.log("User has provider role, loading provider data");
          // Load provider data instead of customer
          this.loadingService.setLoading(true, 'Lade Anbieter-Daten...');
          
          this.providerService.getProvider(user.uid).subscribe({
            next: (provider) => {
              console.log("Provider data loaded:", provider ? "Found" : "Not found");
              this.userWithCustomerSubject.next({
                user: user,
                customer: null // No customer for providers
              });
              this.loadingService.setLoading(false);
            },
            error: (error: unknown) => {
              console.error("Error loading provider data:", error);
              this.loadingService.setLoading(false);
            }
          });
        } else {
          // Prüfe die role-Eigenschaft im customer-Dokument
          const customerDoc = this.docInZone('customers', user.uid);
          const customerSnap = await this.getDocInZone(customerDoc);
          
          if (customerSnap.exists() && customerSnap.data().role === 'customer') {
            this.loadingService.setLoading(true, 'Lade Benutzerdaten...');
            
            this.customerService.getCustomer(user.uid).subscribe({
              next: (customer) => {
                this.loadingService.setLoading(false);
                
                if (customer) {
                  // Customer gefunden - füge die ID hinzu und aktualisiere den BehaviorSubject
                  this.userWithCustomerSubject.next({
                    user: user,
                    customer: customer // customer enthält bereits die ID
                  });
                } else {
                  console.log("No customer data found, attempting to create fallback");
                  this.userWithCustomerSubject.next({
                    user: user,
                    customer: null
                  });
                  
                  // Add a slight delay to prevent race conditions with recent registrations
                  setTimeout(() => {
                    // Do an additional check for provider registration
                    const stillRegistering = localStorage.getItem('registering_provider') === 'true' || 
                                          sessionStorage.getItem('registering_provider') === 'true';
                    
                    // Check once more if customer exists before creating
                    if (!stillRegistering && !this.registrationInProgress) {
                      this.customerService.getCustomer(user.uid).subscribe(
                        (latestCustomer) => {
                          if (!latestCustomer) {
                            // Do one final check for provider record before creating customer
                            this.isProvider(user.uid).subscribe(isProvider => {
                              if (!isProvider) {
                                this.createEmptyCustomerIfNeeded().subscribe();
                              }
                            });
                          }
                        }
                      );
                    }
                  }, 1500);
                }
              },
              error: (error: unknown) => {
                this.loadingService.setLoading(false);
                console.error("Error loading customer data:", error);
                
                // Only try to create customer if not registering provider
                if (!isRegisteringProvider && !this.registrationInProgress) {
                  // Try to create an empty customer record for permission errors
                  if (error instanceof Object && 'code' in error && error.code === 'permission-denied') {
                    console.log("Permission denied, attempting to create fallback");
                    this.createEmptyCustomerIfNeeded().subscribe();
                  }
                }
              }
            });
          } else {
            // Weder Provider noch Customer mit entsprechender Rolle gefunden
            console.log("User has no valid role, checking for provider registration");
            this.userWithCustomerSubject.next({
              user: user,
              customer: null
            });
            
            // Only create customer if NOT in provider registration
            if (!isRegisteringProvider && !this.registrationInProgress) {
              console.log("Not in provider registration, creating customer");
              
              // Double check for provider record with a delay to handle race conditions
              setTimeout(() => {
                this.isProvider(user.uid).subscribe(isProvider => {
                  if (!isProvider) {
                    this.createEmptyCustomerIfNeeded().subscribe();
                  }
                });
              }, 1500);
            } else {
              console.log("In provider registration, skipping customer creation");
            }
          }
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        this.loadingService.setLoading(false);
      }
    }, this.ngZone);
  }

  // This method tries to create an empty customer if none exists
  private createEmptyCustomerIfNeeded(): Observable<any> {
    return ZoneUtils.wrapObservable(() => {
      const currentUser = this.getUser();
      if (!currentUser) {
        return of(null);
      }

      // First check if a provider record exists with provider role
      const providerDoc = this.docInZone('providers', currentUser.uid);
      
      return from(this.getDocInZone(providerDoc)).pipe(
        switchMap(providerSnapshot => {
          if (providerSnapshot.exists() && providerSnapshot.data().role === 'provider') {
            console.log("Provider record with provider role exists, skipping customer creation");
            return of(null);
          }

          // Double check for provider registration flags
          const isRegisteringProvider = localStorage.getItem('registering_provider') === 'true' || 
                                     sessionStorage.getItem('registering_provider') === 'true';
                                     
          if (isRegisteringProvider || this.registrationInProgress) {
            console.log("Provider registration flags found, skipping customer creation");
            return of(null);
          }

          // Create a minimal customer record based on Auth data
          const email = currentUser.email || '';
          const displayName = currentUser.displayName || '';
          const nameParts = displayName.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

          // Create customer with role field
          const customer: Customer = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            phone: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            role: 'customer' // Explicit role field
          };

          return from(this.customerService.createCustomer(customer, currentUser.uid)).pipe(
            switchMap((customerId: string) => {
              console.log("Empty customer created with ID:", customerId);
              
              // Holen Sie den erstellten Kunden mit seiner ID
              return this.customerService.getCustomer(customerId).pipe(
                map(createdCustomer => {
                  if (createdCustomer) {
                    // Kunden-Objekt existiert mit ID
                    this.userWithCustomerSubject.next({
                      user: currentUser,
                      customer: createdCustomer
                    });
                  }
                  return createdCustomer;
                })
              );
            }),
            catchError((error: unknown) => {
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
    }, this.ngZone);
  }

  async register({ email, password, firstName, lastName, phone, role }: any) {
    return ZoneUtils.wrapPromise(async () => {
      try {
        // Set the flag to prevent duplicate customer creation
        this.registrationInProgress = true;
        
        this.loadingService.setLoading(true, 'Registriere Konto...');
        console.log("Starting registration process with data:", { 
          email, 
          firstName: firstName || "", 
          lastName: lastName || "", 
          phone: phone || "", 
          role: role || "customer" // Standardmäßig Customer-Rolle, wenn nicht angegeben
        });
        
        // Firebase user registration
        const response = await this.ngZone.run(() => 
          createUserWithEmailAndPassword(this.auth, email, password)
        );
        console.log("User created in Firebase Auth:", response.user.uid);
        
        // Update display name
        if (this.auth.currentUser) {
          await this.ngZone.run(() => 
            updateProfile(this.auth.currentUser!, {
              displayName: `${firstName || ""} ${lastName || ""}`,
            })
          );
          console.log("User profile updated with display name:", `${firstName || ""} ${lastName || ""}`);
        }
        
        // Create customer object if user registration successful
        if (response.user) {
          // Stelle sicher, dass die Rolle entweder 'customer' oder 'provider' ist
          const actualRole = role === 'provider' ? 'provider' : 'customer';
          
          if (actualRole === 'customer') {
            // Create Customer with explicit role field
            const customerData: Customer = {
              firstName: firstName || "",
              lastName: lastName || "",
              email: email || "",
              phone: phone || "",
              createdAt: new Date(),
              updatedAt: new Date(),
              role: 'customer' // Explicit role field
            };
            
            console.log("Creating customer data:", customerData);
            
            // Save customer to Firestore using the user's UID as the document ID
            try {
              // Speichere Kunde mit UID als Dokument-ID
              const customerId = await this.customerService.createCustomer(customerData, response.user.uid);
              console.log("Customer data created in Firestore successfully with ID:", customerId);
              
              // Kunden mit seiner ID abrufen
              this.customerService.getCustomer(customerId).subscribe({
                next: (customer) => {
                  if (customer) {
                    // Customer enthält bereits die ID
                    this.userWithCustomerSubject.next({
                      user: response.user,
                      customer: customer
                    });
                  }
                },
                error: (error) => {
                  console.error("Error loading created customer:", error);
                }
              });
            } catch (customerError) {
              console.error("Error creating customer data:", customerError);
            }
          }
          // Provider-Registrierung wird in der Provider-Registrierungskomponente behandelt
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
    }, this.ngZone);
  }
  
  async registerProvider({ email, password, firstName, lastName, phone, companyName, description, street, zip, city, logo, website, openingHours, specialties, facebook, instagram, acceptsOnlinePayments, role }: any) {
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.registrationInProgress = true;
        
        // Set flags in BOTH localStorage and sessionStorage for better persistence
        localStorage.setItem('registering_provider', 'true');
        sessionStorage.setItem('registering_provider', 'true');
        
        this.loadingService.setLoading(true, 'Registriere Provider-Konto...');
        
        // Create Firebase user
        const response = await this.ngZone.run(() => 
          createUserWithEmailAndPassword(this.auth, email, password)
        );
        
        // Update display name
        if (this.auth.currentUser) {
          await this.ngZone.run(() => 
            updateProfile(this.auth.currentUser!, {
              displayName: `${firstName} ${lastName}`,
            })
          );
        }
        
        // Don't create the provider object here - let the component handle that with the role field
        this.loadingService.setLoading(false);
        
        // Keep the registration flags set - they will be cleared when the provider document is created
        
        return response;
      } catch (error: unknown) {
        this.loadingService.setLoading(false);
        this.registrationInProgress = false;
        localStorage.removeItem('registering_provider');
        sessionStorage.removeItem('registering_provider');
        console.error("Provider registration error", error);
        throw error;
      }
    }, this.ngZone);
  }
  
  login({ email, password }: any): Promise<any> {
    return ZoneUtils.wrapPromise(async () => {
      this.loadingService.setLoading(true, 'Anmeldung wird durchgeführt...');
      console.log("Attempting login for:", email);
      
      try {
        const result = await this.ngZone.run(() => 
          signInWithEmailAndPassword(this.auth, email, password)
        );
        console.log("Login successful");
        return result;
      } catch (error) {
        console.error("Login failed:", error);
        this.loadingService.setLoading(false);
        throw error;
      }
    }, this.ngZone);
  }

  logout(): Promise<void> {
    return ZoneUtils.wrapPromise(async () => {
      this.loadingService.setLoading(true, 'Abmeldung...');
      console.log("Logging out");
      
      // Reset the combined object after logout
      this.userWithCustomerSubject.next({
        user: null,
        customer: null
      });
      
      try {
        await this.ngZone.run(() => signOut(this.auth));
        this.loadingService.setLoading(false);
        return;
      } catch (error) {
        this.loadingService.setLoading(false);
        throw error;
      }
    }, this.ngZone);
  }

  getUser(): User | null {
    return this.auth.currentUser;
  }
  
  getCurrentUserWithCustomer(): UserWithCustomer {
    return this.userWithCustomerSubject.getValue();
  }

  // Helper method to check if a user is logged in
  isLoggedIn(): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      return this.user$.pipe(
        map(user => !!user),
        take(1)
      );
    }, this.ngZone);
  }

  // Check if a user has provider role (vereinfacht)
  isProvider(userId: string): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      const userDoc = this.docInZone('providers', userId);
      return from(this.getDocInZone(userDoc)).pipe(
        map(docSnapshot => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            // Prüfe nur die role-Eigenschaft
            return data && data.role === 'provider';
          }
          return false;
        }),
        take(1)
      );
    }, this.ngZone);
  }

  // Check if a user has customer role (vereinfacht)
  isCustomer(userId: string): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      const customerDoc = this.docInZone('customers', userId);
      return from(this.getDocInZone(customerDoc)).pipe(
        map(docSnapshot => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            // Prüfe nur die role-Eigenschaft
            return data && data.role === 'customer';
          }
          return false;
        }),
        take(1)
      );
    }, this.ngZone);
  }

  // Checks if a user with customer data is fully loaded
  isUserWithCustomerReady(): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      return this.user.pipe(
        map(userWithCustomer => {
          // If user doesn't exist, return false
          if (!userWithCustomer.user) return false;
          
          // For customers, we need both user and customer data
          return !!userWithCustomer.customer;
        }),
        take(1)
      );
    }, this.ngZone);
  }
}