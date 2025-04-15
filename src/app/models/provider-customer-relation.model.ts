export interface ProviderCustomerRelation {
  relationId: string;
  providerId: string;
  customerId: string;
  notes?: string;
  tags?: string[];
  firstVisit?: Date;
  lastVisit?: Date;
  visitCount?: number;
  totalSpent?: number;
  createdAt: Date;
  updatedAt: Date;
  // Add customer basic info to store in the relation
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  customerPhone?: string;
}