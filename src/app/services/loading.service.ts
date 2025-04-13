import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  // BehaviorSubject explizit mit LoadingState typisieren
  private loadingSubject = new BehaviorSubject<LoadingState>({ isLoading: false });
  
  // Öffentliches Observable mit korrektem Typ exportieren
  loading$: Observable<LoadingState> = this.loadingSubject.asObservable();
  
  setLoading(isLoading: boolean, message?: string): void {
    this.loadingSubject.next({ isLoading, message });
  }
  
  getLoadingState(): LoadingState {
    return this.loadingSubject.getValue();
  }
}