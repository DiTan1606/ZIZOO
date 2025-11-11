// src/services/placesService.js
let mapInstance = null;

export const initPlacesService = (map) => {
    if (!map) {
        throw new Error('Map instance is required');
    }
    mapInstance = map;
    return true;
};

// Sử dụng Places API mới
export const searchNearbyPlaces = async (options) => {
    return new Promise((resolve, reject) => {
        if (!window.google?.maps?.places || !mapInstance) {
            reject(new Error('Google Maps Places API not available'));
            return;
        }

        try {
            const service = new window.google.maps.places.PlacesService(mapInstance);

            service.nearbySearch(options, (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                    resolve(results || []);
                } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    resolve([]);
                } else {
                    reject(new Error(`Places API error: ${status}`));
                }
            });
        } catch (error) {
            reject(new Error(`Places service error: ${error.message}`));
        }
    });
};

export const getPlaceDetails = (placeId) => {
    return new Promise((resolve, reject) => {
        if (!window.google?.maps?.places || !mapInstance) {
            reject(new Error('Places service not initialized'));
            return;
        }

        try {
            const service = new window.google.maps.places.PlacesService(mapInstance);

            service.getDetails({ placeId }, (place, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                    resolve(place);
                } else {
                    reject(new Error(`Place details error: ${status}`));
                }
            });
        } catch (error) {
            reject(new Error(`Place details service error: ${error.message}`));
        }
    });
};

// Hàm lấy URL ảnh từ Google Places
export const getPhotoUrl = (photoRef, maxWidth = 400) => {
    if (!photoRef) return null;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoRef}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`;
};

// Text Search thay thế
export const searchPlacesByText = async (query, location, radius = 50000) => {
    return new Promise((resolve, reject) => {
        if (!window.google?.maps?.places || !mapInstance) {
            reject(new Error('Google Maps Places API not available'));
            return;
        }

        try {
            const service = new window.google.maps.places.PlacesService(mapInstance);

            service.textSearch({
                query: query,
                location: location,
                radius: radius
            }, (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                    resolve(results || []);
                } else {
                    reject(new Error(`Text search error: ${status}`));
                }
            });
        } catch (error) {
            reject(new Error(`Text search service error: ${error.message}`));
        }
    });
};