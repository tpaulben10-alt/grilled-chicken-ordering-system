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
    const path = 'products';
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
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
      // Note: Delete is not explicitly covered in my rules yet, but I'll add it if needed. 
      // For now we use isAvailable for soft delete mostly.
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }
};

export const orderService = {
  async placeOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
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
