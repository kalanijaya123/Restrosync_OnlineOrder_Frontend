import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast, { Toaster } from 'react-hot-toast'
import { ArrowRight, CheckCircle2, ChevronRight, Clock3, Gift, MapPin, Minus, Package, Search, ShoppingBag, Truck, UtensilsCrossed, Wallet } from 'lucide-react'
import { getApiUrl } from './services/api'
import { computeDiscounts, defaultDiscountSettings, fetchDiscountSettings, type DiscountSettings } from './utils/discounts'

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
    mealPeriods?: string[]
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
    cardHolderName?: string | null
    cardLast4?: string | null
    cardExpiry?: string | null
    cardTransactionRef?: string | null
    orderedAt?: string | null
    expectedDeliveryAt?: string | null
    deliveredAt?: string | null
    notes?: string | null
}

type OrderHistoryItem = {
    customerName?: string | null
    customerPhone?: string | null
    total?: number | null
    paymentStatus?: string | null
    createdAt?: string | null
}

const money = (value: number) => `Rs ${Number(value || 0).toFixed(0)}`

const SERVICE_PERIODS = ['Breakfast', 'Lunch', 'Dinner'] as const
const MEAL_PERIODS = ['All Day', ...SERVICE_PERIODS] as const

const normalizeMealPeriods = (mealPeriods?: string[] | null) => {
    const cleaned = Array.from(new Set((mealPeriods || [])
        .map(period => period.trim())
        .filter(Boolean)
        .filter(period => period === 'All Day' || SERVICE_PERIODS.includes(period as any))))

    if (cleaned.length === 0 || cleaned.includes('All Day') || cleaned.length === SERVICE_PERIODS.length) {
        return [...SERVICE_PERIODS]
    }

    return SERVICE_PERIODS.filter(period => cleaned.includes(period))
}

const matchesMealPeriod = (mealPeriods: string[] | undefined, selectedPeriod: typeof MEAL_PERIODS[number]) => {
    if (selectedPeriod === 'All Day') return true
    return normalizeMealPeriods(mealPeriods).includes(selectedPeriod)
}

const normalizePhone = (raw?: string | null) => {
    if (!raw) return ''
    return raw.replace(/\D/g, '')
}

const normalizeCustomerName = (raw?: string | null) => {
    if (!raw) return ''

    return raw
        .trim()
        .toLowerCase()
        .replace(/^(mr|mrs|miss|dr)\.?\s+/i, '')
        .replace(/\s+/g, ' ')
}

