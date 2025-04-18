import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Service } from '../models/service.model';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItems: Service[] = [];
  private cartItemsSubject: BehaviorSubject<Service[]> = new BehaviorSubject<Service[]>([]);
  public cartItems$: Observable<Service[]> = this.cartItemsSubject.asObservable();
  
  constructor() {
    // Try to retrieve cart from localStorage on service initialization
    this.loadCartFromStorage();
  }

  private loadCartFromStorage(): void {
    const savedCart = localStorage.getItem('serviceCart');
    if (savedCart) {
      try {
        this.cartItems = JSON.parse(savedCart);
        this.cartItemsSubject.next([...this.cartItems]);
      } catch (e) {
        console.log('Cart from LocalStorage', savedCart);
        console.log('Cart Items', this.cartItems);
        
        console.error('Error loading cart from storage:', e);
        this.cartItems = [];
        this.cartItemsSubject.next([]);
      }
    }
  }

  private saveCartToStorage(): void {
    localStorage.setItem('serviceCart', JSON.stringify(this.cartItems));
  }

  getItems(): Service[] {
    return [...this.cartItems];
  }
  
  getItemCount(): number {
    return this.cartItems.length;
  }
  
  getTotalPrice(): number {
    return this.cartItems.reduce((total, item) => total + item.price, 0);
  }
  
  getTotalDuration(): number {
    return this.cartItems.reduce((total, item) => total + item.duration, 0);
  }
  
  addItem(service: Service): void {
    // Check if the item is already in the cart
    if (!this.isInCart(service.id)) {
      console.log('Adding item to cart:', service);
      console.log('Current cartItems:', this.cartItems);
      console.log('Item to be pushed', service);
      console.log('Current cartItems before push', this.cartItems);
      this.cartItems.push({...service});
      console.log('Current cartItems after push:', this.cartItems);
      this.cartItemsSubject.next([...this.cartItems]);
      this.saveCartToStorage();
    }
  }
  
  removeItem(serviceId: string): void {
    this.cartItems = this.cartItems.filter(item => item.id !== serviceId);
    this.cartItemsSubject.next([...this.cartItems]);
    this.saveCartToStorage();
  }
  
  clearCart(): void {
    this.cartItems = [];
    this.cartItemsSubject.next([]);
    localStorage.removeItem('serviceCart');
  }
  
  isInCart(serviceId: string): boolean {
    return this.cartItems.some(item => item.id === serviceId);
  }
  
  // Helper to set provider ID for the booking process
  setProviderId(providerId: string): void {
    localStorage.setItem('providerId', providerId);
  }
  
  getProviderId(): string | null {
    return localStorage.getItem('providerId');
  }
  
  clearProviderId(): void {
    localStorage.removeItem('providerId');
    console.log('Provider ID has been removed from localStorage');
  }
  
  cleanupBookingData(): void {
    this.clearCart();
    this.clearProviderId();
    localStorage.removeItem('bookingFlow');
    console.log('All booking-related data has been cleaned up');
  }
}