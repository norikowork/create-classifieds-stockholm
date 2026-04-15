import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { X } from 'lucide-react';

interface Post {
  _row_id: string;
  title: string;
  location_uuid: string;
  description: string;
  images?: string[];
  post_type: string;
  category_uuid: string;
  price?: string;
  userName?: string;
  _created_at: string;
  categoryName?: string;
  locationName?: string;
  categoryColor?: string;
}

interface Location {
  uuid: string;
  name: string;
  name_ja?: string;
  latitude?: number;
  longitude?: number;
}

interface MapViewProps {
  posts: Post[];
  locations: Location[];
  onPostClick?: (postId: string) => void;
  selectedPostId?: string | null;
  getCategoryName?: (categoryUuid: string) => string;
  getCategoryColor?: (categoryUuid: string) => string;
  getLocationName?: (locationId: string) => string;
  formatDate?: (timestamp: number) => string;
}

// Sweden center coordinates - centered to show all of Sweden
const SWEDEN_CENTER: [number, number] = [60.0, 15.0];  // Center of Sweden
const SWEDEN_BOUNDS: [[number, number], [number, number]] = [[55.0, 10.5], [69.5, 24.0]];
const DEFAULT_ZOOM = 5;  // Lower zoom to show more of Sweden

// Cache for popup content to avoid recreating
const popupContentCache = new Map<string, string>();

// Load CSS once
let leafletCssLoaded = false;
let customStylesLoaded = false;

const loadLeafletCSS = () => {
  if (leafletCssLoaded) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  leafletCssLoaded = true;
};

const loadCustomStyles = () => {
  if (customStylesLoaded) return;
  const style = document.createElement('style');
  style.innerHTML = `
    .custom-map-popup .leaflet-popup-content-wrapper {
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 0;
      overflow: hidden;
    }
    .custom-map-popup .leaflet-popup-content {
      margin: 0;
      padding: 0;
    }
    .custom-map-popup .leaflet-popup-tip {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .custom-map-popup .leaflet-popup-close-button {
      padding: 4px 8px;
      font-size: 20px;
      color: #6b7280;
      font-weight: bold;
    }
    .custom-map-popup .leaflet-popup-close-button:hover {
      color: #111827;
    }
    .map-popup-content a {
      transition: all 0.2s;
    }
    .map-popup-content a:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
  `;
  document.head.appendChild(style);
  customStylesLoaded = true;
};

