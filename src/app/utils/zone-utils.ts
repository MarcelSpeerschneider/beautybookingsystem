import { NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  query,
  where,
  limit,
  WhereFilterOp,
  collectionData, 
  docData
} from '@angular/fire/firestore';

export class ZoneUtils {
  static wrapObservable<T>(operation: () => Observable<T>, ngZone: NgZone): Observable<T> {
    return new Observable<T>(observer => {
      ngZone.run(() => {
        try {
          const subscription = operation().subscribe({
            next: (value) => ngZone.run(() => observer.next(value)),
            error: (err) => ngZone.run(() => observer.error(err)),
            complete: () => ngZone.run(() => observer.complete())
          });
          
          return () => subscription.unsubscribe();
        } catch (error) {
          ngZone.run(() => {
            console.error('Error in wrapped operation:', error);
            observer.error(error);
            observer.complete();
          });
        }
        return;
      });
    });
  }

  static wrapPromise<T>(operation: () => Promise<T>, ngZone: NgZone): Promise<T> {
    return ngZone.run(() => operation());
  }
  
  // New Firebase-specific utilities
  static getDoc(docRef: any, ngZone: NgZone): Promise<any> {
    return ngZone.run(() => getDoc(docRef));
  }
  
  static getDocs(queryRef: any, ngZone: NgZone): Promise<any> {
    return ngZone.run(() => getDocs(queryRef));
  }
  
  static doc(firestore: Firestore, ngZone: NgZone, path: string, ...pathSegments: string[]): any {
    return ngZone.run(() => doc(firestore, path, ...pathSegments));
  }
  
  static collection(firestore: Firestore, path: string, ngZone: NgZone): any {
    return ngZone.run(() => collection(firestore, path));
  }
  
  static query(collectionRef: any, ngZone: NgZone, ...queryConstraints: any[]): any {
    return ngZone.run(() => query(collectionRef, ...queryConstraints));
  }
  
  static where(fieldPath: string, opStr: WhereFilterOp, value: any, ngZone: NgZone): any {
    return ngZone.run(() => where(fieldPath, opStr, value));
  }
  
  static collectionData(collectionRef: any, options: any, ngZone: NgZone): Observable<any> {
    return ngZone.run(() => collectionData(collectionRef, options));
  }
  
  static docData(docRef: any, options: any, ngZone: NgZone): Observable<any> {
    return ngZone.run(() => docData(docRef, options));
  }
}