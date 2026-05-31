import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const LoginPage = () => {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Login failed')
            }

            const authUser = data.user || data
            const currentUser = {
                id: authUser.id || '',
                name: authUser.username || username,
                email: authUser.email || '',
                role: authUser.role || 'Staff',
                canAccessPos: Boolean(authUser.canAccessPos),
                canAccessKds: Boolean(authUser.canAccessKds),
                canAccessOnlineOrder: true,
                canManageDiscounts: Boolean(authUser.canManageDiscounts)
            }


            localStorage.setItem('currentUser', JSON.stringify(currentUser))
            navigate('/home', { replace: true })
        } catch (err: any) {
            setError(err?.message || 'Invalid credentials')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-shell online-auth-shell">
            <form onSubmit={handleLogin} className="auth-card online-auth-card">
                <div className="auth-badge online-auth-badge">Online Ordering</div>
                <h1 className="auth-title">Online Order Access</h1>
                <p className="auth-subtitle">Sign in to RestroSync Online Ordering</p>

                {error && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="auth-form">
                    <label className="auth-field">
                        <span className="auth-label">Username</span>
                        <input
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            className="auth-input online-auth-input"
                        />
                    </label>

                    <label className="auth-field">
                        <span className="auth-label">Password</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="auth-input online-auth-input"
                        />
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="auth-button online-auth-button"
                >
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>

                <p className="auth-footer online-auth-footer">
                    New customer? <Link to="/register" className="auth-link online-auth-link">Create account</Link>
                </p>
            </form>
        </div>
    )
}

export default LoginPage