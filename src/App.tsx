import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  User, 
  MapPin, 
  Phone, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  Plus,
  Minus,
  X,
  Loader2,
  LogOut,
  Flame,
  CreditCard,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { Product, CartItem, Order, OrderStatus } from './types';
import { productService, orderService } from './services/dataService';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe((process.env as any).VITE_STRIPE_PUBLISHABLE_KEY);

// --- Components ---

const StatusStepper = ({ currentStatus }: { currentStatus: OrderStatus }) => {
  const steps = [
    { id: OrderStatus.PENDING, label: 'Placed', icon: ShoppingBag },
    { id: OrderStatus.PREPARING, label: 'Grilling', icon: Flame },
    { id: OrderStatus.OUT_FOR_DELIVERY, label: 'On Way', icon: Clock },
    { id: OrderStatus.DELIVERED, label: 'Served', icon: CheckCircle2 },
  ];

  if (currentStatus === OrderStatus.CANCELLED) {
    return (
      <div className="flex items-center gap-3 px-6 py-3 bg-red-50 text-red-600 rounded-2xl border border-red-100 justify-center">
        <X className="w-5 h-5 animate-pulse" />
        <span className="text-xs font-black uppercase tracking-widest">Order Terminated</span>
      </div>
    );
  }

  const currentIdx = steps.findIndex(s => s.id === currentStatus);

  return (
    <div className="flex items-center justify-between w-full max-w-md mx-auto pt-4">
      {steps.map((step, idx) => {
        const isCompleted = currentIdx >= idx;
        const isActive = step.id === currentStatus;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2 relative z-10">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                ${isCompleted ? 'bg-primary text-white shadow-md' : 'bg-stone-50 text-stone-200 border border-stone-100'}
              `}>
                <Icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors duration-300 ${isCompleted ? 'text-charcoal' : 'text-stone-300'}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className="flex-1 h-px bg-stone-100 mx-1 -mt-4">
                <motion.div 
                  initial={{ width: '0%' }}
                  animate={{ width: isCompleted && currentIdx > idx ? '100%' : '0%' }}
                  className="h-full bg-primary/20"
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const AdminDashboard = ({ orders, products, onRefresh }: { 
  orders: Order[], 
  products: Product[],
  onRefresh: () => void
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    await orderService.updateStatus(orderId, status);
    onRefresh();
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    
    if (editingProduct.id) {
      await productService.update(editingProduct.id, editingProduct);
    } else {
      await productService.create(editingProduct as Omit<Product, 'id'>);
    }
    setEditingProduct(null);
    onRefresh();
  };

  return (
    <div className="pt-32 pb-24 px-4 max-w-7xl mx-auto space-y-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-100 pb-8">
        <div className="space-y-1">
          <h1 className="text-4xl">Order Management</h1>
          <p className="text-stone-500 text-sm">Monitor and update all incoming orders.</p>
        </div>
        <div className="flex bg-stone-50 p-1 rounded-xl border border-stone-100">
           <button 
            onClick={() => setActiveTab('orders')}
            className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-charcoal shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
           >
            Orders ({orders.length})
           </button>
           <button 
            onClick={() => setActiveTab('menu')}
            className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'menu' ? 'bg-white text-charcoal shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
           >
            Edit Menu
           </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        <div className="grid gap-8">
          {orders.length === 0 ? (
            <div className="p-16 text-center border-2 border-dashed border-stone-100 rounded-3xl">
              <p className="text-stone-400">No active orders at the moment.</p>
            </div>
          ) : (
            orders.map(order => (
              <motion.div 
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-stone-100 rounded-3xl p-6 shadow-soft flex flex-col md:flex-row gap-8 transition-shadow hover:shadow-md"
              >
                <div className="flex-1 space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Order #{order.id?.slice(-6).toUpperCase()}</span>
                    <div className="flex items-center gap-2 text-stone-500 font-medium text-sm">
                       <MapPin className="w-4 h-4 text-stone-300" />
                       <span className="truncate max-w-[200px]">{order.deliveryAddress}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">{item.quantity}x</span>
                            <span className="text-charcoal font-medium">{item.name}</span>
                        </div>
                        <span className="text-stone-400">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex justify-between items-center bg-surface p-4 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-stone-400" />
                        <span className="text-sm font-medium">{order.phone}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-stone-400 uppercase font-bold mr-2">Total</span>
                        <span className="text-2xl font-bold">${order.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <StatusStepper currentStatus={order.status} />
                </div>

                <div className="md:w-64 border-l border-stone-100 md:pl-8 space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Update Status</label>
                    <select 
                      value={order.status}
                      onChange={(e) => handleUpdateOrderStatus(order.id!, e.target.value as OrderStatus)}
                      className="w-full mt-1 bg-surface border border-stone-200 p-3 rounded-xl font-medium text-sm focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer"
                    >
                      {Object.values(OrderStatus).map(status => (
                        <option key={status} value={status}>{status.replace(/-/g, ' ').toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  {order.status === OrderStatus.PENDING && (
                    <button 
                      onClick={() => handleUpdateOrderStatus(order.id!, OrderStatus.CANCELLED)}
                      className="w-full py-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100"
                    >
                      <X className="w-4 h-4" /> Cancel Order
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-between items-center bg-stone-50 p-6 rounded-2xl">
             <div className="space-y-1">
                <h2 className="text-2xl">Menu Items</h2>
                <p className="text-stone-400 text-xs">Manage your restaurant offerings.</p>
             </div>
             <button 
              onClick={() => setEditingProduct({ name: '', price: 0, category: 'Mains', isAvailable: true })}
              className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95"
             >
                <Plus className="w-4 h-4" /> Add Item
             </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
             {products.map(p => (
               <div key={p.id} className="bg-white border border-stone-100 p-4 rounded-xl flex items-center justify-between transition-shadow hover:shadow-soft">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 bg-surface rounded-lg overflow-hidden flex-shrink-0">
                        {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
                     </div>
                     <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-primary uppercase">{p.category}</span>
                        <h4 className="font-bold text-base truncate">{p.name}</h4>
                        <p className="text-stone-400 font-bold">${p.price.toFixed(2)}</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => setEditingProduct(p)}
                    className="w-10 h-10 flex items-center justify-center bg-stone-50 text-stone-400 hover:bg-primary hover:text-white rounded-full transition-all flex-shrink-0"
                  >
                     <ChevronRight className="w-5 h-5" />
                  </button>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* Product Edit Modal */}
      <AnimatePresence>
        {editingProduct && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingProduct(null)} className="fixed inset-0 bg-charcoal/60 backdrop-blur-md z-[110]" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white rounded-[3rem] p-12 shadow-2xl z-[120] overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none -mr-20 -mt-20">
                 <Flame className="w-64 h-64" />
              </div>
              
              <h3 className="text-3xl font-bold mb-6">{editingProduct.id ? 'Edit Product' : 'Add Product'}</h3>
              <form onSubmit={handleSaveProduct} className="space-y-4 relative z-10">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Product Name</label>
                    <input 
                    placeholder="e.g. Grilled Chicken Wings"
                    className="w-full bg-stone-50 p-4 rounded-xl border border-stone-100 outline-none font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                    value={editingProduct.name}
                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                    required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Price ($)</label>
                    <input 
                        type="number" step="0.01"
                        placeholder="0.00"
                        className="w-full bg-stone-50 p-4 rounded-xl border border-stone-100 outline-none font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                        value={editingProduct.price || ''}
                        onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                        required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Category</label>
                    <select 
                        className="w-full bg-stone-50 p-4 rounded-xl border border-stone-100 outline-none font-bold text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                        value={editingProduct.category}
                        onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                    >
                        <option>Mains</option>
                        <option>Sides</option>
                        <option>Drinks</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Description</label>
                    <textarea 
                    placeholder="Describe this delicious item..."
                    className="w-full bg-stone-50 p-4 rounded-xl border border-stone-100 outline-none font-medium min-h-[100px] focus:ring-2 focus:ring-primary/20 transition-all"
                    value={editingProduct.description || ''}
                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Image URL</label>
                    <input 
                    placeholder="https://..."
                    className="w-full bg-stone-50 p-4 rounded-xl border border-stone-100 outline-none text-xs"
                    value={editingProduct.imageUrl || ''}
                    onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})}
                    />
                </div>

                <div className="flex items-center gap-3 py-3 px-4 bg-stone-50 rounded-xl">
                   <input 
                    type="checkbox" 
                    id="isAvailable"
                    className="w-5 h-5 rounded-md border-stone-300 text-primary focus:ring-primary"
                    checked={editingProduct.isAvailable} 
                    onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})}
                   />
                   <label htmlFor="isAvailable" className="font-bold text-sm text-stone-600 cursor-pointer">Available for Order</label>
                </div>
                
                <div className="flex gap-4 pt-4">
                   <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-4 font-bold text-stone-400 hover:text-stone-600 transition-colors">Cancel</button>
                   <button type="submit" className="flex-[2] bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const Navbar = ({ cartCount, onOpenCart, user, isAdmin, onToggleAdmin, isAdminView }: { 
  cartCount: number, 
  onOpenCart: () => void, 
  user: any,
  isAdmin: boolean,
  onToggleAdmin: () => void,
  isAdminView: boolean
}) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer">
            <Flame className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">Grilled & Co.</span>
          </div>
          {isAdmin && (
            <button 
              onClick={onToggleAdmin}
              className={`ml-4 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${isAdminView ? 'bg-primary text-white border-primary' : 'text-stone-400 border-stone-200 hover:border-primary hover:text-primary'}`}
            >
              Admin Mode
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-6">
          {!isAdminView && (
            <button 
              onClick={onOpenCart}
              className="relative p-2 hover:bg-stone-50 rounded-full transition-colors"
            >
              <ShoppingBag className="w-5 h-5 text-stone-600" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-primary text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
          )}
          
          <div className="w-px h-6 bg-stone-200" />
          
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 p-1 bg-stone-50 rounded-full border border-stone-100">
                <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
                <span className="text-[10px] font-bold text-stone-600 hidden sm:inline mr-2">{user.displayName?.split(' ')[0]}</span>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="p-2 hover:text-red-500 text-stone-400 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
              className="bg-primary text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-primary-dark transition-all"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const CartDrawer = ({ 
  isOpen, 
  onClose, 
  cart, 
  updateQuantity, 
  onCheckout,
  checkoutStatus
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  cart: CartItem[], 
  updateQuantity: (id: string, delta: number) => void, 
  onCheckout: (details: { address: string, phone: string }) => void,
  checkoutStatus: 'idle' | 'processing' | 'payment-step' | 'success'
}) => {
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} 
            className="fixed inset-0 bg-charcoal/60 backdrop-blur-md z-[90]" 
          />
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[100] shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="space-y-1">
                 <h2 className="text-2xl font-bold">Your Cart</h2>
                 <p className="text-xs text-stone-400 font-medium">{cart.length} items</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-stone-50 rounded-full transition-colors text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-stone-200" />
                  </div>
                  <p className="text-stone-400">Your cart is empty.</p>
                  <button 
                  onClick={onClose}
                  className="text-xs font-bold text-primary"
                  >
                    Browse the Menu
                  </button>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-20 h-20 bg-stone-50 rounded-xl overflow-hidden flex-shrink-0">
                      {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                       <h4 className="font-bold text-base truncate">{item.name}</h4>
                       <p className="text-stone-400 text-xs">${item.price.toFixed(2)} each</p>
                       <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center bg-stone-50 rounded-lg p-1">
                            <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded transition-all text-stone-400"><Minus className="w-3 h-3" /></button>
                            <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded transition-all text-stone-400"><Plus className="w-3 h-3" /></button>
                          </div>
                          <span className="text-sm font-bold ml-auto">${(item.price * item.quantity).toFixed(2)}</span>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 bg-stone-50 border-t border-stone-100 space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                     <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Delivery Address</label>
                     <input 
                      placeholder="Street, City, Postcode"
                      className="w-full bg-white p-3 rounded-xl border border-stone-100 outline-none text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                     <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Phone Number</label>
                     <input 
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-white p-3 rounded-xl border border-stone-100 outline-none text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-between items-center border-t border-stone-200/50">
                  <div>
                    <p className="text-xs text-stone-400 font-bold uppercase">Total</p>
                    <p className="text-3xl font-bold text-charcoal">${total.toFixed(2)}</p>
                  </div>
                  <button 
                    disabled={!address || !phone || checkoutStatus !== 'idle'}
                    onClick={() => onCheckout({ address, phone })}
                    className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-sm disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center gap-2 transition-all active:scale-95"
                  >
                    {checkoutStatus === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    {checkoutStatus === 'processing' ? 'Processing...' : 'Checkout'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const PaymentForm = ({ cart, onOrderSuccess, onClose }: { 
  cart: CartItem[], 
  onOrderSuccess: (orderId: string) => void,
  onClose: () => void 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    try {
      // 1. Create Payment Intent on our server
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total }),
      });

      const { clientSecret, error: backendError } = await response.json();

      if (backendError) {
        setError(backendError);
        setProcessing(false);
        return;
      }

      // 2. Confirm payment with Stripe
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement) as any,
        },
      });

      if (result.error) {
        setError(result.error.message || 'Payment failed');
        setProcessing(false);
      } else {
        if (result.paymentIntent.status === 'succeeded') {
          onOrderSuccess(result.paymentIntent.id);
        }
      }
    } catch (e: any) {
      setError('An unexpected error occurred.');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
        <CardElement options={{
          style: {
            base: {
              fontSize: '16px',
              color: '#1c1917',
              '::placeholder': { color: '#78716c' },
            },
          },
        }} />
      </div>
      
      {error && (
        <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button 
          type="button"
          onClick={onClose}
          className="flex-1 px-6 py-3 border border-stone-200 rounded-xl font-bold text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={!stripe || processing}
          className="flex-[2] bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-dark transition-all disabled:opacity-50"
        >
          {processing ? 'Processing...' : `Pay $${total.toFixed(2)}`}
        </button>
      </div>
    </form>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [checkoutDetails, setCheckoutDetails] = useState<{ address: string, phone: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'processing' | 'payment-step' | 'success'>('idle');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profileRef = doc(db, `users/${u.uid}/profile/private`);
        const profileSnap = await getDoc(profileRef);
        const isTester = u.email === 'tpaulbenedictsandy@gmail.com';
        
        if (!profileSnap.exists()) {
          await setDoc(profileRef, {
            email: u.email,
            fullName: u.displayName,
            isAdmin: isTester
          });
          setIsAdmin(isTester);
        } else {
          const data = profileSnap.data();
          setIsAdmin(!!data?.isAdmin || isTester);
        }
        fetchBasicData();
      } else {
        setIsAdmin(false);
        setIsAdminView(false);
      }
    });

    fetchProducts();
    return () => unsub();
  }, [isAdmin, user?.email]);

  const fetchBasicData = async () => {
    fetchOrders();
    if (isAdmin || user?.email === 'tpaulbenedictsandy@gmail.com') {
      const data = await orderService.getAllOrders();
      setAllOrders(data);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await productService.getAll();
      setProducts(data);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    const data = await orderService.getMyOrders();
    setMyOrders(data);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleCheckout = async (details: { address: string, phone: string }) => {
    if (!user) {
      signInWithPopup(auth, new GoogleAuthProvider());
      return;
    }
    setCheckoutDetails(details);
    setCheckoutStatus('payment-step');
    setIsCartOpen(false);
  };

  const finalizeOrder = async (paymentId: string) => {
    setCheckoutStatus('processing');
    try {
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const order: Omit<Order, 'id'> = {
        userId: user.uid,
        items: cart.map(i => ({ productId: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        totalAmount: total,
        deliveryAddress: checkoutDetails?.address || "Pick Up",
        phone: checkoutDetails?.phone || "No Phone",
        status: OrderStatus.PENDING,
        paymentStatus: 'success',
        transactionId: paymentId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await orderService.placeOrder(order);
      setCheckoutStatus('success');
      setCart([]);
      fetchBasicData();
      setCheckoutDetails(null);
      setTimeout(() => setCheckoutStatus('idle'), 5000);
    } catch (e) {
      console.error(e);
      setCheckoutStatus('idle');
    }
  };

  const categories = Array.from(new Set(products.map(p => p.category)));

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-stone-50">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar 
        user={user} 
        cartCount={cart.reduce((s, i) => s + i.quantity, 0)} 
        onOpenCart={() => setIsCartOpen(true)} 
        isAdmin={isAdmin}
        isAdminView={isAdminView}
        onToggleAdmin={() => setIsAdminView(!isAdminView)}
      />
      
      {isAdminView ? (
        <AdminDashboard 
          orders={allOrders} 
          products={products} 
          onRefresh={() => {
            fetchProducts();
            fetchBasicData();
          }} 
        />
      ) : (
        <>
          {/* Hero Section */}
      <section className="pt-40 pb-24 px-4 bg-charcoal text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:col-span-7 space-y-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 text-primary rounded-full">
              <span className="text-[11px] font-bold uppercase tracking-wider">The Best Charcoal Grill in Town</span>
            </div>
            
            <h1 className="text-5xl sm:text-7xl font-bold leading-tight">
              Authentic <br />
              <span className="text-primary tracking-tight">Fire-Grilled.</span>
            </h1>
            
            <p className="text-xl text-stone-500 max-w-lg leading-relaxed">
              We believe in the purity of fire. Small batches, fresh ingredients, and the intense heat of real oak charcoal.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4">
              <button 
                onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-primary-dark transition-all active:scale-95 shadow-lg shadow-primary/20"
              >
                Explore Menu
              </button>
              <div className="flex items-center gap-3 px-6 py-4 border border-stone-100 rounded-xl bg-white shadow-soft">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider">Fast Delivery</span>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="lg:col-span-5 relative"
          >
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-[120px] -z-10 animate-pulse" />
            <div className="relative p-4 border border-white/10 rounded-[3rem] glass">
              <img 
                src="https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?q=80&w=2070&auto=format&fit=crop" 
                alt="Grilled Chicken" 
                className="w-full aspect-[4/5] object-cover rounded-[2.5rem] shadow-2xl transition-all duration-700"
              />
              <div className="absolute -bottom-6 -right-6 bg-primary text-white p-6 rounded-3xl shadow-2xl rotate-12">
                 <Flame className="w-8 h-8" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Story / Heritage Section */}
      <section className="py-24 bg-surface border-y border-stone-100">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-16 items-center">
            <h2 className="text-4xl text-charcoal">
              A Heritage of <br />
              <span className="text-primary">Authentic Flavor.</span>
            </h2>
            <p className="text-stone-500 text-lg leading-relaxed">
              Born from a roadside stall in 1982, our recipe remains true to its roots. We use local ingredients, a signature blend of herbs and spices, and our traditional charcoal grilling method. No shortcuts, just honest food.
            </p>
        </div>
      </section>

      {/* Menu Section */}
      <section id="menu" className="py-24 px-4 bg-white relative">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col items-center text-center space-y-2">
            <span className="text-primary font-bold uppercase tracking-wider text-xs">Our Menu</span>
            <h2 className="text-4xl">Fresh Daily Selection</h2>
          </div>

          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-3">
              <div className="sticky top-24 space-y-4">
                <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider">Categories</h3>
                <div className="flex flex-wrap lg:flex-col gap-2">
                  {['All', ...categories].map(cat => (
                    <button 
                      key={cat}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-stone-50 hover:text-primary text-left"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-9">
              {products.length === 0 ? (
                <div className="p-24 bg-surface rounded-3xl text-center">
                  <p className="text-stone-400">Loading our fresh menu...</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-8">
                  {products.map((product, idx) => (
                    <motion.div 
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05 }}
                      className="group border border-stone-100 rounded-2xl overflow-hidden shadow-soft hover:shadow-md transition-shadow"
                    >
                       <div className="aspect-[16/10] bg-surface relative">
                        {product.imageUrl && (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover" 
                          />
                        )}
                        <button 
                          onClick={() => addToCart(product)}
                          className="absolute bottom-4 right-4 bg-primary text-white p-3 rounded-xl shadow-lg hover:bg-primary-dark transition-all transform hover:scale-110 active:scale-95"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="p-6 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{product.category}</span>
                          <span className="font-bold text-lg text-charcoal">${product.price.toFixed(2)}</span>
                        </div>
                        <h3 className="text-xl font-bold text-charcoal">{product.name}</h3>
                        <p className="text-stone-500 text-sm line-clamp-2">{product.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials / Quality Footer */}
      <section className="py-24 px-4 bg-surface border-t border-stone-100">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h3 className="text-4xl text-charcoal">Quality Commitment</h3>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <CheckCircle2 className="w-6 h-6 text-primary mt-1" />
                  <div>
                    <h4 className="font-bold text-lg">Natural Process</h4>
                    <p className="text-stone-500">24-hour slow marination for deep flavor.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <Flame className="w-6 h-6 text-primary mt-1" />
                  <div>
                    <h4 className="font-bold text-lg">Wood Embers</h4>
                    <p className="text-stone-500">Traditional charcoal grilling for authentic smokiness.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-stone-100 p-8 rounded-3xl shadow-soft grid gap-6">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                 </div>
                 <div>
                    <h5 className="font-bold">Location</h5>
                    <p className="text-stone-500 text-sm">Arts District, Studio 44</p>
                 </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center">
                    <Phone className="w-6 h-6 text-primary" />
                 </div>
                 <div>
                    <h5 className="font-bold">Contact</h5>
                    <p className="text-stone-500 text-sm">+1 (800) GRILL-CO</p>
                 </div>
              </div>
            </div>
        </div>
      </section>

      {/* My Orders Section */}
      {user && myOrders.length > 0 && (
        <section className="py-24 px-4 bg-surface border-t border-stone-100">
           <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-3xl">Your Orders</h2>
              
              <div className="space-y-4">
                 {myOrders.map((order, idx) => (
                    <motion.div 
                      key={order.id} 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      className="p-6 bg-white rounded-2xl border border-stone-100 shadow-soft"
                    >
                       <div className="flex items-center justify-between mb-4">
                          <div>
                             <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">#{order.id?.slice(-6).toUpperCase()}</p>
                             <p className="text-lg font-bold">
                                {order.items.length} item{order.items.length > 1 ? 's' : ''} • <span className="text-primary">${order.totalAmount.toFixed(2)}</span>
                             </p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${order.status === 'delivered' ? 'bg-green-50 text-green-600' : 'bg-primary/5 text-primary'}`}>
                             {order.status.replace(/-/g, ' ')}
                          </div>
                       </div>
                       
                       <StatusStepper currentStatus={order.status} />
                    </motion.div>
                 ))}
              </div>
           </div>
        </section>
      )}

        </>
      )}

      {/* Overlays */}
      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cart={cart} 
        updateQuantity={updateQuantity}
        onCheckout={handleCheckout}
        checkoutStatus={checkoutStatus}
      />

      <AnimatePresence>
        {checkoutStatus === 'payment-step' && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCheckoutStatus('idle')}
              className="fixed inset-0 bg-charcoal/60 z-[110] backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white p-12 rounded-[3.5rem] z-[120] shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none -mr-20 -mt-20">
                 <Flame className="w-64 h-64" />
              </div>

              <div className="flex justify-between items-center mb-6 relative z-10">
                 <h3 className="text-2xl font-bold">Complete Your Order</h3>
                <button onClick={() => setCheckoutStatus('idle')} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>
              
              <div className="relative z-10">
                <Elements stripe={stripePromise}>
                  <PaymentForm 
                    cart={cart} 
                    onOrderSuccess={finalizeOrder} 
                    onClose={() => setCheckoutStatus('idle')} 
                  />
                </Elements>
              </div>

              <div className="mt-12 flex items-center justify-center gap-3 text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em] relative z-10">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                PCI-DSS Bank Grade Encryption
              </div>
            </motion.div>
          </>
        )}

        {checkoutStatus === 'processing' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/90 z-[100] flex flex-col items-center justify-center gap-6"
          >
            <div className="w-24 h-24 bg-primary/10 rounded-full p-4">
              <Loader2 className="w-full h-full text-primary animate-spin" />
            </div>
            <p className="text-xl font-display font-bold">Firing up the grill...</p>
          </motion.div>
        )}
        
        {checkoutStatus === 'success' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-96 bg-charcoal text-white p-12 rounded-[3rem] z-[100] shadow-2xl flex flex-col items-center text-center gap-6"
          >
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-3xl font-display font-bold">Order Received!</h3>
            <p className="text-stone-400">Your chicken is hitting the grill as we speak. Get ready for perfection.</p>
            <button 
              onClick={() => setCheckoutStatus('idle')}
              className="bg-white text-charcoal px-8 py-3 rounded-full font-bold"
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-12 px-4 bg-surface border-t border-stone-100 text-center">
        <p className="text-stone-400 text-sm font-medium">© 2026 Grilled & Co. Fresh from the flame.</p>
      </footer>
    </div>
  );
}
