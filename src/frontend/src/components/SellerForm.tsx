import { useState } from 'react';
import { sellerApi } from '../api/client';

function SellerForm({ onSuccess }: { onSuccess?: () => void }) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        sellerType: 'individual',
    });
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await sellerApi.create(formData);
            setMessage(`Seller created! ID: ${response.data.id}`);
            setFormData({ name: '', email: '', phone: '', sellerType: 'individual' });
            if (onSuccess) onSuccess();
        } catch (err: any) {
            setMessage(err.response?.data?.error || 'Failed to create seller');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="m3-card m3-card-elevated">
            <h2 className="md-title-large" style={{ marginBottom: 16 }}>Register as Seller</h2>
            <form onSubmit={handleSubmit}>
                <div className="m3-input-group">
                    <label className="m3-input-label">Name *</label>
                    <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="m3-input"
                    />
                </div>

                <div className="m3-input-group">
                    <label className="m3-input-label">Email *</label>
                    <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="m3-input"
                    />
                </div>

                <div className="m3-input-group">
                    <label className="m3-input-label">Phone</label>
                    <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="m3-input"
                    />
                </div>

                <div className="m3-input-group">
                    <label className="m3-input-label">Seller Type</label>
                    <select
                        value={formData.sellerType}
                        onChange={(e) => setFormData({ ...formData, sellerType: e.target.value })}
                        className="m3-input m3-select"
                    >
                        <option value="individual">Individual</option>
                        <option value="agent">Agent</option>
                        <option value="builder">Builder</option>
                    </select>
                </div>

                {message && (
                    <div className={`m3-alert ${message.includes('created') ? 'm3-alert-success' : 'm3-alert-error'}`}>
                        {message}
                    </div>
                )}

                <button type="submit" disabled={loading} className="m3-btn m3-btn-filled m3-btn-full">
                    {loading ? 'Creating...' : 'Create Seller'}
                </button>
            </form>
        </div>
    );
}

export default SellerForm;
