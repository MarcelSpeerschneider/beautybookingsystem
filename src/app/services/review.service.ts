// src/app/services/review.service.ts

import { Injectable, inject } from '@angular/core';
import { Review } from '../models/review.model'; 
import { Observable, from, of } from 'rxjs';
import { Firestore, collection, doc, collectionData, docData, addDoc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';
import { switchMap, map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private collectionName: string = 'reviews';
  firestore: Firestore = inject(Firestore);
  
  getReviews(): Observable<(Review & { reviewId: string })[]> {
    const myCollection = collection(this.firestore, this.collectionName);
    return collectionData(myCollection, { idField: 'reviewId' }).pipe(
      map(data => data as (Review & { reviewId: string })[]),
      catchError(error => {
        console.error('Error fetching reviews:', error);
        return of([]);
      })
    );
  }

  getReview(reviewId: string): Observable<Review & { reviewId: string }> {
    const document = doc(this.firestore, `${this.collectionName}/${reviewId}`);
    return docData(document, { idField: 'reviewId' }).pipe(
      map(data => data as (Review & { reviewId: string })),
      catchError(error => {
        console.error(`Error fetching review with ID ${reviewId}:`, error);
        return of(null as any);
      })
    );
  }

  createReview(review: Review): Promise<string> {
    const myCollection = collection(this.firestore, this.collectionName);
    
    // Stelle sicher, dass createdAt gesetzt ist
    const reviewToSave = {
      ...review,
      createdAt: review.createdAt || new Date()
    };
    
    // addDoc gibt eine DocumentReference zurück
    return addDoc(myCollection, reviewToSave)
      .then(docRef => {
        console.log('Review created with ID:', docRef.id);
        return docRef.id;
      })
      .catch(error => {
        console.error('Error creating review:', error);
        throw error;
      });
  }

  updateReview(review: Review & { reviewId: string }): Observable<Review & { reviewId: string }> {
    const { reviewId, ...reviewData } = review;
    const document = doc(this.firestore, `${this.collectionName}/${reviewId}`);
    
    return from(updateDoc(document, reviewData)).pipe(
      switchMap(() => {
        console.log('Review updated successfully:', reviewId);
        return this.getReview(reviewId);
      }),
      catchError(error => {
        console.error(`Error updating review with ID ${reviewId}:`, error);
        throw error;
      })
    );
  }

  deleteReview(reviewId: string): Observable<void> {
    const document = doc(this.firestore, `${this.collectionName}/${reviewId}`);
    return from(deleteDoc(document)).pipe(
      catchError(error => {
        console.error(`Error deleting review with ID ${reviewId}:`, error);
        throw error;
      })
    );
  }

  getReviewsByProvider(providerId: string): Observable<(Review & { reviewId: string })[]> {
    const myCollection = collection(this.firestore, this.collectionName);
    const queryRef = query(myCollection, where('providerId', '==', providerId));
    
    return collectionData(queryRef, { idField: 'reviewId' }).pipe(
      map(data => {
        console.log(`Found ${data.length} reviews for provider ${providerId}`);
        return data as (Review & { reviewId: string })[];
      }),
      catchError(error => {
        console.error(`Error fetching reviews for provider ${providerId}:`, error);
        return of([]);
      })
    );
  }

  getReviewsByCustomer(customerId: string): Observable<(Review & { reviewId: string })[]> {
    const myCollection = collection(this.firestore, this.collectionName);
    const queryRef = query(myCollection, where('customerId', '==', customerId));
    
    return collectionData(queryRef, { idField: 'reviewId' }).pipe(
      map(data => {
        console.log(`Found ${data.length} reviews from customer ${customerId}`);
        return data as (Review & { reviewId: string })[];
      }),
      catchError(error => {
        console.error(`Error fetching reviews from customer ${customerId}:`, error);
        return of([]);
      })
    );
  }
  
  // Zusätzliche Methode: Bewertungen für einen bestimmten Service abrufen
  getReviewsByService(serviceId: string): Observable<(Review & { reviewId: string })[]> {
    const myCollection = collection(this.firestore, this.collectionName);
    const queryRef = query(myCollection, where('serviceId', '==', serviceId));
    
    return collectionData(queryRef, { idField: 'reviewId' }).pipe(
      map(data => {
        console.log(`Found ${data.length} reviews for service ${serviceId}`);
        return data as (Review & { reviewId: string })[];
      }),
      catchError(error => {
        console.error(`Error fetching reviews for service ${serviceId}:`, error);
        return of([]);
      })
    );
  }
  
  // Zusätzliche Methode: Durchschnittliche Bewertung für einen Provider abrufen
  getAverageRatingForProvider(providerId: string): Observable<number> {
    return this.getReviewsByProvider(providerId).pipe(
      map(reviews => {
        if (reviews.length === 0) {
          return 0;
        }
        
        const sum = reviews.reduce((total, review) => total + review.rating, 0);
        const average = sum / reviews.length;
        
        console.log(`Average rating for provider ${providerId}:`, average);
        return average;
      }),
      catchError(error => {
        console.error(`Error calculating average rating for provider ${providerId}:`, error);
        return of(0);
      })
    );
  }
}