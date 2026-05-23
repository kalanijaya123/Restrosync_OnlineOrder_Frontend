import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast, { Toaster } from 'react-hot-toast'
import { ArrowRight, CheckCircle2, ChevronRight, Clock3, Gift, MapPin, Minus, Package, Search, ShoppingBag, Truck, UtensilsCrossed, Wallet } from 'lucide-react'
import { getApiUrl } from './services/api'

type Size = { name: string; price: number }
type MenuItem = {
    id: string
    name: string
    category: string
    mediaUrl?: string
    sizes: Size[]
    available?: boolean
    recipe?: Array<{ ingredientId: string; ingredientName: string; quantities: Record<string, number> }>
    extras?: Array<{ id: string; name: string; price: number; quantityPerUnit: number; ingredientId: string }>
}

type CartExtra = { extraId: string; name: string; price: number; qty: number }
type CartItem = {
    menuItemId: string
    name: string
    sizeName: string
    basePrice: number
    qty: number
    extras: CartExtra[]
}

type OnlineOrder = {
    id?: string | null
    orderNumber?: string | null
    trackingToken?: string | null
    customerName?: string | null
    customerPhone?: string | null
    customerEmail?: string | null
    deliveryAddress?: string | null
    deliveryType?: string | null
    items?: Array<{
        menuItemId: string
        menuItemName: string
        sizeName: string
        basePrice: number
        qty: number
        extras?: Array<{ extraId: string; qty: number }>
    }>
    subtotal?: number | null
    deliveryFee?: number | null
    discountAmount?: number | null
    tax?: number | null
    total?: number | null
    status?: string | null
    paymentStatus?: string | null
    paymentMethod?: string | null
    orderedAt?: string | null
    expectedDeliveryAt?: string | null
    deliveredAt?: string | null
    notes?: string | null
}

const money = (value: number) => `Rs ${Number(value || 0).toFixed(0)}`

