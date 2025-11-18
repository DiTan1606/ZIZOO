// src/services/amadeusService.js
/**
 * Service tích hợp Amadeus API để tìm vé máy bay thực tế
 */

// Backend proxy sẽ xử lý authentication
// Frontend chỉ cần gọi backend proxy

/**
 * Map tên thành phố Việt Nam sang IATA code
 */
const VIETNAM_AIRPORT_CODES = {
    'hà nội': 'HAN',
    'hanoi': 'HAN',
    'ha noi': 'HAN',
    'tp hồ chí minh': 'SGN',
    'hồ chí minh': 'SGN',
    'ho chi minh': 'SGN',
    'sài gòn': 'SGN',
    'saigon': 'SGN',
    'đà nẵng': 'DAD',
    'da nang': 'DAD',
    'danang': 'DAD',
    'nha trang': 'CXR',
    'phú quốc': 'PQC',
    'phu quoc': 'PQC',
    'đà lạt': 'DLI',
    'da lat': 'DLI',
    'dalat': 'DLI',
    'cần thơ': 'VCA',
    'can tho': 'VCA',
    'huế': 'HUI',
    'hue': 'HUI',
    'quy nhơn': 'UIH',
    'quy nhon': 'UIH',
    'pleiku': 'PXU',
    'buôn ma thuột': 'BMV',
    'buon ma thuot': 'BMV',
    'rạch giá': 'VKG',
    'rach gia': 'VKG',
    'côn đảo': 'VCS',
    'con dao': 'VCS',
    'cà mau': 'CAH',
    'ca mau': 'CAH',
    'vinh': 'VII',
    'thanh hóa': 'THD',
    'thanh hoa': 'THD',
    'điện biên': 'DIN',
    'dien bien': 'DIN'
};

/**
 * Lấy IATA code từ tên thành phố
 */
const getIATACode = (cityName) => {
    const normalized = cityName.toLowerCase().trim();
    return VIETNAM_AIRPORT_CODES[normalized] || null;
};

/**
 * Kiểm tra thành phố có sân bay không
 */
export const hasAirport = (cityName) => {
    return getIATACode(cityName) !== null;
};

/**
 * Tìm chuyến bay giữa 2 thành phố - GỌI QUA BACKEND PROXY
 */
export const searchFlights = async (origin, destination, departureDate, travelers = 1) => {
    try {
        console.log(`✈️ Searching flights: ${origin} → ${destination} on ${departureDate}`);

        // Lấy IATA codes
        const originCode = getIATACode(origin);
        const destinationCode = getIATACode(destination);

        if (!originCode || !destinationCode) {
            console.warn(`⚠️ No airport code found for ${origin} or ${destination}`);
            return null;
        }

        // Format date (YYYY-MM-DD)
        const formattedDate = new Date(departureDate).toISOString().split('T')[0];

        // Gọi BACKEND PROXY thay vì gọi trực tiếp Amadeus
        const backendUrl = `http://localhost:5000/api/flights?origin=${originCode}&destination=${destinationCode}&date=${formattedDate}&travelers=${travelers}`;
        
        console.log('📡 Calling backend proxy...');
        const response = await fetch(backendUrl);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend proxy error:', response.status, errorText);
            return null;
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            console.warn('⚠️ No flights found');
            return null;
        }

        // Parse và format kết quả
        const flights = data.data.map(offer => {
            const segment = offer.itineraries[0].segments[0];
            const priceUSD = parseFloat(offer.price.total);
            const currency = offer.price.currency;
            
            // Quy đổi sang VND
            // 1 USD ≈ 25,000 VND
            // 1 EUR ≈ 27,000 VND
            const exchangeRates = {
                'USD': 25000,
                'EUR': 27000,
                'VND': 1
            };
            
            const exchangeRate = exchangeRates[currency] || 25000; // Default USD nếu không biết
            
            // Amadeus trả về giá TỔNG cho tất cả hành khách
            const totalPriceVND = priceUSD * exchangeRate;
            const pricePerPersonVND = totalPriceVND / travelers;
            
            console.log(`💰 Flight: ${priceUSD} ${currency} x ${exchangeRate} = ${Math.round(totalPriceVND)} VND total (${Math.round(pricePerPersonVND)} VND/person for ${travelers} pax)`);

            return {
                airline: segment.carrierCode,
                flightNumber: `${segment.carrierCode}${segment.number}`,
                departure: {
                    airport: segment.departure.iataCode,
                    time: segment.departure.at
                },
                arrival: {
                    airport: segment.arrival.iataCode,
                    time: segment.arrival.at
                },
                duration: offer.itineraries[0].duration,
                price: Math.round(totalPriceVND), // Tổng giá cho tất cả hành khách
                pricePerPerson: Math.round(pricePerPersonVND), // Giá mỗi người
                priceUSD: priceUSD,
                currency: 'VND',
                originalCurrency: currency,
                bookingClass: offer.travelerPricings[0].fareDetailsBySegment[0].cabin,
                availableSeats: offer.numberOfBookableSeats
            };
        });

        console.log(`✅ Found ${flights.length} flights from backend`);
        console.log('🔍 First flight details:', JSON.stringify(flights[0], null, 2));
        return flights;

    } catch (error) {
        console.error('❌ Error searching flights:', error);
        return null;
    }
};

/**
 * Lấy giá vé máy bay trung bình (fallback nếu API fail)
 */
export const getEstimatedFlightPrice = (origin, destination, travelers = 1) => {
    // Giá ước tính dựa trên khoảng cách và tuyến phổ biến
    const routes = {
        'HAN-SGN': 1200000,
        'SGN-HAN': 1200000,
        'HAN-DAD': 800000,
        'DAD-HAN': 800000,
        'HAN-PQC': 1500000,
        'PQC-HAN': 1500000,
        'SGN-PQC': 900000,
        'PQC-SGN': 900000,
        'HAN-CXR': 1000000,
        'CXR-HAN': 1000000,
        'SGN-CXR': 700000,
        'CXR-SGN': 700000,
        'HAN-DLI': 900000,
        'DLI-HAN': 900000,
        'SGN-DAD': 800000,
        'DAD-SGN': 800000
    };

    const originCode = getIATACode(origin);
    const destCode = getIATACode(destination);
    
    if (!originCode || !destCode) return null;

    const routeKey = `${originCode}-${destCode}`;
    const basePrice = routes[routeKey] || 1000000; // Default 1M VND

    return {
        pricePerPerson: basePrice,
        totalPrice: basePrice * travelers,
        estimated: true
    };
};

/**
 * Format duration từ ISO 8601 (PT2H30M) sang text dễ đọc
 */
export const formatDuration = (isoDuration) => {
    if (!isoDuration) return 'N/A';
    
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?/);
    if (!match) return isoDuration;

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;

    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    if (minutes) return `${minutes}m`;
    return 'N/A';
};

export default {
    searchFlights,
    getEstimatedFlightPrice,
    formatDuration,
    getIATACode,
    hasAirport
};
