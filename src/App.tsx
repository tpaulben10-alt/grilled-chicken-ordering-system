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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-stone-200 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-stone-400">Control Plane</span>
          </div>
          <h1 className="text-6xl font-serif italic">The Kitchen Desk</h1>
          <p className="text-stone-500 max-w-md font-medium tracking-tight">Real-time oversight of the fire and the flow.</p>
        </div>
        <div className="flex bg-stone-100 p-1.5 rounded-2xl border border-stone-200">
           <button 
            onClick={() => setActiveTab('orders')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'bg-white text-charcoal shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
           >
            Orders ({orders.length})
           </button>
           <button 
            onClick={() => setActiveTab('menu')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'menu' ? 'bg-white text-charcoal shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
           >
            Menu Studio
           </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        <div className="grid gap-8">
          {orders.length === 0 ? (
            <div className="p-24 text-center glass rounded-[3rem] border border-stone-200">
              <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="w-8 h-8 text-stone-200" />
              </div>
              <p className="font-serif italic text-xl text-stone-400">The quiet before the rush...</p>
            </div>
          ) : (
            orders.map(order => (
              <motion.div 
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-stone-100 rounded-[2.5rem] p-8 shadow-sm flex flex-col md:flex-row gap-12 group hover:shadow-xl transition-all duration-500"
              >
                <div className="flex-1 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="px-3 py-1 bg-stone-100 text-stone-500 rounded-lg text-[10px] font-black tracking-widest uppercase">#{order.id?.slice(-6).toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-primary font-bold text-sm">
                       <MapPin className="w-4 h-4" />
                       <span className="truncate max-w-[200px]">{order.deliveryAddress}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm border-b border-stone-50 pb-2">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-cream rounded flex items-center justify-center font-bold text-[10px] text-primary">{item.quantity}</span>
                            <span className="text-charcoal font-bold font-serif italic text-xl">{item.name}</span>
                        </div>
                        <span className="font-display font-medium text-stone-400">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex justify-between items-end">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-1">Customer Info</p>
                        <div className="flex items-center gap-2 text-charcoal font-bold">
                            <Phone className="w-4 h-4 text-primary" />
                            <span>{order.phone}</span>
                        </div>
                    </div>
                    <div className="flex-1 px-8 border-x border-stone-100 mx-8">
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-1">Payment Intel</p>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <CreditCard className={`w-3 h-3 ${order.paymentStatus === 'success' ? 'text-green-500' : 'text-stone-300'}`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${order.paymentStatus === 'success' ? 'text-green-600' : 'text-stone-400'}`}>
                                    {order.paymentStatus || 'unknown'}
                                </span>
                            </div>
                            <span className="text-[9px] font-mono text-stone-400 break-all opacity-50">TX: {order.transactionId || '---'}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-300 mb-1">Grand Total</p>
                        <p className="text-3xl font-display font-black text-charcoal">${order.totalAmount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="md:w-72 bg-stone-50/50 rounded-3xl p-6 border border-stone-100 space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">Order Execution</label>
                  <select 
                    value={order.status}
                    onChange={(e) => handleUpdateOrderStatus(order.id!, e.target.value as OrderStatus)}
                    className="w-full bg-white border border-stone-200 p-4 rounded-2xl font-bold text-sm focus:ring-2 focus:ring-primary outline-none transition-all cursor-pointer shadow-sm"
                  >
                    {Object.values(OrderStatus).map(status => (
                      <option key={status} value={status}>{status.replace(/-/g, ' ').toUpperCase()}</option>
                    ))}
                  </select>
                  <div className={`p-4 rounded-2xl flex items-center justify-center gap-2 transition-colors ${order.status === 'delivered' ? 'bg-green-50 text-green-600' : 'bg-primary/5 text-primary'}`}>
                    <div className={`w-2 h-2 rounded-full ${order.status === 'delivered' ? 'bg-green-600' : 'bg-primary animate-pulse'}`} />
                    <span className="text-xs font-black uppercase tracking-widest">{order.status.replace(/-/g, ' ')}</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-12">
          <div className="flex justify-between items-end">
             <div className="space-y-1">
                <h2 className="text-4xl font-serif italic">Menu Manifest</h2>
                <p className="text-stone-400 text-xs font-black uppercase tracking-[0.2em]">Configuring the offer</p>
             </div>
             <button 
              onClick={() => setEditingProduct({ name: '', price: 0, category: 'Mains', isAvailable: true })}
              className="bg-charcoal text-white px-8 py-4 rounded-full font-black uppercase tracking-widest text-[10px] flex items-center gap-3 shadow-xl hover:bg-stone-800 transition-all active:scale-95"
             >
                <Plus className="w-4 h-4 text-primary" /> New Entry
             </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
             {products.map(p => (
               <div key={p.id} className="bg-white border border-stone-100 p-8 rounded-[3rem] flex items-center justify-between group hover:shadow-xl transition-all duration-500">
                  <div className="flex items-center gap-6">
                     <div className="w-20 h-20 bg-cream rounded-2xl overflow-hidden border border-stone-100">
                        {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />}
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{p.category}</span>
                        <h4 className="font-serif font-bold text-2xl italic leading-none mb-2">{p.name}</h4>
                        <p className="font-display text-lg text-stone-400 tracking-tighter">${p.price.toFixed(2)}</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => setEditingProduct(p)}
                    className="w-12 h-12 flex items-center justify-center bg-stone-50 text-stone-300 hover:bg-primary/10 hover:text-primary rounded-full transition-all"
                  >
                     <ChevronRight className="w-6 h-6" />
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
              
              <h3 className="text-4xl font-serif italic mb-8">{editingProduct.id ? 'Refine Entry' : 'New Creation'}</h3>
              <form onSubmit={handleSaveProduct} className="space-y-6 relative z-10">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Product Identity</label>
                    <input 
                    placeholder="Product Name"
                    className="w-full bg-stone-50 p-5 rounded-2xl border-none outline-none font-serif italic text-xl focus:ring-2 focus:ring-primary/20 transition-all"
                    value={editingProduct.name}
                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                    required
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Valuation ($)</label>
                    <input 
                        type="number" step="0.01"
                        placeholder="0.00"
                        className="w-full bg-stone-50 p-5 rounded-2xl border-none outline-none font-display font-bold text-center focus:ring-2 focus:ring-primary/20 transition-all"
                        value={editingProduct.price || ''}
                        onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                        required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Manifest Category</label>
                    <select 
                        className="w-full bg-stone-50 p-5 rounded-2xl border-none outline-none font-bold text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                        value={editingProduct.category}
                        onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                    >
                        <option>Mains</option>
                        <option>Sides</option>
                        <option>Drinks</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Artisanal Description</label>
                    <textarea 
                    placeholder="Describe the flavor profile..."
                    className="w-full bg-stone-50 p-5 rounded-2xl border-none outline-none font-medium min-h-[120px] focus:ring-2 focus:ring-primary/20 transition-all leading-relaxed"
                    value={editingProduct.description || ''}
                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Visual Asset URL</label>
                    <input 
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-stone-50 p-5 rounded-2xl border-none outline-none font-mono text-[10px]"
                    value={editingProduct.imageUrl || ''}
                    onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})}
                    />
                </div>

                <div className="flex items-center gap-4 py-2 px-4 bg-cream rounded-2xl">
                   <input 
                    type="checkbox" 
                    id="isAvailable"
                    className="w-5 h-5 rounded-md border-stone-300 text-primary focus:ring-primary"
                    checked={editingProduct.isAvailable} 
                    onChange={e => setEditingProduct({...editingProduct, isAvailable: e.target.checked})}
                   />
                   <label htmlFor="isAvailable" className="font-bold text-xs uppercase tracking-widest text-stone-600 cursor-pointer">Currently Serving</label>
                </div>
                
                <div className="flex gap-6 pt-4">
                   <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-5 font-black uppercase tracking-widest text-[10px] text-stone-400 hover:text-stone-600">Withdraw</button>
                   <button type="submit" className="flex-[2] bg-charcoal text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-charcoal/20 hover:bg-stone-800 transition-all active:scale-95">Commit Entry</button>
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
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-12 h-12 bg-charcoal rounded-full flex items-center justify-center text-white transition-transform group-hover:rotate-12">
              <Flame className="w-7 h-7 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-display font-black tracking-tight leading-none">GRILLED</span>
              <span className="text-[10px] font-bold text-primary tracking-[0.2em] leading-none">& CO.</span>
            </div>
          </div>
          {isAdmin && (
            <button 
              onClick={onToggleAdmin}
              className={`ml-4 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${isAdminView ? 'bg-primary text-white border-primary' : 'text-stone-400 border-stone-200 hover:border-primary hover:text-primary'}`}
            >
              System Admin
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-6">
          {!isAdminView && (
            <button 
              onClick={onOpenCart}
              className="group relative p-2 hover:bg-charcoal/5 rounded-full transition-colors"
            >
              <ShoppingBag className="w-6 h-6 text-charcoal transition-transform group-hover:-translate-y-0.5" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-primary text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white ring-1 ring-primary/20">
                  {cartCount}
                </span>
              )}
            </button>
          )}
          
          <div className="w-px h-6 bg-stone-200" />
          
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 p-1.5 pr-4 bg-white rounded-full border border-stone-200 shadow-sm transition-shadow hover:shadow-md">
                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-stone-100" />
                <span className="text-xs font-bold text-stone-600 hidden sm:inline tracking-tighter">{user.displayName?.split(' ')[0]}</span>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="p-2.5 hover:bg-red-50 hover:text-red-500 text-stone-400 rounded-full transition-all group"
                title="Log Out"
              >
                <LogOut className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
              className="bg-charcoal text-white px-7 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-stone-800 transition-all active:scale-95 shadow-lg shadow-charcoal/20"
            >
              Connect
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
            <div className="p-8 border-b border-stone-100 flex items-center justify-between">
              <div className="space-y-1">
                 <h2 className="text-3xl font-serif italic">Your Selection</h2>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">{cart.length} Articles</p>
              </div>
              <button onClick={onClose} className="p-3 hover:bg-stone-50 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-20 h-20 bg-cream rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-10 h-10 text-stone-200" />
                  </div>
                  <p className="font-serif italic text-xl text-stone-400">The selection is currently empty.</p>
                  <button 
                  onClick={onClose}
                  className="text-[10px] font-black uppercase tracking-widest text-primary border-b border-primary/20 pb-1"
                  >
                    Browse the Menu
                  </button>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-6 group">
                    <div className="w-24 h-24 bg-cream rounded-2xl overflow-hidden border border-stone-50">
                      {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 space-y-2">
                       <div className="flex justify-between items-start">
                          <h4 className="font-serif font-bold text-lg italic leading-tight">{item.name}</h4>
                       </div>
                       <p className="text-stone-400 font-display font-medium text-xs tracking-tighter">${item.price.toFixed(2)} each</p>
                       <div className="flex items-center gap-4 pt-2">
                          <div className="flex items-center bg-stone-50 rounded-full border border-stone-100 p-1">
                            <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-full transition-all text-stone-400"><Minus className="w-3 h-3" /></button>
                            <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-full transition-all text-stone-400"><Plus className="w-3 h-3" /></button>
                          </div>
                          <span className="text-sm font-display font-bold ml-auto">${(item.price * item.quantity).toFixed(2)}</span>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-8 bg-cream border-t border-stone-100 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Dispatch Address</label>
                     <input 
                      placeholder="Street, City, Postcode"
                      className="w-full bg-white p-4 rounded-2xl border border-stone-200 outline-none font-medium text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-4">Contact Phone</label>
                     <input 
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-white p-4 rounded-2xl border border-stone-200 outline-none font-medium text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-200/50 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Total Amount</p>
                    <p className="text-4xl font-display font-black text-charcoal tracking-tighter">${total.toFixed(2)}</p>
                  </div>
                  <button 
                    disabled={!address || !phone || checkoutStatus !== 'idle'}
                    onClick={() => onCheckout({ address, phone })}
                    className="relative overflow-hidden bg-charcoal text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs disabled:opacity-30 shadow-2xl shadow-charcoal/30 flex items-center gap-3 transition-all active:scale-95"
                  >
                    {checkoutStatus === 'processing' ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <CreditCard className="w-4 h-4 text-primary" />}
                    {checkoutStatus === 'processing' ? 'Encrypting...' : 'Initiate Checkout'}
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
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Mastering the Ember</span>
            </div>
            
            <h1 className="text-7xl sm:text-9xl font-serif font-light leading-[0.85] tracking-tighter italic">
              Simple <br />
              <span className="text-primary not-italic font-black -ml-2">Alchemy.</span>
            </h1>
            
            <p className="text-xl text-stone-400 max-w-lg leading-relaxed font-serif italic">
              "We believe in the purity of fire. 24-hour slow marination, meets the intense, unyielding heat of real oak charcoal."
            </p>
            
            <div className="flex flex-wrap gap-6 pt-6">
              <button 
                onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-primary text-white px-10 py-5 rounded-full font-black uppercase tracking-widest text-xs hover:bg-primary-dark transition-all active:scale-95 shadow-2xl shadow-primary/40"
              >
                Reserve Your Batch
              </button>
              <div className="flex items-center gap-4 px-8 py-5 border border-white/10 rounded-full glass">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest">25m avg.</span>
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
                className="w-full aspect-[4/5] object-cover rounded-[2.5rem] shadow-2xl grayscale hover:grayscale-0 transition-all duration-700"
              />
              <div className="absolute -bottom-6 -right-6 bg-primary text-white p-6 rounded-3xl shadow-2xl rotate-12">
                 <Flame className="w-8 h-8" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Story / Heritage Section */}
      <section className="py-32 bg-cream overflow-hidden border-y border-stone-200/50">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-24 items-center">
           <div className="relative">
              <div className="text-[20vw] font-serif font-black text-stone-200/40 absolute -top-20 -left-10 select-none">01</div>
              <h2 className="text-5xl font-serif font-light italic relative z-10">
                The Heritage <br />
                <span className="text-gold font-bold not-italic">of the Hunt.</span>
              </h2>
           </div>
           <p className="text-stone-500 text-lg leading-relaxed first-letter:text-5xl first-letter:font-serif first-letter:mr-3 first-letter:float-left first-letter:text-charcoal first-letter:font-black">
              Born from a roadside stall in 1982, our recipe hasn't changed. We still use the same heavy-gauge steel grills, the same blend of 14 spices, and the same unhurried approach to perfection. In a world of fast food, we choose to remain slow, deliberate, and fiercely authentic.
           </p>
        </div>
      </section>

      {/* Menu Section */}
      <section id="menu" className="py-32 px-4 bg-white relative">
        <div className="max-w-7xl mx-auto space-y-24">
          <div className="flex flex-col items-center text-center space-y-6">
            <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px]">The Curated Menu</span>
            <h2 className="text-6xl font-serif italic">The Daily Selection</h2>
            <div className="w-20 h-1 bg-primary rounded-full mx-auto" />
          </div>

          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-3 space-y-8">
              <div className="sticky top-32 space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Categories</h3>
                <div className="flex flex-col gap-2">
                  {['All', ...categories].map(cat => (
                    <button 
                      key={cat}
                      className="group flex items-center justify-between py-3 border-b border-stone-100 text-sm font-bold transition-all hover:text-primary hover:px-2"
                    >
                      {cat}
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-9">
              {products.length === 0 ? (
                <div className="p-32 bg-stone-50 rounded-[3rem] border border-stone-200/50 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-8">
                     <Loader2 className="w-10 h-10 text-stone-300 animate-spin" />
                  </div>
                  <p className="font-serif italic text-xl text-stone-400">The first batch is hitting the coals now...</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-x-12 gap-y-20">
                  {products.map((product, idx) => (
                    <motion.div 
                      key={product.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      className="group flex flex-col pt-8 border-t border-stone-100"
                    >
                      <div className="aspect-[4/5] bg-stone-100 rounded-2xl overflow-hidden mb-8 relative">
                        {product.imageUrl && (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                          />
                        )}
                        <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/10 transition-colors duration-500" />
                        <button 
                          onClick={() => addToCart(product)}
                          className="absolute bottom-6 right-6 w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 hover:bg-primary hover:text-white"
                        >
                          <Plus className="w-6 h-6" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{product.category}</span>
                          <span className="font-display font-medium text-lg leading-none">${product.price.toFixed(2)}</span>
                        </div>
                        <h3 className="text-3xl font-serif font-black italic group-hover:text-primary transition-colors cursor-pointer">{product.name}</h3>
                        <p className="text-stone-500 text-sm leading-relaxed line-clamp-2">{product.description}</p>
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
      <section className="py-32 px-4 bg-charcoal text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 blur-[150px] rounded-full" />
           <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gold/10 blur-[120px] rounded-full" />
        </div>
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-24 items-center relative z-10">
           <div className="space-y-12">
              <div className="space-y-4">
                 <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px]">The Commitment</span>
                 <h3 className="text-6xl font-serif italic italic leading-tight">Beyond the Grill.</h3>
              </div>
              
              <div className="space-y-8">
                <div className="flex gap-6 items-start">
                  <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center flex-shrink-0 group hover:border-primary transition-colors">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-serif font-bold text-2xl italic">The 24-Hour Ritual</h4>
                    <p className="text-stone-400 text-lg leading-relaxed font-serif italic opacity-70">A deep, complex infusion that honors the livestock. We don't rush the flavor.</p>
                  </div>
                </div>
                
                <div className="flex gap-6 items-start">
                  <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center flex-shrink-0 group hover:border-primary transition-colors">
                    <Flame className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-serif font-bold text-2xl italic">Honest Charcoal</h4>
                    <p className="text-stone-400 text-lg leading-relaxed font-serif italic opacity-70">No gas, no compromises. Only the soul-deep smokiness of real oak wood embers.</p>
                  </div>
                </div>
              </div>
           </div>

           <div className="bg-white/5 border border-white/10 p-12 rounded-[3.5rem] glass space-y-12 backdrop-blur-2xl">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/40">
                    <MapPin className="w-8 h-8 text-white" />
                 </div>
                 <div>
                    <h5 className="font-serif font-bold text-2xl italic">Find the Fire</h5>
                    <p className="text-stone-400 font-medium">Downtown Arts District, Studio 44</p>
                 </div>
              </div>
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 bg-gold rounded-3xl flex items-center justify-center shadow-2xl shadow-gold/40">
                    <Phone className="w-8 h-8 text-white" />
                 </div>
                 <div>
                    <h5 className="font-serif font-bold text-2xl italic">Private Dining</h5>
                    <p className="text-stone-400 font-medium">+1 (800) GRILL-HERITAGE</p>
                 </div>
              </div>
              <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                 <div className="flex -space-x-4">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-charcoal bg-stone-800 overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?u=${i}`} alt="" />
                      </div>
                    ))}
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary">Joining 2.4k+ Loyalists</p>
              </div>
           </div>
        </div>
      </section>

      {/* My Orders Section */}
      {user && myOrders.length > 0 && (
        <section className="py-32 px-4 bg-cream border-t border-stone-200/50">
           <div className="max-w-4xl mx-auto space-y-12">
              <div className="flex items-center justify-between">
                 <h2 className="text-4xl font-serif italic">Your Order History</h2>
                 <div className="w-12 h-1 bg-stone-200 rounded-full" />
              </div>
              
              <div className="space-y-6">
                 {myOrders.map((order, idx) => (
                    <motion.div 
                      key={order.id} 
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-8 bg-white rounded-[2.5rem] border border-stone-100 flex items-center justify-between group hover:shadow-xl transition-all duration-500"
                    >
                       <div className="space-y-2">
                          <div className="flex gap-4 items-center">
                             <span className="text-xs font-black uppercase tracking-widest text-stone-300">#{order.id?.slice(-6).toUpperCase()}</span>
                             <span className={`text-[10px] uppercase font-black px-4 py-1.5 rounded-full ${
                                order.status === OrderStatus.DELIVERED ? 'bg-green-50 text-green-600' : 
                                order.status === OrderStatus.CANCELLED ? 'bg-red-50 text-red-600' : 'bg-primary/5 text-primary'
                             }`}>
                                {order.status.replace(/-/g, ' ')}
                             </span>
                          </div>
                          <p className="text-xl font-serif italic font-bold">
                             {order.items.length} Article{order.items.length > 1 ? 's' : ''} • <span className="font-display not-italic font-black text-stone-400">${order.totalAmount.toFixed(2)}</span>
                          </p>
                       </div>
                       <button className="w-14 h-14 bg-stone-50 rounded-full flex items-center justify-center text-stone-300 group-hover:bg-primary group-hover:text-white transition-all duration-300 group-hover:rotate-45">
                          <ChevronRight className="w-6 h-6" />
                       </button>
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

              <div className="flex justify-between items-center mb-10 relative z-10">
                <div className="space-y-1">
                   <h3 className="text-4xl font-serif italic">Secure Settlement</h3>
                   <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Article Allocation Complete</p>
                </div>
                <button onClick={() => setCheckoutStatus('idle')} className="p-3 hover:bg-stone-50 rounded-full transition-colors">
                  <X className="w-6 h-6 text-stone-400" />
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

      <footer className="py-12 px-4 border-t border-stone-100 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 opacity-50">
          <Flame className="w-5 h-5" />
          <span className="font-display font-bold tracking-tight">Grilled & Co.</span>
        </div>
        <p className="text-stone-400 text-xs">© 2026 Grilled & Co. Hand-crafted with passion for flame.</p>
      </footer>
    </div>
  );
}
