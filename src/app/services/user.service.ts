import { Injectable, inject } from '@angular/core';
import { User } from '../models/user.model';
import { from, Observable } from 'rxjs';
import {
  Firestore,
  collection,
  doc, 
  getDocs,
  query,
  setDoc,
  where,
  collectionData,
  docData,
  addDoc,
    DocumentReference, updateDoc,
  deleteDoc
} from '@angular/fire/firestore';
import { map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private collectionName = 'users';
  firestore: Firestore = inject(Firestore);

  getUsers(): Observable<User[]> {    
    const collectionRef = collection(this.firestore, this.collectionName);
    return collectionData(collectionRef, { idField: 'userId' }) as Observable<User[]>;
  }

  getUser(userId: string): Observable<User | undefined> {
    const documentRef = doc(this.firestore, `${this.collectionName}/${userId}`);
    return docData(documentRef, { idField: 'userId' }) as Observable<User>;
  }

  createUser(user: User): Promise<DocumentReference> {
    const collectionRef = collection(this.firestore, this.collectionName);
    return addDoc(collectionRef, user);
  }

  updateUser(user: User): Observable<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${user.userId}`);
    return from(updateDoc(docRef, { ...user } as any));
  }

  deleteUser(userId: string): Observable<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${userId}`);
    return from(deleteDoc(docRef));
  }

  getUserByEmail(email: string): Observable<User | undefined> {
    const collectionRef = collection(this.firestore, this.collectionName);
    const q = query(collectionRef, where('email', '==', email));
    return from(getDocs(q)).pipe(
      map((snapshot) => {
        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          return { ...userDoc.data(), userId: userDoc.id } as User;
        } else {
          return undefined;
        }
      })
    );
  }

  updateSubscriptionStatus(userId: string, subscriptionStatus: string) {
    return this.getUser(userId).pipe(
      switchMap((user) => {
        if (user) {
          user.subscriptionStatus = subscriptionStatus;
          return this.updateUser(user);
        } else {
          return [undefined];
        }
      })
    );
  }
    getUsersByRole(role: string): Observable<User[]> {
        const collectionRef = collection(this.firestore, this.collectionName);
        const q = query(collectionRef, where('role', '==', role));
        return collectionData(q, { idField: 'userId' }) as Observable<User[]>;
    }
}
