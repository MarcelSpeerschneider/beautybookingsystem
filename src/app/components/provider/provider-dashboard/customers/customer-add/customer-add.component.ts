import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CustomerService } from '../../../../../services/customer.service';
import { LoadingService } from '../../../../../services/loading.service';
import { Customer } from '../../../../../models/customer.model';
import { Provider } from '../../../../../models/provider.model';
import { ProviderCustomerService } from '../../../../../services/provider-customer.service';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-customer-add',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './customer-add.component.html',
  styleUrls: ['./customer-add.component.css']
})
export class CustomerAddComponent implements OnInit {
  @Input() provider!: Provider;
  @Output() close = new EventEmitter<void>();
  @Output() customerCreated = new EventEmitter<Customer>();
  
  customerForm: FormGroup;
  formErrors: { [key: string]: string } = {};
  
  private fb = inject(FormBuilder);
  private customerService = inject(CustomerService);
  private loadingService = inject(LoadingService);
  private providerCustomerService = inject(ProviderCustomerService);
  private auth = inject(Auth);
  
  constructor() {
    this.customerForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.email]],
      phone: [''],
      notes: ['']
    });
  }
  
  ngOnInit(): void {
    if (!this.provider || !this.provider.userId) {
      console.error('Provider-Daten fehlen oder sind ungültig!');
    }
  }
  
  onSubmit(): void {
    if (this.validateForm()) {
      this.loadingService.setLoading(true, 'Kunde wird erstellt...');
      
      // Get the current authenticated user ID
      const authUserId = this.auth.currentUser?.uid;
      
      if (!authUserId) {
        this.loadingService.setLoading(false);
        this.formErrors['general'] = 'Fehler: Nicht authentifiziert!';
        return;
      }

      // IMPORTANT: For creating customer records, we must use the authenticated user's ID
      // to comply with Firestore security rules
      const customer: Customer = {
        customerId: '', // Will be set by Firestore
        userId: authUserId, // This is crucial for security rules to allow creation
        firstName: this.customerForm.value.firstName,
        lastName: this.customerForm.value.lastName,
        email: this.customerForm.value.email || '',
        phone: this.customerForm.value.phone || ''
      };
      
      console.log('Erstelle Kunden mit Daten:', customer);
      
      // Add metadata in a way that doesn't violate security rules
      const customerToSave = {
        ...customer,
        isManuallyCreated: true,
        createdAt: new Date(),
        // Store a reference to indicate this is a provider-created customer
        providerCreated: true,
        providerRef: this.provider.userId
      };
      
      this.customerService.createCustomer(customerToSave as any)
        .then(docRef => {
          this.loadingService.setLoading(false);
          
          // Add the customerId to the customer object
          const createdCustomer = {
            ...customer,
            customerId: docRef.id,
            isManuallyCreated: true,
            notes: this.customerForm.value.notes || ''
          };
          
          console.log('Kunde erfolgreich erstellt:', createdCustomer);
          
          // If notes provided, create a provider-customer relation with notes
          if (this.customerForm.value.notes) {
            this.providerCustomerService.updateCustomerNotes(
              this.provider.userId, // Use provider ID for the relation
              docRef.id, // Use the customer document ID
              this.customerForm.value.notes
            ).catch(error => {
              console.error('Error saving customer notes:', error);
            });
          }
          
          // Create provider-customer relation
          this.providerCustomerService.updateRelationAfterAppointment(
            this.provider.userId,
            docRef.id,
            new Date(),
            0
          ).catch(error => {
            console.error('Error creating provider-customer relation:', error);
          });
          
          // Emit event to parent component
          this.customerCreated.emit(createdCustomer as any);
          
          // Close the form
          this.close.emit();
        })
        .catch(error => {
          this.loadingService.setLoading(false);
          console.error('Error creating customer:', error);
          this.formErrors['general'] = 'Fehler beim Erstellen des Kunden: ' + error.message;
        });
    }
  }
  
  validateForm(): boolean {
    this.formErrors = {};
    let isValid = true;
    
    if (!this.customerForm.get('firstName')?.valid) {
      this.formErrors['firstName'] = 'Vorname ist erforderlich';
      isValid = false;
    }
    
    if (!this.customerForm.get('lastName')?.valid) {
      this.formErrors['lastName'] = 'Nachname ist erforderlich';
      isValid = false;
    }
    
    if (this.customerForm.get('email')?.value && !this.customerForm.get('email')?.valid) {
      this.formErrors['email'] = 'Bitte geben Sie eine gültige E-Mail-Adresse ein';
      isValid = false;
    }
    
    return isValid;
  }
  
  hasError(fieldName: string): boolean {
    return this.formErrors[fieldName] !== undefined;
  }
  
  getErrorMessage(fieldName: string): string {
    return this.formErrors[fieldName] || '';
  }
  
  onCancel(): void {
    this.close.emit();
  }
}