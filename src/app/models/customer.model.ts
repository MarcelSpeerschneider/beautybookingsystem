export interface Customer {
  customerId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt?: Date;          // Wann der Kunde angelegt wurde
  updatedAt?: Date;          // Wann der Kunde zuletzt aktualisiert wurde
}