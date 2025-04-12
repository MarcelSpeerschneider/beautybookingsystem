import { Injectable, inject } from '@angular/core';
import { Review } from '../models/review.model'; // Import the Review model
import { Observable, from } from 'rxjs';
import { Firestore, collection, doc, collectionData, docData, addDoc, updateDoc, deleteDoc, query, where, DocumentReference } from '@angular/fire/firestore';
import { switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private collectionName: string = 'reviews';
  firestore: Firestore = inject(Firestore);
  
  getReviews(): Observable<Review[]> {
    const myCollection = collection(this.firestore, this.collectionName);
    return collectionData(myCollection, { idField: 'reviewId' }) as Observable<Review[]>;
  }

  getReview(reviewId: string): Observable<Review> {
    const document = doc(this.firestore, `${this.collectionName}/${reviewId}`);
    return docData(document, { idField: 'reviewId' }) as Observable<Review>;
  }

  createReview(review: Review): Promise<any> {
    const myCollection = collection(this.firestore, this.collectionName);
    return addDoc(myCollection, review);
  }



  updateReview(review: Review): Observable<Review> {
    const document = doc(this.firestore, `${this.collectionName}/${review.reviewId}`);
    return from(updateDoc(document, {...review})).pipe(
      switchMap(() => {
        return this.getReview(review.reviewId);
      })
    );
  }

  deleteReview(reviewId: string): Observable<void> {
    const document = doc(this.firestore, `${this.collectionName}/${reviewId}`);
    return from(deleteDoc(document));
  }

  getReviewsByProvider(providerId: string): Observable<Review[]> {
    const myCollection = collection(this.firestore, this.collectionName);
    const queryRef = query(myCollection, where('providerId', '==', providerId));
    return collectionData(queryRef, { idField: 'reviewId' }) as Observable<Review[]>;
  }

  getReviewsByCustomer(customerId: string): Observable<Review[]> {
    const myCollection = collection(this.firestore, this.collectionName);
    const queryRef = query(myCollection, where('customerId', '==', customerId));
    return collectionData(queryRef, { idField: 'reviewId' }) as Observable<Review[]>;
  }

}