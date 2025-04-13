import { Component, OnInit, inject, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthenticationService } from '../../../services/authentication.service';
import { User, updateProfile } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { Customer } from '../../../models/customer.model';
import { Router } from '@angular/router';


@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-customer-profile',
    templateUrl: './customer-profile.component.html',
    styleUrls: ['./customer-profile.component.css'],
    standalone: true,
    imports: [CommonModule]
})
export class CustomerProfileComponent implements OnInit, OnDestroy {
    customer: Customer | null = null;
    user: User | null = null;
    private auth: AuthenticationService = inject(AuthenticationService);
    private userSubscription: Subscription | undefined;
    isLoading: boolean = true;
    private customerSubscription: Subscription | undefined;
    private router = inject(Router)

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

    logout() {
        this.auth.logout().then(() => {
            this.router.navigate(['/customer-login']);
        });
    }
}