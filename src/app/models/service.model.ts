export interface Service {
    id: string;
    providerId: string;
    name: string;
    description?: string;
    price: number;
    duration: number;
    image: string;
    isEditing?: boolean;
  }