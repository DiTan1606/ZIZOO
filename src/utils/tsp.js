// src/utils/tsp.js
const toRad = (deg) => (deg * Math.PI) / 180;
const haversine = (p1, p2) => {
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lng - p1.lng);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(p1.lat)) *
        Math.cos(toRad(p2.lat)) *
        Math.sin(dLon / 2) ** 2;
    return 12742 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // km
};

export const optimizeRoute = (points) => {
    // points = [{name, lat, lng}]
    const n = points.length;
    if (n <= 1) return points;

    const C = Array(1 << n).fill().map(() => Array(n).fill(Infinity));
    const prev = Array(1 << n).fill().map(() => Array(n).fill(-1));

    for (let i = 0; i < n; i++) C[1 << i][i] = 0;

    for (let mask = 0; mask < (1 << n); mask++) {
        for (let u = 0; u < n; u++) {
            if (!(mask & (1 << u))) continue;
            for (let v = 0; v < n; v++) {
                if (mask & (1 << v)) continue;
                const nMask = mask | (1 << v);
                const cost = C[mask][u] + haversine(points[u], points[v]);
                if (cost < C[nMask][v]) {
                    C[nMask][v] = cost;
                    prev[nMask][v] = u;
                }
            }
        }
    }

    // Find min cost to return to start (0)
    let min = Infinity,
        last = -1;
    const full = (1 << n) - 1;
    for (let i = 1; i < n; i++) {
        const cost = C[full][i] + haversine(points[i], points[0]);
        if (cost < min) {
            min = cost;
            last = i;
        }
    }

    // Reconstruct path
    const path = [];
    let mask = full,
        u = last;
    while (u !== -1) {
        path.unshift(points[u]);
        const prevU = prev[mask][u];
        mask ^= 1 << u;
        u = prevU;
    }
    path.unshift(points[0]);
    return path;
};