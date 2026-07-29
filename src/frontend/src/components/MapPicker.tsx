import { useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DEFAULT_CENTER: [number, number] = [19.076, 72.8777]; // Mumbai

const setDefaultLeafletIcon = (() => {
  let configured = false;
  return () => {
    if (configured) return;
    delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
    });
    configured = true;
  };
})();

interface MapSelection {
  lat: number;
  lng: number;
  address: string;
  locality: string;
}

interface MapPickerProps {
  label?: string;
  onLocationSelect: (selection: MapSelection) => void;
}

function LocationMarker({ onSelect }: { onSelect: (selection: MapSelection) => void }) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [locality, setLocality] = useState<string>('');

  useMapEvents({
    click: async (event) => {
      setPosition([event.latlng.lat, event.latlng.lng]);
      setLoading(true);

      try {
        const url = new URL('https://nominatim.openstreetmap.org/reverse');
        url.searchParams.set('format', 'json');
        url.searchParams.set('lat', String(event.latlng.lat));
        url.searchParams.set('lon', String(event.latlng.lng));
        url.searchParams.set('zoom', '18');
        url.searchParams.set('addressdetails', '1');

        const response = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to reverse geocode');
        }

        const data = await response.json();
        const addressLabel = data.display_name || '';
        const addr = data.address || {};
        const localityLabel =
          addr.suburb ||
          addr.neighbourhood ||
          addr.city_district ||
          addr.town ||
          addr.village ||
          addr.city ||
          addr.state_district ||
          '';

        setAddress(addressLabel);
        setLocality(localityLabel);
        onSelect({
          lat: event.latlng.lat,
          lng: event.latlng.lng,
          address: addressLabel,
          locality: localityLabel,
        });
      } catch {
        setAddress('');
        setLocality('');
      } finally {
        setLoading(false);
      }
    },
  });

  const hint = useMemo(() => {
    if (loading) return 'Loading address...';
    if (!position) return 'Click on the map to select a location.';
    if (address) return address;
    return 'Location selected. Address not available.';
  }, [loading, position, address]);

  return (
    <div>
      <div className="map-container">
        <MapContainer center={DEFAULT_CENTER} zoom={11} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {position && <Marker position={position} />}
        </MapContainer>
      </div>
      <p className="md-body-small m3-text-secondary" style={{ marginTop: 8 }}>{hint}</p>
      {locality && (
        <p className="md-body-small m3-text-primary" style={{ marginTop: 4 }}>
          Locality detected: {locality}
        </p>
      )}
    </div>
  );
}

export function MapPicker({ label, onLocationSelect }: MapPickerProps) {
  setDefaultLeafletIcon();

  return (
    <div className="map-panel">
      {label && <p className="md-title-small" style={{ marginBottom: 10 }}>{label}</p>}
      <LocationMarker onSelect={onLocationSelect} />
    </div>
  );
}