export default function MapView({ posts, locations, onPostClick, selectedPostId, getCategoryName, getCategoryColor, getLocationName, formatDate }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [isMapReady, setIsMapReady] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isCardVisible, setIsCardVisible] = useState(false);

  // Memoize posts with valid locations to avoid recalculating
  const postsWithLocation = useMemo(() => {
    const validPosts = posts.filter(post => {
      const location = locations.find(l => l.uuid === post.location_uuid);
      console.log('Post:', post._row_id, 'Title:', post.title, 'Location UUID:', post.location_uuid, 'Found location:', location);
      return location && location.latitude && location.longitude;
    }).slice(0, 50);
    console.log('Valid posts with locations:', validPosts.length);
    return validPosts;
  }, [posts, locations]);

  // Memoize total count for display
  const totalLocationCount = useMemo(() => {
    return posts.filter(p => p.location_uuid).length;
  }, [posts]);

  // Handle marker click - show card instead of popup
  const handleMarkerClick = useCallback((post: Post) => {
    setSelectedPost(post);
    setIsCardVisible(true);
    
    if (onPostClick) {
      onPostClick(post._row_id);
    }
  }, [onPostClick]);

  // Close card
  const handleCloseCard = useCallback(() => {
    setIsCardVisible(false);
    setSelectedPost(null);
    if (onPostClick) {
      onPostClick(null);
    }
  }, [onPostClick]);

  // Format date helper
  const formatDisplayDate = useCallback((timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'たった今';
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }, []);

  // Create icons once (memoized)
  const selectedIcon = useMemo(() => {
    return L.divIcon({
      className: '',
      html: `<div style="
        background-color: #2563eb;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, []);

  const defaultIcon = useMemo(() => {
    return L.divIcon({
      className: '',
      html: `<div style="
        background-color: #ef4444;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }, []);

  // Load CSS on mount
  useEffect(() => {
    loadLeafletCSS();
    loadCustomStyles();
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map centered on Sweden (disable default attribution to remove Leaflet credit)
    const map = L.map(mapRef.current, { attributionControl: false }).setView(SWEDEN_CENTER, DEFAULT_ZOOM);

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add custom attribution control with only OpenStreetMap credit (no Leaflet)
    L.control.attribution({
      prefix: false
    }).addTo(map);

    // Set Sweden bounds
    map.setMaxBounds(SWEDEN_BOUNDS);
    map.setMinZoom(4);

    mapInstanceRef.current = map;
    setIsMapReady(true);

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers efficiently - reuse existing markers
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const currentMarkerIds = new Set<string>();
    const bounds: L.LatLngBoundsExpression = [];

    // Add or update markers
    postsWithLocation.forEach((post) => {
      const location = locations.find(l => l.uuid === post.location_uuid);
      if (!location || !location.latitude || !location.longitude) return;

      const postId = post._row_id;
      const lat = location.latitude;
      const lng = location.longitude;
      currentMarkerIds.add(postId);
      bounds.push([lat, lng]);

      const isSelected = selectedPostId === postId;
      const existingMarker = markersRef.current.get(postId);

      if (existingMarker) {
        // Update existing marker's icon if selection changed
        const targetIcon = isSelected ? selectedIcon : defaultIcon;
        existingMarker.setIcon(targetIcon);
      } else {
        // Create new marker with stable click handler
        const marker = L.marker([lat, lng], { 
          icon: isSelected ? selectedIcon : defaultIcon 
        });
        
        marker.on('click', () => {
          handleMarkerClick(post);
        });

        marker.addTo(map);
        markersRef.current.set(postId, marker);
      }
    });

    // Remove markers that no longer exist
    markersRef.current.forEach((marker, postId) => {
      if (!currentMarkerIds.has(postId)) {
        marker.remove();
        markersRef.current.delete(postId);
      }
    });

    // Reset view if no posts
    if (postsWithLocation.length === 0) {
      map.setView(SWEDEN_CENTER, DEFAULT_ZOOM);
      return;
    }

    // Fit map to show all markers (only when no post is selected to avoid jumping)
    if (bounds.length > 0 && !selectedPostId) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }

  }, [isMapReady, postsWithLocation, selectedPostId, locations, selectedIcon, defaultIcon, handleMarkerClick]);

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden border-2 border-gray-200">
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Location info */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md px-3 py-2 text-xs z-[1000]">
        <div className="font-semibold text-gray-700 whitespace-nowrap">📍 スウェーデン</div>
        <div className="text-gray-500 whitespace-nowrap">
          {postsWithLocation.length}件
          {totalLocationCount > 50 && ' (最大50件)'}
        </div>
      </div>

      {/* Post Card Overlay */}
      {isCardVisible && selectedPost && (
        <div className="absolute bottom-4 left-4 right-4 md:left-8 md:right-auto md:w-96 bg-white rounded-xl shadow-2xl overflow-hidden z-[1001] animate-in slide-in-from-bottom-2 duration-300">
          {/* Close button */}
          <button
            onClick={handleCloseCard}
            className="absolute top-3 right-3 z-10 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-all hover:scale-105"
          >
            <X size={18} className="text-gray-600" />
          </button>

          {/* Image */}
          {selectedPost.images && selectedPost.images.length > 0 && (
            <div className="relative w-full h-48 bg-gray-100">
              <img
                src={selectedPost.images[0]}
                alt={selectedPost.title}
                className="w-full h-full object-cover"
              />
              {/* Category badge */}
              <div className="absolute top-3 left-3">
                <span 
                  className="px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg"
                  style={{ 
                    backgroundColor: `${selectedPost.categoryColor || '#666'}20`,
                    color: selectedPost.categoryColor || '#666'
                  }}
                >
                  {selectedPost.categoryName || '未分類'}
                </span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-4">
            {/* Title */}
            <h3 className="text-lg font-bold text-gray-900 mb-2 pr-8">
              {selectedPost.title}
            </h3>

            {/* Price & Location */}
            <div className="flex items-center justify-between mb-3">
              {selectedPost.price && (
                <span className="text-xl font-bold text-green-600">
                  {selectedPost.price}
                </span>
              )}
              <div className="flex items-center text-sm text-gray-600">
                <svg className="w-4 h-4 mr-1 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{selectedPost.locationName || 'Ej angivet'}</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
              {selectedPost.description || '説明なし'}
            </p>

            {/* Author & Date */}
            <div className="flex items-center text-xs text-gray-500 mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center flex-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm mr-2">
                  {(selectedPost.userName || 'S')[0]}
                </div>
                <div>
                  <div className="font-medium text-gray-700">
                    {selectedPost.userName || 'SverigeJP スタッフ'}
                  </div>
                  <div className="text-gray-400">
                    {formatDisplayDate(selectedPost._created_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <a
                href={`/post/${selectedPost._row_id}`}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors text-center"
              >
                詳細を見る
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
