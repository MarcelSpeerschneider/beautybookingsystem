import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService, LoadingState } from '../../services/loading.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="loading$ | async as state" 
         class="loading-overlay" 
         [class.show]="state.isLoading">
      <div class="loading-spinner"></div>
      <div class="loading-message" *ngIf="state.message">{{ state.message }}</div>
    </div>
  `,
  styles: [`
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      visibility: hidden;
      opacity: 0;
      transition: visibility 0s, opacity 0.3s linear;
    }
    
    .loading-overlay.show {
      visibility: visible;
      opacity: 1;
    }
    
    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 5px solid #f3f3f3;
      border-top: 5px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    .loading-message {
      color: white;
      margin-top: 15px;
      font-weight: bold;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class LoadingComponent implements OnInit {
  private loadingService = inject(LoadingService);
  
  // Explizit den richtigen Typ definieren und initialisieren
  loading$: Observable<LoadingState>;
  
  constructor() {
    // Initialisierung im Konstruktor
    this.loading$ = this.loadingService.loading$;
  }
  
  ngOnInit(): void {
    // Keine Zuweisung mehr nötig, da bereits im Konstruktor initialisiert
  }
}