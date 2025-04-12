import { Injectable, inject } from '@angular/core';
import { ServiceBreak } from '../models/break.model';
import { Observable, from } from 'rxjs';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, DocumentReference, query, where } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class ServiceBreakService {
 private collectionName = 'breaks';
 firestore: Firestore = inject(Firestore);
 constructor(){}


  getBreaks(): Observable<ServiceBreak[]> {
    const breaksCollection = collection(this.firestore, this.collectionName);
    return collectionData(breaksCollection, { idField: 'breakId' }) as Observable<ServiceBreak[]>;
  }

  getBreak(breakId: string): Observable<ServiceBreak | undefined> {
    const breakDocument = doc(this.firestore, `${this.collectionName}/${breakId}`);
    return docData(breakDocument) as Observable<ServiceBreak>;
  }

  getBreaksByProvider(providerId: string): Observable<ServiceBreak[]> {
        const breaksCollection = collection(this.firestore, this.collectionName);
        const q = query(breaksCollection, where('providerId', '==', providerId));
        return collectionData(q, { idField: 'breakId' }) as Observable<ServiceBreak[]>;
  }

   createBreak(breakData: ServiceBreak): Promise<DocumentReference> {
    const breaksCollection = collection(this.firestore, this.collectionName);
    return addDoc(breaksCollection, breakData);
  }

  updateBreak(breakData: ServiceBreak): Promise<void> {
    const breakDocument = doc(this.firestore, `${this.collectionName}/${breakData.breakId}`);
    return updateDoc(breakDocument, { ...breakData });
  }
  deleteBreak(breakId: string): Promise<void> {
    const breakDocument = doc(this.firestore, `${this.collectionName}/${breakId}`);
    return deleteDoc(breakDocument);
  }
}