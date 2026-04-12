import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin } from 'lucide-react';

// Fix for default marker icons in Leaflet with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface SingleLocationMapProps {
  locationName: string;
  className?: string;
}

export default function SingleLocationMap({ locationName, className = '' }: SingleLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Load Leaflet CSS dynamically
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    return () => {
      // Clean up map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Initialize map and update location
  useEffect(() => {
    if (!mapRef.current || !locationName) return;

    // Small delay to ensure DOM is ready
    const initMap = () => {
      if (!mapRef.current) return;

      // Initialize map if it doesn't exist
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView([59.3293, 18.0686], 12); // Default to Stockholm

        // Add tile layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        // Add zoom control to bottom right
        L.control.zoom({
          position: 'bottomright'
        }).addTo(map);

        mapInstanceRef.current = map;
        setIsMapReady(true);
      }

      // Geocode the location name
      const geocodeLocation = async () => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName + ', Stockholm, Sweden')}&limit=1`
          );
          const data = await response.json();

          if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);

            // Update map view
            mapInstanceRef.current?.setView([lat, lon], 14);

            // Remove existing marker
            if (markerRef.current) {
              markerRef.current.remove();
            }

            // Add new marker
            const marker = L.marker([lat, lon]).addTo(mapInstanceRef.current!);
            marker.bindPopup(`<b>${locationName}</b>`).openPopup();
            markerRef.current = marker;
          }
        } catch (error) {
          console.error('Error geocoding location:', error);
        }
      };

      geocodeLocation();
    };

    // Small delay to ensure container has size
    setTimeout(initMap, 100);

    return () => {
      // Cleanup is handled in the first useEffect
    };
  }, [locationName]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '250px' }}
      />
    </div>
  );
}
