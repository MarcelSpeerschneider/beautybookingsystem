// src/app/components/service-detail/service-detail.component.ts

import { Component, OnInit, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Service } from '../../models/service.model';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-service-detail',
  templateUrl: './service-detail.component.html',
  styleUrls: ['./service-detail.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ServiceDetailComponent implements OnInit {
  @Input() service: Service | null = null;
  @Input() providerId: string = '';
  
  private router = inject(Router);
  private cartService = inject(CartService);
  
  constructor() { }
  
  ngOnInit(): void {
    // Initialize component
  }
  
  bookNow(): void {
    if (!this.service || !this.providerId) {
      console.error('Cannot book: missing service or provider ID');
      return;
    }
    
    // Store the provider ID for the booking flow
    this.cartService.setProviderId(this.providerId);
    
    // Add the service to the cart
    this.cartService.addItem(this.service);
    
    // Set booking flow flag to track the user's progress
    localStorage.setItem('bookingFlow', 'active');
    
    // Navigate to appointment selection
    this.router.navigate(['/appointment-selection', this.providerId]);
  }
}