import { ApplicationConfig, provideZoneChangeDetection, NgZone, inject, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from './../environments/environment';
import { routes } from './app.routes';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';

// Registriere die deutschen Locale-Daten
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    
    // Add FIREBASE_OPTIONS for compat modules
    { provide: FIREBASE_OPTIONS, useValue: environment.firebase },
    
    // Locale für die Anwendung auf Deutsch setzen
    { provide: LOCALE_ID, useValue: 'de' },
    
    // Initialize Firebase with explicit zone awareness
    provideFirebaseApp(() => {
      console.log('Initializing Firebase app in NgZone');
      return initializeApp(environment.firebase);
    }),
    
    // Firestore with zone handling
    provideFirestore(() => {
      console.log('Initializing Firestore in NgZone');
      const firestore = getFirestore();

      // Apply the zone patch for Firestore's `get` function
      const originalGet = (firestore as any).get;
      if(originalGet) {
        (firestore as any).get = function (...args: any[]) {
        const ngZone = inject(NgZone);
          return ngZone.run(() => originalGet.apply(firestore, args));
        };
      }      
      
      return firestore;
    }),
    
    // Auth with zone handling
    provideAuth(() => {
      console.log('Initializing Firebase Auth in NgZone');
      const auth = getAuth();
      return auth;
    }),
  ]
};