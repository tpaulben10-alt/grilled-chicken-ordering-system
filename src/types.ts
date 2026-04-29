export enum OrderStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  OUT_FOR_DELIVERY = 'out-for-delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id?: string;
  userId: string;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  status: OrderStatus;
  deliveryAddress: string;
  phone: string;
  paymentStatus?: 'pending' | 'success' | 'failed';
  transactionId?: string;
  createdAt: any;
  updatedAt: any;
}

export interface UserProfile {
  fullName?: string;
  email: string;
  phone?: string;
  address?: string;
  isAdmin?: boolean;
}