function HomePage() {
    const [menu, setMenu] = useState<MenuItem[]>([])
    const [discountSettings, setDiscountSettings] = useState<DiscountSettings>(defaultDiscountSettings)
    const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([])
    const [search, setSearch] = useState('')
    const [selectedMealPeriod, setSelectedMealPeriod] = useState<typeof MEAL_PERIODS[number]>('All Day')
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
        paymentMethod: 'cash',
        deliveryAddress: '',
        notes: ''
    })
    const [showCardDetails, setShowCardDetails] = useState(false)
    const [cardDetails, setCardDetails] = useState({
        cardHolderName: '',
        cardLast4: '',
        cardExpiry: '',
        cardTransactionRef: ''
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
                recipe: Array.isArray(item.recipe) ? item.recipe : [],
                mealPeriods: Array.isArray(item.mealPeriods) ? item.mealPeriods : []
            })) : []))
            .catch(() => setMenu([]))
    }, [])

    useEffect(() => {
        const loadSharedSettings = async () => {
            const settings = await fetchDiscountSettings(getApiUrl)
            setDiscountSettings(settings)
        }

        const loadOrderHistory = async () => {
            try {
                const response = await fetch(getApiUrl('/orders'))
                if (!response.ok) throw new Error('Failed to load order history')
                const data = await response.json()
                setOrderHistory(Array.isArray(data) ? data : [])
            } catch {
                setOrderHistory([])
            }
        }

        void loadSharedSettings()
        void loadOrderHistory()
    }, [])

    const categories = useMemo(() => ['All', ...Array.from(new Set(menu
        .filter(item => matchesMealPeriod(item.mealPeriods, selectedMealPeriod))
        .map(item => item.category).filter(Boolean)))], [menu, selectedMealPeriod])
    const filteredMenu = useMemo(() => {
        return menu
            .filter(item => matchesMealPeriod(item.mealPeriods, selectedMealPeriod))
            .filter(item => selectedCategory === 'All' || item.category === selectedCategory)
            .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
            .filter(item => item.available !== false)
    }, [menu, search, selectedCategory, selectedMealPeriod])

    useEffect(() => {
        setSelectedCategory('All')
    }, [selectedMealPeriod])

    const subtotal = cart.reduce((sum, item) => sum + item.basePrice * item.qty + item.extras.reduce((extraSum, extra) => extraSum + extra.price * extra.qty, 0) * item.qty, 0)
    const customerIdentity = useMemo(() => {
        const phone = normalizePhone(form.customerPhone)
        if (phone) return `phone:${phone}`

        const normalizedName = normalizeCustomerName(form.customerName)
        if (normalizedName && normalizedName !== 'guest' && normalizedName !== 'walk-in') {
            return `name:${normalizedName}`
        }

        return ''
    }, [form.customerName, form.customerPhone])

    const matchingOrders = useMemo(() => {
        if (!customerIdentity) return []

        return orderHistory.filter(order => {
            const phone = normalizePhone(order.customerPhone)
            if (customerIdentity.startsWith('phone:')) {
                return phone && customerIdentity === `phone:${phone}`
            }

            const normalizedName = normalizeCustomerName(order.customerName)
            return normalizedName && customerIdentity === `name:${normalizedName}`
        })
    }, [customerIdentity, orderHistory])

    const customerOrderTotals = useMemo(
        () => matchingOrders.map(order => Number(order.total || 0)).filter(total => Number.isFinite(total) && total > 0),
        [matchingOrders]
    )

    const customerPaidOrderTotals = useMemo(
        () => matchingOrders
            .filter(order => order.paymentStatus === 'paid')
            .map(order => Number(order.total || 0))
            .filter(total => Number.isFinite(total) && total > 0),
        [matchingOrders]
    )

    const discountSummary = useMemo(() => computeDiscounts({
        subtotal,
        orderDate: new Date().toISOString(),
        customerOrderTotals,
        customerPaidOrderTotals,
        settings: discountSettings
    }), [subtotal, customerOrderTotals, customerPaidOrderTotals, discountSettings])

    const deliveryFee = form.deliveryType === 'delivery' ? 350 : 0
    const discountedItemsTotal = discountSummary.payableAmount
    const total = discountedItemsTotal + deliveryFee

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
        if (form.paymentMethod === 'card') {
            if (!cardDetails.cardHolderName.trim()) return toast.error('Enter card holder name')
            if (!cardDetails.cardLast4.trim() || cardDetails.cardLast4.trim().length < 4) return toast.error('Enter the last 4 digits of the card')
            if (!cardDetails.cardExpiry.trim()) return toast.error('Enter card expiry')
            if (!cardDetails.cardTransactionRef.trim()) return toast.error('Enter card transaction reference')
        }

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
                discountAmount: discountSummary.totalDiscountAmount,
                tax: 0,
                total,
                status: 'pending_payment',
                paymentStatus: form.paymentMethod === 'card' ? 'paid' : 'pending',
                paymentMethod: form.paymentMethod,
                cardHolderName: form.paymentMethod === 'card' ? cardDetails.cardHolderName.trim() : null,
                cardLast4: form.paymentMethod === 'card' ? cardDetails.cardLast4.trim().slice(-4) : null,
                cardExpiry: form.paymentMethod === 'card' ? cardDetails.cardExpiry.trim() : null,
                cardTransactionRef: form.paymentMethod === 'card' ? cardDetails.cardTransactionRef.trim() : null,
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
                    {MEAL_PERIODS.map(period => (
                        <button key={period} className={selectedMealPeriod === period ? 'chip active' : 'chip'} onClick={() => setSelectedMealPeriod(period)}>{period}</button>
                    ))}
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
                                <div className="menu-tag-row">
                                    <span>{normalizeMealPeriods(item.mealPeriods).length === SERVICE_PERIODS.length ? 'All Day' : normalizeMealPeriods(item.mealPeriods).join(', ')}</span>
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
                        {discountSummary.totalDiscountAmount > 0 && (
                            <div><span>Discount</span><strong>- {money(discountSummary.totalDiscountAmount)}</strong></div>
                        )}
                        <div><span>After Discount</span><strong>{money(discountedItemsTotal)}</strong></div>
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
                                <select value={form.paymentMethod} onChange={e => {
                                    const paymentMethod = e.target.value
                                    setForm(prev => ({ ...prev, paymentMethod }))
                                    setShowCardDetails(paymentMethod === 'card')
                                }}>
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                </select>
                                {form.deliveryType === 'delivery' && (
                                    <input className="full" placeholder="Delivery address" value={form.deliveryAddress} onChange={e => setForm(prev => ({ ...prev, deliveryAddress: e.target.value }))} />
                                )}
                                <textarea className="full" rows={3} placeholder="Notes for the restaurant" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
                            </div>
                            <div className="cart-total mt-4">
                                <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                                {discountSummary.totalDiscountAmount > 0 && (
                                    <div><span>Discount</span><strong>- {money(discountSummary.totalDiscountAmount)}</strong></div>
                                )}
                                <div><span>After Discount</span><strong>{money(discountedItemsTotal)}</strong></div>
                                <div><span>Delivery</span><strong>{money(deliveryFee)}</strong></div>
                                <div className="grand"><span>Total Payable</span><strong>{money(total)}</strong></div>
                                {discountSummary.discounts.length > 0 && (
                                    <div className="text-sm text-gray-400 pt-2 space-y-1">
                                        {discountSummary.discounts.map(discount => (
                                            <div key={discount.key} className="flex justify-between gap-4">
                                                <span>{discount.label}</span>
                                                <span>- {money(discount.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {form.paymentMethod === 'card' && (
                                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">Card details</h3>
                                            <p className="text-sm text-gray-400">Enter the details before placing the order.</p>
                                        </div>
                                        <button className="secondary-btn" type="button" onClick={() => setShowCardDetails(true)}>
                                            Enter Card Details
                                        </button>
                                    </div>
                                    <div className="text-sm text-gray-400">
                                        Status will be marked as paid and the order will be sent to POS for kitchen acceptance.
                                    </div>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button className="secondary-btn" onClick={() => setShowCheckout(false)}>Cancel</button>
                                <button className="primary-btn" onClick={submitOrder} disabled={submitting}>{submitting ? 'Placing order...' : 'Place Order'}</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showCardDetails && form.paymentMethod === 'card' && (
                    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.div className="modal" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
                            <h2>Card Details</h2>
                            <div className="form-grid">
                                <input className="full" placeholder="Card holder name" value={cardDetails.cardHolderName} onChange={e => setCardDetails(prev => ({ ...prev, cardHolderName: e.target.value }))} />
                                <input placeholder="Last 4 digits" value={cardDetails.cardLast4} onChange={e => setCardDetails(prev => ({ ...prev, cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                                <input placeholder="Expiry (MM/YY)" value={cardDetails.cardExpiry} onChange={e => setCardDetails(prev => ({ ...prev, cardExpiry: e.target.value }))} />
                                <input className="full" placeholder="Transaction reference" value={cardDetails.cardTransactionRef} onChange={e => setCardDetails(prev => ({ ...prev, cardTransactionRef: e.target.value }))} />
                            </div>
                            <div className="modal-actions">
                                <button className="secondary-btn" onClick={() => setShowCardDetails(false)}>Cancel</button>
                                <button className="primary-btn" onClick={() => setShowCardDetails(false)}>Okay</button>
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
    const [polling, setPolling] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [historyList, setHistoryList] = useState<OnlineOrder[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

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

    // Poll for updates when an order is loaded
    useEffect(() => {
        let id: any
        if (order) {
            setPolling(true)
            id = setInterval(() => lookup(order.trackingToken || token), 8000)
        } else {
            setPolling(false)
        }

        return () => {
            if (id) clearInterval(id)
        }
    }, [order])

    useEffect(() => {
        if (params.token) void lookup(params.token)
    }, [params.token])

    return (
        <div className="page-shell narrow">
            <Toaster position="top-center" />
            <div className="track-back-row">
                <Link to="/" className="secondary-btn">← Back to Home</Link>
            </div>
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
                        <div className="flex items-center gap-3">
                            <span className="status-pill">{order.status || 'pending_payment'}</span>
                            <button className="secondary-btn" onClick={() => lookup(order.trackingToken || '')}>Refresh</button>
                            <button className="secondary-btn" onClick={() => { setHistoryOpen(true); }}>Order History</button>
                        </div>
                    </div>
                    <div className="track-meta">
                        <div><MapPin size={16} /> {order.deliveryType || 'pickup'}</div>
                        <div><Wallet size={16} /> {order.paymentStatus || 'pending'}</div>
                        <div><Clock3 size={16} /> {order.orderedAt ? new Date(order.orderedAt).toLocaleString() : 'Just now'}</div>
                    </div>
                    {/* Items */}
                    <div className="track-items mt-4">
                        <h3 className="text-sm text-gray-300">Items</h3>
                        <div className="space-y-2 mt-2">
                            {(order.items || []).map((it, idx) => (
                                <div key={idx} className="flex justify-between bg-white/5 p-3 rounded-lg">
                                    <div>
                                        <div className="font-semibold">{it.menuItemName}</div>
                                        <div className="text-sm text-gray-400">{it.sizeName} • Qty: {it.qty}</div>
                                    </div>
                                    <div className="text-green-300 font-semibold">Rs {Number(it.basePrice || 0) * (it.qty || 1)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="track-timeline mt-6">
                        <h3 className="text-sm text-gray-300">Timeline</h3>
                        <ul className="mt-2 text-sm text-gray-400 space-y-2">
                            <li><strong>Ordered:</strong> {order.orderedAt ? new Date(order.orderedAt).toLocaleString() : '—'}</li>
                            <li><strong>Expected:</strong> {order.expectedDeliveryAt ? new Date(order.expectedDeliveryAt).toLocaleString() : '—'}</li>
                            <li><strong>Delivered:</strong> {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '—'}</li>
                            <li><strong>Payment Method:</strong> {order.paymentMethod || '—'}</li>
                            <li><strong>Payment Status:</strong> {order.paymentStatus || '—'}</li>
                        </ul>
                    </div>
                    <div className="track-summary">
                        <strong>Total</strong>
                        <span>{money(order.total || 0)}</span>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {historyOpen && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h2>Order History</h2>
                        <p className="text-sm text-gray-400">Showing previous orders for this phone number.</p>
                        <div className="mt-4">
                            <button className="secondary-btn" onClick={async () => {
                                setHistoryLoading(true)
                                try {
                                    const res = await fetch(getApiUrl('/online-orders'))
                                    const data = await res.json()
                                    const list = Array.isArray(data) ? data : []
                                    const filtered = list.filter((o: any) => (o.customerPhone || '') === (order?.customerPhone || ''))
                                    setHistoryList(filtered)
                                } catch (err) {
                                    setHistoryList([])
                                } finally {
                                    setHistoryLoading(false)
                                }
                            }}>Load History</button>
                        </div>

                        <div className="mt-4 space-y-3">
                            {historyLoading && <div className="text-gray-400">Loading...</div>}
                            {!historyLoading && historyList.length === 0 && <div className="text-gray-400">No history found</div>}
                            {!historyLoading && historyList.map(h => (
                                <div key={h.id} className="bg-white/5 p-3 rounded-lg">
                                    <div className="flex justify-between"><div className="font-semibold">{h.orderNumber}</div><div className="text-sm text-gray-400">{h.status}</div></div>
                                    <div className="text-sm text-gray-400">{h.orderedAt ? new Date(h.orderedAt).toLocaleString() : ''} • Rs {h.total}</div>
                                </div>
                            ))}
                        </div>

                        <div className="modal-actions mt-6">
                            <button className="secondary-btn" onClick={() => setHistoryOpen(false)}>Close</button>
                        </div>
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
