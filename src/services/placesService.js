// src/services/placesService.js
import { Loader } from '@googlemaps/js-api-loader';
import { saveCachedPlace, getCachedPlace, getCachedPlacesByProvince } from './firestoreService';
import provinceCoords from '../assets/provinceCoord.json';

let placesService = null;

export const initPlacesService = async (map) => {
    if (!map) throw new Error('Map instance required');
    if (placesService) return;

    const loader = new Loader({
        apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places']
    });

    await loader.load();
    placesService = new window.google.maps.places.PlacesService(map);
    console.log('PlacesService initialized');
};

export const searchNearbyPlaces = async (request) => {
    if (!placesService) throw new Error('PlacesService chưa khởi tạo');

    return new Promise((resolve, reject) => {
        placesService.nearbySearch(request, async (results, status) => {
            if (status !== 'OK' && status !== 'ZERO_RESULTS') return reject(status);

            const valid = (results || []).filter(p => p.place_id && p.rating >= 4.0);
            const promises = valid.map(async place => {
                const cached = await getCachedPlace(place.place_id);
                if (!cached) {
                    const data = {
                        name: place.name,
                        address: place.vicinity,
                        rating: place.rating,
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng(),
                        types: place.types,
                        photo: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null
                    };
                    await saveCachedPlace(place.place_id, data);
                    return { id: place.place_id, ...data };
                }
                return { id: place.place_id, ...cached };
            });

            const final = await Promise.all(promises);
            resolve(final.slice(0, 5));
        });
    });
};

export const searchAndCachePlaces = async (request, province) => {
    const cached = await getCachedPlacesByProvince(province, request.types || []);
    if (cached.length >= 5) {
        console.log(`Dùng cache cho ${province}: ${cached.length} điểm`);
        return cached;
    }
    return searchNearbyPlaces(request);
};

export const geocodeProvince = async (province) => {
    const cachedCoord = provinceCoords[province];
    if (cachedCoord) return cachedCoord;

    const geocoder = new window.google.maps.Geocoder();
    return new Promise((resolve, reject) => {
        geocoder.geocode({ address: `${province}, Vietnam` }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const loc = results[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng() });
            } else {
                reject(`Geocode lỗi: ${status}`);
            }
        });
    });
};