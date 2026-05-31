import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const RegisterPage = () => {
    const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError('')

        if (form.username.trim().length < 3) return setError('Username must be at least 3 characters.')
        if (!EMAIL_RE.test(form.email)) return setError('Please enter a valid email address.')
        if (form.password.length < 6) return setError('Password must be at least 6 characters.')
        if (form.password !== form.confirmPassword) return setError('Passwords do not match.')

        setLoading(true)
        try {
            const response = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: form.username.trim(),
                    email: form.email.trim(),
                    password: form.password,
                    role: 'Customer',
                    canAccessPos: false,
                    canAccessKds: false,
                    canAccessOnlineOrder: true,
                    canManageDiscounts: false
                })
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || data?.message || 'Registration failed')
            }

            const authUser = data.user || data
            localStorage.setItem('currentUser', JSON.stringify({
                id: authUser.id || '',
                name: authUser.username || form.username.trim(),
                email: authUser.email || form.email.trim(),
                role: authUser.role || 'Customer',
                canAccessPos: Boolean(authUser.canAccessPos),
                canAccessKds: Boolean(authUser.canAccessKds),
                canAccessOnlineOrder: true,
                canManageDiscounts: Boolean(authUser.canManageDiscounts)
            }))
            navigate('/home', { replace: true })
        } catch (err: any) {
            setError(err?.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-shell online-auth-shell">
            <form onSubmit={handleSubmit} className="auth-card online-auth-card">
                <div className="auth-badge online-auth-badge">Online Ordering</div>
                <h1 className="auth-title">Create Account</h1>
                <p className="auth-subtitle">Join RestroSync Online Ordering</p>

                {error && <div className="auth-error">{error}</div>}

                <div className="auth-form">
                    <label className="auth-field">
                        <span className="auth-label">Username</span>
                        <input className="auth-input online-auth-input" placeholder="e.g. alex.order" value={form.username} onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))} />
                    </label>
                    <label className="auth-field">
                        <span className="auth-label">Email Address</span>
                        <input className="auth-input online-auth-input" placeholder="alex@restrosync.com" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} />
                    </label>
                    <label className="auth-field">
                        <span className="auth-label">Password</span>
                        <input type="password" className="auth-input online-auth-input" placeholder="••••••••" value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} />
                    </label>
                    <label className="auth-field">
                        <span className="auth-label">Confirm Password</span>
                        <input type="password" className="auth-input online-auth-input" placeholder="••••••••" value={form.confirmPassword} onChange={e => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))} />
                    </label>
                </div>

                <button type="submit" disabled={loading} className="auth-button online-auth-button">
                    {loading ? 'Creating account...' : 'Create Account'}
                </button>

                <p className="auth-footer online-auth-footer">
                    Already have an account? <Link to="/login" className="auth-link online-auth-link">Sign in</Link>
                </p>
            </form>
        </div>
    )
}

export default RegisterPage