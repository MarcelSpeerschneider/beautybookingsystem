import { Injectable, inject} from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User, updateProfile } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  auth: Auth = inject(Auth);

  constructor() { }

  async register({ email, password, firstName, lastName }: any) {
    const response =  await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(this.auth.currentUser!, {
      displayName: `${firstName} ${lastName}`,
    })
    console.log("response", response);

    return response;
  }

  login({ email, password }: any) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout() {
    return signOut(this.auth);
  }

  getUser() : User | null{
    return this.auth.currentUser
  }
}