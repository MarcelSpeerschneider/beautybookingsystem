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
  private registrationInProgress = false;
  
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
            // Check for provider registration in progress
            const isRegisteringProvider = sessionStorage.getItem('registering_provider') === 'true';
                                         
            // If registration is in progress, don't try to load/create customer
            if (this.registrationInProgress || isRegisteringProvider) {
              console.log("Registration in progress, skipping customer auto-creation");
              
              // Clear temporary marker once used
              sessionStorage.removeItem('registering_provider');
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
      // First check if user is a provider by looking for a provider document
      const providerDoc = this.docInZone('providers', user.uid);
      
      try {
        // Important: Use the wrapped getDoc to ensure it runs in NgZone
        const providerSnapshot = await this.getDocInZone(providerDoc);
        
        if (providerSnapshot.exists()) {
          console.log("User is a provider, loading provider data");
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
          // Not a provider, look for customer data
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
                  // Check once more if customer exists before creating
                  this.customerService.getCustomer(user.uid).subscribe(
                    (latestCustomer) => {
                      if (!latestCustomer && !this.registrationInProgress) {
                        this.createEmptyCustomerIfNeeded().subscribe();
                      }
                    }
                  );
                }, 1000);
              }
            },
            error: (error: unknown) => {
              this.loadingService.setLoading(false);
              console.error("Error loading customer data:", error);
              
              // Try to create an empty customer record for permission errors
              if (error instanceof Object && 'code' in error && error.code === 'permission-denied' && !this.registrationInProgress) {
                console.log("Permission denied, attempting to create fallback");
                this.createEmptyCustomerIfNeeded().subscribe();
              }
            }
          });
        }
      } catch (error) {
        console.error("Error checking user type:", error);
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

      // First check if a provider record exists
      const providerDoc = this.docInZone('providers', currentUser.uid);
      
      return from(this.getDocInZone(providerDoc)).pipe(
        switchMap(providerSnapshot => {
          if (providerSnapshot.exists()) {
            console.log("Provider record exists, skipping customer creation");
            return of(null);
          }

          // Create a minimal customer record based on Auth data
          const email = currentUser.email || '';
          const displayName = currentUser.displayName || '';
          const nameParts = displayName.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

          // Customer-Daten ohne ID (das Model hat keine ID mehr)
          const customer: Customer = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            phone: '',
            createdAt: new Date(),
            updatedAt: new Date()
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

  async register({ email, password, firstName, lastName, phone }: any) {
    return ZoneUtils.wrapPromise(async () => {
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
          // Erstelle ein Customer-Objekt ohne ID-Feld (entsprechend dem neuen Interface)
          const customerData: Customer = {
            firstName: firstName || "",
            lastName: lastName || "",
            email: email || "",
            phone: phone || "",
            createdAt: new Date(),
            updatedAt: new Date()
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
  
  async registerProvider({ email, password, firstName, lastName, phone, companyName, description, street, zip, city, logo, website, openingHours, specialties, facebook, instagram, acceptsOnlinePayments }: any) {
    return ZoneUtils.wrapPromise(async () => {
      try {
        this.registrationInProgress = true;
        
        // Set this flag to mark the registration process
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
        
        // Store user metadata in Firestore
        try {
          const metadataCollection = this.collectionInZone('user_metadata');
          await this.ngZone.run(() => 
            addDoc(metadataCollection, {
              userId: response.user.uid,
              userType: 'provider',
              createdAt: new Date()
            })
          );
        } catch (error: unknown) {
          console.error("Could not save user metadata", error);
        }
        
        // Don't create the provider object here - let the component handle that
        this.loadingService.setLoading(false);
        
        // Reset flags
        setTimeout(() => {
          this.registrationInProgress = false;
          sessionStorage.removeItem('registering_provider');
        }, 2000);
        
        return response;
      } catch (error: unknown) {
        this.loadingService.setLoading(false);
        this.registrationInProgress = false;
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

  // Check if a user is a provider
  isProvider(userId: string): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      const providerDoc = this.docInZone('providers', userId);
      return from(this.getDocInZone(providerDoc)).pipe(
        map(docSnapshot => docSnapshot.exists()),
        take(1)
      );
    }, this.ngZone);
  }

  // Check if a user is a customer
  isCustomer(userId: string): Observable<boolean> {
    return ZoneUtils.wrapObservable(() => {
      const customerDoc = this.docInZone('customers', userId);
      return from(this.getDocInZone(customerDoc)).pipe(
        map(docSnapshot => docSnapshot.exists()),
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