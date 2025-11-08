// src/services/mapService.js
export const getDirections = async (origin, destination, waypoints = []) => {
    const service = new window.google.maps.DirectionsService();
    return new Promise((resolve, reject) => {
        service.route(
            {
                origin,
                destination,
                waypoints: waypoints.map((w) => ({ location: w, stopover: true })),
                travelMode: window.google.maps.TravelMode.DRIVING,
                optimizeWaypoints: true,
            },
            (result, status) => {
                if (status === 'OK') resolve(result);
                else reject(status);
            }
        );
    });
};