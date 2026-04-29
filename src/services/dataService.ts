import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Order, OrderStatus, Product } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const productService = {
  async getAll(): Promise<Product[]> {
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('API failed');
      const data = await response.json();
      return data.map((p: any) => ({
        ...p,
        price: parseFloat(p.price),
        imageUrl: p.image_url
      }));
    } catch (e) {
      console.warn('Backend products failed, falling back to Firebase or empty');
      const path = 'products';
      try {
        const snap = await getDocs(collection(db, path));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
        return [];
      }
    }
  },

  async create(product: Omit<Product, 'id'>): Promise<string> {
    const path = 'products';
    try {
      const docRef = await addDoc(collection(db, path), product);
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      return '';
    }
  },

  async update(id: string, product: Partial<Product>): Promise<void> {
    const path = `products/${id}`;
    try {
      await updateDoc(doc(db, 'products', id), product);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  async delete(id: string): Promise<void> {
    const path = `products/${id}`;
    try {
      // Soft delete logic if needed
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }
};

export const userService = {
  async syncUser(user: any) {
    try {
      await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        })
      });
    } catch (e) {
      console.error('User sync failed:', e);
    }
  },

  async getProfile(userId: string) {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) throw new Error('Profile fetch failed');
      return await response.json();
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  async updateProfile(userId: string, data: { displayName: string, phone: string, address: string }) {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Profile update failed');
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
};

export const orderService = {
  async placeOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...order,
          status: OrderStatus.PENDING
        })
      });
      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
    } catch (e) {
      console.error('Backend order failed, falling back to Firebase');
    }

    const path = 'orders';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...order,
        status: OrderStatus.PENDING,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      return '';
    }
  },

  async getMyOrders(): Promise<Order[]> {
    if (!auth.currentUser) return [];
    
    try {
      const response = await fetch(`/api/orders/my/${auth.currentUser.uid}`);
      if (response.ok) {
        const rows = await response.json();
        return rows.map((r: any) => ({
          ...r,
          totalAmount: parseFloat(r.total_amount),
          deliveryAddress: r.delivery_address,
          transactionId: r.transaction_id,
          createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at)
        }));
      }
    } catch (e) {
      console.warn('Backend orders fetch failed, falling back to Firebase');
    }

    const path = 'orders';
    try {
      const q = query(
        collection(db, path), 
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async getAllOrders(): Promise<Order[]> {
    const path = 'orders';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  },

  async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
    const path = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  }
};
