export interface ProviderCustomerRelation {
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
}