export interface Customer {
  customerId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Felder für Provider-Management
  providerRef?: string;      // Referenz zum Provider, der den Kunden erstellt hat
  notes?: string;            // Notizen zum Kunden
  createdBy?: string;        // Benutzer-ID, wer den Kunden angelegt hat
  createdAt?: Date;          // Wann der Kunde angelegt wurde
  updatedAt?: Date;          // Wann der Kunde zuletzt aktualisiert wurde
  updatedBy?: string;        // Wer den Kunden zuletzt aktualisiert hat
}