// src/services/placesService.js
let mapInstance = null;

export const initPlacesService = (map) => {
    if (!map) {
        throw new Error('Map instance is required');
    }
    mapInstance = map;
    return true;
};

// === CŨ: Dùng PlacesService (sẽ bị cảnh báo deprecation) ===
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

// === MỚI: Dùng google.maps.places.Place (khuyến nghị chính thức) ===
export const getPlaceDetailsNew = async (placeId) => {
    if (!window.google?.maps?.places) {
        throw new Error('Google Maps Places API not loaded');
    }

    const place = new window.google.maps.places.Place({ id: placeId });
    await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'rating', 'userRatingsTotal', 'photos', 'types', 'priceLevel']
    });

    return {
        place_id: placeId,
        name: place.displayName,
        vicinity: place.formattedAddress,
        rating: place.rating,
        user_ratings_total: place.userRatingsTotal,
        photos: place.photos,
        types: place.types,
        price_level: place.priceLevel,
        geometry: { location: place.location }
    };
};

export const getPhotoUrl = (photoRef, maxWidth = 400) => {
    if (!photoRef) return null;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoRef}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`;
};

export const searchPlacesByText = async (query, location, radius = 50000) => {
    return new Promise((resolve, reject) => {
        if (!window.google?.maps?.places || !mapInstance) {
            reject(new Error('Google Maps Places API not available'));
            return;
        }

        try {
            const service = new window.google.maps.places.PlacesService(mapInstance);
            service.textSearch({
                query,
                location: new window.google.maps.LatLng(location.lat, location.lng),
                radius
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