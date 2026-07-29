import { useState } from 'react';
import { authApi, setAuthSession } from '../api/client';

interface AuthPageProps {
    userType: 'buyer' | 'seller' | 'admin';
    onAuthSuccess: (userId: string, userName: string) => void;
    onBack: () => void;
}

export const AuthPage = ({ userType, onAuthSuccess, onBack }: AuthPageProps) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        minBudget: '',
        maxBudget: '',
        bhk: '2',
        amenities: '',
        sellerType: 'individual',
        rating: '4',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const isAdmin = userType === 'admin';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            if (isLogin || isAdmin) {
                let response;
                if (userType === 'buyer') {
                    response = await authApi.buyerLogin({ email: formData.email, password: formData.password });
                } else if (userType === 'seller') {
                    response = await authApi.sellerLogin({ email: formData.email, password: formData.password });
                } else {
                    response = await authApi.adminLogin({ email: formData.email, password: formData.password });
                }

                const { token, user } = response.data;
                setAuthSession(token, user);
                onAuthSuccess(user.id || 'admin', user.name || 'Admin');
                return;
            }

            if (userType === 'buyer') {
                const amenitiesArray = formData.amenities
                    .split(',')
                    .map((a) => a.trim())
                    .filter((a) => a.length > 0);

                const payload: any = {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                };
                if (formData.minBudget) payload.minBudget = parseInt(formData.minBudget, 10);
                if (formData.maxBudget) payload.maxBudget = parseInt(formData.maxBudget, 10);
                if (formData.bhk) payload.bhk = parseInt(formData.bhk, 10);
                if (amenitiesArray.length > 0) payload.amenities = amenitiesArray;

                await authApi.buyerSignup(payload);
            } else {
                await authApi.sellerSignup({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                    sellerType: formData.sellerType,
                    rating: parseFloat(formData.rating) || 4.0,
                });
            }

            setMessage('Signup successful. Please login with your email and password.');
            setIsLogin(true);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <div className="m3-page-centered">
            <button
                onClick={onBack}
                className="m3-btn m3-btn-outlined m3-btn-sm"
                id="auth-back-btn"
                style={{ position: 'absolute', top: 20, left: 20 }}
            >
                ← Back to Home
            </button>

            <div className="m3-auth-card">
                <h1 className="md-headline-medium" style={{ textAlign: 'center', marginBottom: 4, color: 'var(--md-sys-color-on-surface)' }}>
                    {isAdmin ? 'Admin' : userType === 'buyer' ? 'Buyer' : 'Seller'} {isLogin || isAdmin ? 'Login' : 'Signup'}
                </h1>
                <p className="md-body-medium" style={{ textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: 24 }}>
                    {isLogin || isAdmin ? 'Welcome back!' : 'Create your account'}
                </p>

                <form onSubmit={handleSubmit}>
                    {!isLogin && !isAdmin && (
                        <>
                            <div className="m3-input-group">
                                <label className="m3-input-label">Full Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="m3-input"
                                />
                            </div>

                            <div className="m3-input-group">
                                <label className="m3-input-label">Phone Number</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="+91 XXXXXXXXXX"
                                    className="m3-input"
                                />
                            </div>

                            {userType === 'seller' && (
                                <div className="m3-input-group">
                                    <label className="m3-input-label">Seller Type</label>
                                    <select
                                        name="sellerType"
                                        value={formData.sellerType}
                                        onChange={handleChange}
                                        className="m3-input m3-select"
                                    >
                                        <option value="individual">Individual</option>
                                        <option value="agent">Agent</option>
                                        <option value="builder">Builder</option>
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    <div className="m3-input-group">
                        <label className="m3-input-label">Email *</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="m3-input"
                        />
                    </div>

                    <div className="m3-input-group">
                        <label className="m3-input-label">Password *</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            className="m3-input"
                        />
                    </div>

                    {message && <div className="m3-alert m3-alert-success">{message}</div>}
                    {error && <div className="m3-alert m3-alert-error">{error}</div>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="m3-btn m3-btn-filled m3-btn-full"
                        id="auth-submit-btn"
                        style={{ marginBottom: 16 }}
                    >
                        {loading ? 'Processing...' : (isLogin || isAdmin ? 'Login' : 'Sign Up')}
                    </button>

                    {!isAdmin && (
                        <div style={{ textAlign: 'center' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError('');
                                    setMessage('');
                                }}
                                className="m3-btn m3-btn-text"
                                id="auth-toggle-btn"
                            >
                                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};
