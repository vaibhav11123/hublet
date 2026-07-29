import { BrowserRouter as Router, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import { AdminDashboard } from './components/AdminDashboard';
import { BuyerDashboard } from './components/BuyerDashboard';
import { SellerDashboard } from './components/SellerDashboard';
import { AuthPage } from './components/AuthPage';
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage';
import { SellerAnalyticsPage } from './pages/SellerAnalyticsPage';
import { NotificationBell } from './components/NotificationBell';

import { clearAuthSession, getAuthSession } from './api/client';

function HomePage() {
    const navigate = useNavigate();

    return (
        <div className="m3-page-centered">
            <div className="m3-home-card">
                <h1 className="md-headline-large" style={{ marginBottom: 4, color: 'var(--md-sys-color-on-surface)' }}>
                    Hublet
                </h1>
                <p className="md-body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: 32 }}>
                    Real Estate Lead Matching Platform
                </p>

                <div className="m3-flex-col m3-gap-sm">
                    <button
                        onClick={() => navigate('/auth/admin')}
                        className="m3-btn m3-btn-filled m3-btn-full"
                        id="home-admin-login"
                    >
                        Login as Admin
                    </button>
                    <button
                        onClick={() => navigate('/auth/buyer')}
                        className="m3-btn m3-btn-tonal m3-btn-full"
                        id="home-buyer-login"
                    >
                        Buyer Login / Signup
                    </button>
                    <button
                        onClick={() => navigate('/auth/seller')}
                        className="m3-btn m3-btn-outlined m3-btn-full"
                        id="home-seller-login"
                    >
                        Seller Login / Signup
                    </button>
                </div>
            </div>
        </div>
    );
}

function AuthPageWrapper() {
    const navigate = useNavigate();
    const { userType } = useParams<{ userType: 'buyer' | 'seller' | 'admin' }>();

    if (!userType || !['buyer', 'seller', 'admin'].includes(userType)) {
        return <Navigate to="/" replace />;
    }

    const handleAuthSuccess = (userId: string, _userName: string) => {
        if (userType === 'admin') {
            navigate('/admin');
            return;
        }
        navigate(`/${userType}/${userId}`);
    };

    return (
        <AuthPage
            userType={userType}
            onAuthSuccess={handleAuthSuccess}
            onBack={() => navigate('/')}
        />
    );
}

function AdminDashboardWrapper() {
    const navigate = useNavigate();
    const { user } = getAuthSession();

    if (!user || user.role !== 'admin') {
        return <Navigate to="/auth/admin" replace />;
    }

    const handleLogout = () => {
        clearAuthSession();
        navigate('/');
    };

    return (
        <AdminDashboard
            userEmail={user.email || 'admin'}
            onLogout={handleLogout}
            onViewAnalytics={() => navigate('/admin/analytics')}
        />
    );
}

function AdminAnalyticsPageWrapper() {
    const { user } = getAuthSession();

    if (!user || user.role !== 'admin') {
        return <Navigate to="/auth/admin" replace />;
    }

    return <AdminAnalyticsPage />;
}

function BuyerDashboardWrapper() {
    const navigate = useNavigate();
    const { userId } = useParams<{ userId: string }>();
    const { user } = getAuthSession();

    if (!userId) {
        return <Navigate to="/" replace />;
    }

    if (!user || user.role !== 'buyer' || user.id !== userId) {
        return <Navigate to="/auth/buyer" replace />;
    }

    const handleLogout = () => {
        clearAuthSession();
        navigate('/');
    };

    return (
        <div className="m3-page">
            <header className="m3-top-app-bar">
                <div>
                    <div className="m3-top-app-bar__title">Hublet</div>
                    <div className="m3-top-app-bar__subtitle">
                        Logged in as: <strong>{user.name || user.email}</strong>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <NotificationBell userId={userId} role="buyer" />
                    <button onClick={handleLogout} className="m3-btn m3-btn-error-tonal m3-btn-sm" id="buyer-logout">
                        Logout
                    </button>
                </div>
            </header>
            <BuyerDashboard buyerId={userId} buyerName={user.name || 'Buyer'} />
        </div>
    );
}

function SellerDashboardWrapper() {
    const navigate = useNavigate();
    const { userId } = useParams<{ userId: string }>();
    const { user } = getAuthSession();

    if (!userId) {
        return <Navigate to="/" replace />;
    }

    if (!user || user.role !== 'seller' || user.id !== userId) {
        return <Navigate to="/auth/seller" replace />;
    }

    const handleLogout = () => {
        clearAuthSession();
        navigate('/');
    };

    return (
        <div className="m3-page">
            <header className="m3-top-app-bar">
                <div>
                    <div className="m3-top-app-bar__title">Hublet</div>
                    <div className="m3-top-app-bar__subtitle">
                        Logged in as: <strong>{user.name || user.email}</strong>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <NotificationBell userId={userId} role="seller" />
                    <button onClick={handleLogout} className="m3-btn m3-btn-error-tonal m3-btn-sm" id="seller-logout">
                        Logout
                    </button>
                </div>
            </header>
            <SellerDashboard
                sellerId={userId}
                sellerName={user.name || 'Seller'}
                onViewAnalytics={() => navigate(`/seller/${userId}/analytics`)}
            />
        </div>
    );
}

function SellerAnalyticsPageWrapper() {
    const { userId } = useParams<{ userId: string }>();
    const { user } = getAuthSession();

    if (!userId) {
        return <Navigate to="/" replace />;
    }

    if (!user || user.role !== 'seller' || user.id !== userId) {
        return <Navigate to="/auth/seller" replace />;
    }

    return <SellerAnalyticsPage />;
}

function AdminSellerAnalyticsImpersonationWrapper() {
    const { user } = getAuthSession();
    const { sellerId } = useParams<{ sellerId: string }>();

    if (!user || user.role !== 'admin') {
        return <Navigate to="/auth/admin" replace />;
    }

    return <SellerAnalyticsPage impersonatedSellerId={sellerId} />;
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/explore" element={<Navigate to="/" replace />} />
                <Route path="/auth/:userType" element={<AuthPageWrapper />} />
                <Route path="/admin" element={<AdminDashboardWrapper />} />
                <Route path="/admin/analytics" element={<AdminAnalyticsPageWrapper />} />
                <Route path="/admin/analytics/sellers/:sellerId" element={<AdminSellerAnalyticsImpersonationWrapper />} />
                <Route path="/buyer/:userId" element={<BuyerDashboardWrapper />} />
                <Route path="/seller/:userId" element={<SellerDashboardWrapper />} />
                <Route path="/seller/:userId/analytics" element={<SellerAnalyticsPageWrapper />} />
            </Routes>
        </Router>
    );
}

export default App;
