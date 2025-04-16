// src/app/utils/zone-utils.ts
import { NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';

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
}