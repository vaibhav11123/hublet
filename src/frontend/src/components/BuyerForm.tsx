import { useState } from 'react';
import axios from 'axios';
import LocationPicker, { PickedLocation } from './LocationPicker';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

interface BuyerFormProps {
    buyerId: string;
    onPreferencesUpdated?: () => void;
}

const BuyerForm = ({ buyerId, onPreferencesUpdated }: BuyerFormProps) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        minBudget: '',
        maxBudget: '',
        bhk: '',
        amenities: '',
        additionalNotes: '',
        rawQuery: '',
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [showMap, setShowMap] = useState(false);
    const [pickedLocations, setPickedLocations] = useState<PickedLocation[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            // Prepare payload - only send fields that have values to avoiding overwriting with empty defaults
            const payload: any = {};

            if (formData.name) payload.name = formData.name;
            if (formData.email) payload.email = formData.email;
            if (formData.phone) payload.phone = formData.phone;
            if (formData.rawQuery) payload.rawPreferences = formData.rawQuery;

            const amenitiesArray = formData.amenities
                .split(',')
                .map((a) => a.trim())
                .filter((a) => a.length > 0);

            if (amenitiesArray.length > 0) {
                payload.amenities = amenitiesArray;
            }

            if (formData.minBudget) payload.minBudget = parseInt(formData.minBudget);
            if (formData.maxBudget) payload.maxBudget = parseInt(formData.maxBudget);
            if (formData.bhk && formData.bhk !== 'Any') payload.bhk = parseInt(formData.bhk);

            // Include locality coordinates from map picker if available
            if (pickedLocations.length > 0) {
                payload.metadata = {
                    localityCoords: pickedLocations.map((l) => ({
                        name: l.name,
                        lat: l.lat,
                        lon: l.lon,
                    })),
                };
            }

            await axios.put(`${API_BASE_URL}/buyers/${buyerId}`, payload);

            setMessage('Preferences updated successfully! Finding matches...');
            if (onPreferencesUpdated) {
                setTimeout(() => {
                    onPreferencesUpdated();
                }, 1000);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update preferences');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleLocationsChange = (locations: PickedLocation[]) => {
        setPickedLocations(locations);
    };

    return (
        <div className="m3-card m3-card-elevated" style={{ maxWidth: 700, margin: '0 auto' }}>
            <h2 className="md-title-large" style={{ marginBottom: 4, color: 'var(--md-sys-color-on-surface)' }}>
                Update Your Preferences
            </h2>
            <p className="md-body-small" style={{ marginBottom: 24, color: 'var(--md-sys-color-on-surface-variant)' }}>
                AI Agent will understand your needs and update your profile automatically.
            </p>

            <form onSubmit={handleSubmit}>
                {/* AI Intent Parsing Section */}
                <div className="m3-surface-container" style={{ marginBottom: 24, border: '1px solid var(--md-sys-color-primary-container)' }}>
                    <h3 className="md-title-small" style={{ marginBottom: 8, color: 'var(--md-sys-color-primary)' }}>
                        AI / Natural Language Search
                    </h3>
                    <p className="md-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: 8 }}>
                        Type your requirements naturally, e.g., "Looking for a 2 bhk in Indiranagar under 60 lakhs with parking"
                    </p>
                    <textarea
                        name="rawQuery"
                        value={formData.rawQuery}
                        onChange={handleChange}
                        placeholder="Describe your dream home here..."
                        className="m3-input"
                        style={{ minHeight: 80 }}
                    />
                </div>

                {/* Map-based Locality Picker */}
                <div className="m3-surface-container" style={{ marginBottom: 20, border: '1px solid var(--md-sys-color-outline-variant)' }}>
                    <div className="m3-flex-between" style={{ marginBottom: 12 }}>
                        <div>
                            <h3 className="md-title-small" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                                📍 Preferred Localities
                            </h3>
                            <p className="md-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginTop: 2 }}>
                                Pick your preferred locations on the map
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowMap(!showMap)}
                            className={`m3-btn m3-btn-sm ${showMap ? 'm3-btn-error-tonal' : 'm3-btn-tonal'}`}
                        >
                            {showMap ? '✕ Hide Map' : '🗺️ Pick on Map'}
                        </button>
                    </div>

                    {showMap && (
                        <LocationPicker
                            mode="multiple"
                            initialLocations={pickedLocations}
                            onLocationsChange={handleLocationsChange}
                            height={350}
                        />
                    )}
                </div>

                {message && <div className="m3-alert m3-alert-success">✓ {message}</div>}
                {error && <div className="m3-alert m3-alert-error">✗ {error}</div>}

                <button
                    type="submit"
                    disabled={loading}
                    className="m3-btn m3-btn-filled m3-btn-full"
                    id="buyer-form-submit"
                >
                    {loading ? 'Updating...' : 'Update Preferences & Find Matches'}
                </button>
            </form>
        </div>
    );
};

export default BuyerForm;
