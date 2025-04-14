import { Component, OnInit, inject, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../../services/authentication.service';
import { User, updateProfile } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { Customer } from '../../../models/customer.model';
import { Router } from '@angular/router';
import { CustomerService } from '../../../services/customer.service';


@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'app-customer-profile',
    templateUrl: './customer-profile.component.html',
    styleUrls: ['./customer-profile.component.css'],
    standalone: true,
    imports: [CommonModule, FormsModule]
})
export class CustomerProfileComponent implements OnInit, OnDestroy {
    customer: Customer | null = null;
    user: User | null = null;
    private auth: AuthenticationService = inject(AuthenticationService);
    private userSubscription: Subscription | undefined;
    isLoading: boolean = true;
    private customerSubscription: Subscription | undefined;
    private router = inject(Router)

    isEditing: boolean = false;
    editedPhone: string = '';
    private customerService = inject(CustomerService);
    constructor() { }

    ngOnInit() {
        this.userSubscription = this.auth.user.subscribe(userWithCustomer => {
            if (userWithCustomer.user) {
                this.user = userWithCustomer.user;

                if (userWithCustomer.customer) {
                    this.customer = userWithCustomer.customer;
                    this.editedPhone = this.customer.phone;
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

    editProfile(){
        this.isEditing = true;
    }
    saveChanges() {
        if (this.customer && this.editedPhone) {
            const updatedCustomer = { ...this.customer, phone: this.editedPhone };
            this.customerService.updateCustomer(updatedCustomer)
                .then(() => {
                    this.customer = updatedCustomer;
                    this.isEditing = false;
                })
                .catch((error) => { console.error('Error updating customer:', error); });
        }
    }

    logout() {
        this.auth.logout().then(() => {
            this.router.navigate(['/customer-login']);
        });
    }
}