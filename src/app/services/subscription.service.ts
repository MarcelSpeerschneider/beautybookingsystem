import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  updateDoc, 
  query,
  where,
  deleteDoc
} from '@angular/fire/firestore';
import { map, switchMap } from 'rxjs/operators';
import { DocumentReference } from '@firebase/firestore';
export interface Subscription {
  subscriptionId: string;
  userId: string;
  subscriptionType: string;
  startDate: Date;
  endDate: Date;
}
@Injectable({
  providedIn: 'root',
})
export class SubscriptionService {
  private collectionName = 'subscriptions';
  firestore: Firestore = inject(Firestore);

  constructor() {}

  getSubscriptions(): Observable<Subscription[]> {
    const myCollection = collection(this.firestore, this.collectionName);
    return collectionData(myCollection, { idField: 'subscriptionId' }) as Observable<Subscription[]>;
  }

  getSubscriptionsByUser(userId: string): Observable<Subscription[]> {
    const myCollection = collection(this.firestore, this.collectionName);
    const q = query(myCollection, where('userId', '==', userId));

    return collectionData(myCollection, { idField: 'subscriptionId' }) as Observable<Subscription[]>;
  }

  getSubscription(subscriptionId: string): Observable<Subscription> {
    const myDoc = doc(this.firestore, `${this.collectionName}/${subscriptionId}`);
    return docData(myDoc, { idField: 'subscriptionId' }) as Observable<Subscription>;
  }
  /**
   * Returns the subscription status of a user.
   * @param userId - The ID of the user.
   */
  getSubscriptionStatus(userId: string): Observable<string | null> {
    return this.getSubscriptions().pipe(
      map((subscriptions) => {
        const userSubscription = subscriptions.find(sub => sub.userId === userId);
        return userSubscription ? userSubscription.subscriptionType : null;
      })
    );

  }
  /**
   * Creates a new subscription for a user.
   * @param userId - The ID of the user.
   * @param subscriptionType - The type of subscription.
   */
  createSubscription(userId: string, subscriptionType: string): Promise<DocumentReference> {
    const newSubscription: Subscription = {
      subscriptionId: '', // wird von firestore generiert
      userId: userId,
      subscriptionType: subscriptionType,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Setzt das Enddatum auf einen Monat in der Zukunft
    };
    const myCollection = collection(this.firestore, this.collectionName);
    return addDoc(myCollection, newSubscription)
  }

  /**
   * Cancels the subscription of a user.
   * @param userId - The ID of the user.
   */
  cancelSubscription(userId: any): Observable<void> {
    return this.getSubscriptions().pipe(
      switchMap((subscriptions) => {
        const userSubscription = subscriptions.find((sub) => sub.userId === userId);
        if (!userSubscription) {
          return of(undefined);
        }
        const myDoc = doc(this.firestore, `${this.collectionName}/${userSubscription.subscriptionId}`);
        return from(deleteDoc(myDoc));
      })
    );
  }
  /**
   * Updates a subscription for a user.
   * @param userId
   * @param subscriptionType
   */
  updateSubscription(userId: any, subscriptionType: any): Observable<void> {
    return this.getSubscriptions().pipe(
      switchMap((subscriptions) => {
        const userSubscription = subscriptions.find((sub) => sub.userId === userId);
        if (!userSubscription) {
          return of(undefined);
        }
        const updatedSubscription = { ...userSubscription, subscriptionType };
        const myDoc = doc(this.firestore, `${this.collectionName}/${userSubscription.subscriptionId}`);
        return from(updateDoc(myDoc, updatedSubscription));
      })
    );
  }
  }