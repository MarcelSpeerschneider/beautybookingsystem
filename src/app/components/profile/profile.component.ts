import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthenticationService } from '../../services/authentication.service';
import { User, updateProfile } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { Customer } from '../../models/customer.model';


@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.css'],
    standalone: true,
    imports: [CommonModule]
})
export class ProfileComponent implements OnInit, OnDestroy {
    customer: Customer | null = null;
    user: User | null = null;
    private auth: AuthenticationService = inject(AuthenticationService);
    private userSubscription: Subscription | undefined;
    isLoading: boolean = true;
    private customerSubscription: Subscription | undefined;

    constructor() { }

    ngOnInit() {
        this.userSubscription = this.auth.user.subscribe(userWithCustomer => {
            if (userWithCustomer.user) {
                this.user = userWithCustomer.user;

                if (userWithCustomer.customer) {
                    this.customer = userWithCustomer.customer;
                    if (this.user) {
                        updateProfile(this.user, {
                            displayName: `${userWithCustomer.customer.firstName} ${userWithCustomer.customer.lastName}`,
                        });
                    }
                }
            }
            this.isLoading = false;
        });
    }

    ngOnDestroy(): void {
        this.userSubscription?.unsubscribe();
    }

    editProfile() {
      
    }
}