function HomePage() {
    const [menu, setMenu] = useState<MenuItem[]>([])
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('rs-online-cart') || '[]')
        } catch {
            return []
        }
    })
    const [showCheckout, setShowCheckout] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const navigate = useNavigate()

    const [form, setForm] = useState({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        deliveryType: 'pickup',
        deliveryAddress: '',
        notes: ''
    })

    useEffect(() => {
        localStorage.setItem('rs-online-cart', JSON.stringify(cart))
    }, [cart])

    useEffect(() => {
        fetch(getApiUrl('/menu'))
            .then(r => r.ok ? r.json() : [])
            .then(data => setMenu(Array.isArray(data) ? data.map((item: any) => ({
                ...item,
                sizes: Array.isArray(item.sizes) ? item.sizes : [],
                extras: Array.isArray(item.extras) ? item.extras : [],
                recipe: Array.isArray(item.recipe) ? item.recipe : []
            })) : []))
            .catch(() => setMenu([]))
    }, [])

    const categories = useMemo(() => ['All', ...Array.from(new Set(menu.map(item => item.category).filter(Boolean)))], [menu])
    const filteredMenu = useMemo(() => {
        return menu
            .filter(item => selectedCategory === 'All' || item.category === selectedCategory)
            .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
            .filter(item => item.available !== false)
    }, [menu, search, selectedCategory])

    const subtotal = cart.reduce((sum, item) => sum + item.basePrice * item.qty + item.extras.reduce((extraSum, extra) => extraSum + extra.price * extra.qty, 0) * item.qty, 0)
    const deliveryFee = form.deliveryType === 'delivery' ? 350 : 0
    const total = subtotal + deliveryFee

    const addToCart = (item: MenuItem, size: Size) => {
        const existing = cart.find(cartItem => cartItem.menuItemId === item.id && cartItem.sizeName === size.name && cartItem.extras.length === 0)
        if (existing) {
            setCart(prev => prev.map(cartItem => cartItem === existing ? { ...cartItem, qty: cartItem.qty + 1 } : cartItem))
            return
        }
        setCart(prev => [...prev, { menuItemId: item.id, name: item.name, sizeName: size.name, basePrice: size.price, qty: 1, extras: [] }])
    }

    const updateQty = (index: number, change: number) => {
        setCart(prev => {
            const next = [...prev]
            const updated = next[index]
            const qty = updated.qty + change
            if (qty <= 0) next.splice(index, 1)
            else next[index] = { ...updated, qty }
            return next
        })
    }

    const submitOrder = async () => {
        if (!form.customerName.trim()) return toast.error('Enter your name')
        if (!form.customerPhone.trim()) return toast.error('Enter your phone number')
        if (form.deliveryType === 'delivery' && !form.deliveryAddress.trim()) return toast.error('Enter delivery address')
        if (cart.length === 0) return toast.error('Your cart is empty')

        setSubmitting(true)
        try {
            const payload: OnlineOrder = {
                id: null,
                orderNumber: null,
                trackingToken: null,
                customerName: form.customerName.trim(),
                customerPhone: form.customerPhone.trim(),
                customerEmail: form.customerEmail.trim() || null,
                deliveryAddress: form.deliveryType === 'delivery' ? form.deliveryAddress.trim() : null,
                deliveryType: form.deliveryType,
                items: cart.map(item => ({
                    menuItemId: item.menuItemId,
                    menuItemName: item.name,
                    sizeName: item.sizeName,
                    basePrice: item.basePrice,
                    qty: item.qty,
                    extras: item.extras.map(extra => ({ extraId: extra.extraId, qty: extra.qty }))
                })),
                subtotal,
                deliveryFee,
                discountAmount: 0,
                tax: 0,
                total,
                status: 'pending_payment',
                paymentStatus: 'pending',
                paymentMethod: 'cash',
                orderedAt: new Date().toISOString(),
                expectedDeliveryAt: null,
                deliveredAt: null,
                notes: form.notes.trim() || null
            }

            const res = await fetch(getApiUrl('/online-orders'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error(await res.text())
            const saved = await res.json()
            setCart([])
            localStorage.removeItem('rs-online-cart')
            toast.success('Order placed successfully')
            navigate(`/track/${saved.trackingToken || ''}`, { replace: true })
        } catch (error: any) {
            toast.error(error?.message || 'Failed to place order')
        } finally {
            setSubmitting(false)
            setShowCheckout(false)
        }
    }

    return (
        <div className="page-shell">
            <Toaster position="top-center" />
            <header className="hero">
                <div>
                    <p className="eyebrow">RestroSync Online Ordering</p>
                    <h1>Order your favorites without waiting in line.</h1>
                    <p className="hero-copy">Browse the menu, customize your cart, and send the order straight to the restaurant system.</p>
                    <div className="hero-actions">
                        <Link to="/track" className="secondary-btn">Track Order</Link>
                        <a href="#menu" className="primary-btn">Start Ordering <ArrowRight size={18} /></a>
                    </div>
                </div>
                <div className="hero-card">
                    <p>Fast pickup or delivery</p>
                    <strong>{cart.reduce((sum, item) => sum + item.qty, 0)} items in cart</strong>
                    <span>{money(total)}</span>
                </div>
            </header>

            <section className="toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes" />
                </div>
                <div className="chips">
                    {categories.map(category => (
                        <button key={category} className={selectedCategory === category ? 'chip active' : 'chip'} onClick={() => setSelectedCategory(category)}>{category}</button>
                    ))}
                </div>
            </section>

            <main className="content-grid" id="menu">
                <section className="menu-grid">
                    {filteredMenu.map(item => (
                        <article key={item.id} className="menu-card">
                            {item.mediaUrl ? <img src={item.mediaUrl} alt={item.name} /> : <div className="placeholder"><UtensilsCrossed size={40} /></div>}
                            <div className="menu-card-body">
                                <div className="menu-title-row">
                                    <h3>{item.name}</h3>
                                    <span>{item.category}</span>
                                </div>
                                <div className="size-list">
                                    {item.sizes.map(size => (
                                        <button key={size.name} className="size-btn" onClick={() => addToCart(item, size)}>
                                            <span>{size.name}</span>
                                            <strong>{money(size.price)}</strong>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </article>
                    ))}
                </section>

                <aside className="cart-panel">
                    <div className="cart-header">
                        <ShoppingBag />
                        <div>
                            <h2>Your Cart</h2>
                            <p>{cart.length} line items</p>
                        </div>
                    </div>

                    <div className="cart-items">
                        {cart.length === 0 ? <div className="empty-state">Your cart is empty</div> : cart.map((item, index) => (
                            <div key={`${item.menuItemId}-${item.sizeName}-${index}`} className="cart-item">
                                <div>
                                    <strong>{item.name}</strong>
                                    <p>{item.sizeName}</p>
                                </div>
                                <div className="cart-item-actions">
                                    <button onClick={() => updateQty(index, -1)}><Minus size={16} /></button>
                                    <span>{item.qty}</span>
                                    <button onClick={() => updateQty(index, 1)}>+</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="cart-total">
                        <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                        <div><span>Delivery</span><strong>{money(deliveryFee)}</strong></div>
                        <div className="grand"><span>Total</span><strong>{money(total)}</strong></div>
                        <button className="primary-btn wide" onClick={() => setShowCheckout(true)} disabled={cart.length === 0}>Checkout</button>
                    </div>
                </aside>
            </main>

            <AnimatePresence>
                {showCheckout && (
                    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="modal" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
                            <h2>Checkout</h2>
                            <div className="form-grid">
                                <input placeholder="Full name" value={form.customerName} onChange={e => setForm(prev => ({ ...prev, customerName: e.target.value }))} />
                                <input placeholder="Phone number" value={form.customerPhone} onChange={e => setForm(prev => ({ ...prev, customerPhone: e.target.value }))} />
                                <input placeholder="Email (optional)" value={form.customerEmail} onChange={e => setForm(prev => ({ ...prev, customerEmail: e.target.value }))} />
                                <select value={form.deliveryType} onChange={e => setForm(prev => ({ ...prev, deliveryType: e.target.value }))}>
                                    <option value="pickup">Pickup</option>
                                    <option value="delivery">Delivery</option>
                                </select>
                                {form.deliveryType === 'delivery' && (
                                    <input className="full" placeholder="Delivery address" value={form.deliveryAddress} onChange={e => setForm(prev => ({ ...prev, deliveryAddress: e.target.value }))} />
                                )}
                                <textarea className="full" rows={3} placeholder="Notes for the restaurant" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
                            </div>
                            <div className="modal-actions">
                                <button className="secondary-btn" onClick={() => setShowCheckout(false)}>Cancel</button>
                                <button className="primary-btn" onClick={submitOrder} disabled={submitting}>{submitting ? 'Placing order...' : 'Place Order'}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function TrackPage() {
    const params = useParams()
    const [token, setToken] = useState(params.token || '')
    const [order, setOrder] = useState<OnlineOrder | null>(null)
    const [loading, setLoading] = useState(false)

    const lookup = async (value = token) => {
        if (!value.trim()) return toast.error('Enter tracking token')
        setLoading(true)
        try {
            const res = await fetch(getApiUrl(`/online-orders/track/${value.trim()}`))
            if (!res.ok) throw new Error('Order not found')
            setOrder(await res.json())
        } catch (error: any) {
            setOrder(null)
            toast.error(error?.message || 'Tracking failed')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (params.token) void lookup(params.token)
    }, [params.token])

    return (
        <div className="page-shell narrow">
            <Toaster position="top-center" />
            <header className="track-hero">
                <h1>Track Your Order</h1>
                <p>Enter the tracking token from your receipt.</p>
            </header>

            <div className="track-box">
                <input value={token} onChange={e => setToken(e.target.value)} placeholder="Tracking token" />
                <button className="primary-btn" onClick={() => lookup()} disabled={loading}>{loading ? 'Searching...' : 'Track Order'}</button>
            </div>

            {order && (
                <div className="track-result">
                    <div className="track-result-head">
                        <div>
                            <p className="eyebrow">{order.orderNumber || 'Online Order'}</p>
                            <h2>{order.customerName || 'Guest'}</h2>
                        </div>
                        <span>{order.status || 'pending_payment'}</span>
                    </div>
                    <div className="track-meta">
                        <div><MapPin size={16} /> {order.deliveryType || 'pickup'}</div>
                        <div><Wallet size={16} /> {order.paymentStatus || 'pending'}</div>
                        <div><Clock3 size={16} /> {order.orderedAt ? new Date(order.orderedAt).toLocaleString() : 'Just now'}</div>
                    </div>
                    <div className="track-summary">
                        <strong>Total</strong>
                        <span>{money(order.total || 0)}</span>
                    </div>
                </div>
            )}
        </div>
    )
}

function AppRouter() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/track" element={<TrackPage />} />
            <Route path="/track/:token" element={<TrackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default function App() {
    return <AppRouter />
}
