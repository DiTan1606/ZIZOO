// Weather Safety Service - Kết hợp OpenWeatherMap + TomTom
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, updateDoc, doc } from 'firebase/firestore';

const OPM_API_KEY = process.env.REACT_APP_OPM_API_KEY;
const TOMTOM_API_KEY = process.env.REACT_APP_TOMTOM_API_KEY;

// Định nghĩa các tuyến đường quan trọng
const CRITICAL_ROUTES = {
  'Đà Lạt': {
    name: 'Đà Lạt',
    routes: [
      { 
        name: 'Đèo Prenn (QL20)', 
        coords: { lat: 11.9057, lng: 108.4480 }, // Tọa độ chính xác từ TomTom
        type: 'mountain_pass',
        importance: 'critical',
        description: 'Tuyến đường chính từ TP.HCM/Phan Thiết - QL20'
      },
      { 
        name: 'Cao tốc Liên Khương-Prenn', 
        coords: { lat: 11.8733, lng: 108.4673 }, // Tọa độ từ TomTom
        type: 'highway',
        importance: 'critical',
        description: 'Cao tốc mới nối Liên Khương - Prenn'
      },
      { 
        name: 'Đèo Mimosa (Đèo Bảo Lộc)', 
        coords: { lat: 11.5500, lng: 107.8000 },
        type: 'mountain_pass',
        importance: 'critical',
        description: 'Tuyến đường chính từ TP.HCM qua Bảo Lộc'
      }
    ]
  },
  'Sapa': {
    name: 'Sapa',
    routes: [
      { 
        name: 'Đèo Ô Quy Hồ', 
        coords: { lat: 22.3333, lng: 103.7833 },
        type: 'mountain_pass',
        importance: 'critical',
        description: 'Đèo dài và nguy hiểm nhất Việt Nam'
      }
    ]
  },
  'Hà Giang': {
    name: 'Hà Giang',
    routes: [
      { 
        name: 'Đèo Mã Pì Lèng', 
        coords: { lat: 23.1333, lng: 105.3167 },
        type: 'mountain_pass',
        importance: 'critical',
        description: 'Đèo nguy hiểm, thường xuyên sạt lở'
      }
    ]
  },
  'Đà Nẵng': {
    name: 'Đà Nẵng',
    routes: [
      { 
        name: 'Đèo Hải Vân', 
        coords: { lat: 16.2000, lng: 108.1167 },
        type: 'mountain_pass',
        importance: 'high',
        description: 'Đèo nối Đà Nẵng - Huế'
      }
    ]
  }
};

// Trạng thái an toàn
export const SAFETY_STATUS = {
  SAFE: {
    value: 'SAFE',
    icon: '✅',
    color: '#10b981',
    label: 'An toàn',
    priority: 0
  },
  CAUTION: {
    value: 'CAUTION',
    icon: '⚠️',
    color: '#f59e0b',
    label: 'Cân nhắc',
    priority: 1
  },
  WARNING: {
    value: 'WARNING',
    icon: '🔴',
    color: '#ef4444',
    label: 'Không nên đi',
    priority: 2
  },
  DANGER: {
    value: 'DANGER',
    icon: '🚨',
    color: '#991b1b',
    label: 'Nguy hiểm',
    priority: 3
  }
};

// Check khu vực đèo Đà Lạt (Prenn & Mimosa) - Giống Python code
const checkDalatPassesArea = async () => {
  try {
    // Bbox bao trùm khu vực phía Nam Đà Lạt (Đèo Prenn & Mimosa)
    const BBOX_PASSES = "108.42,11.85,108.50,11.95";
    
    console.log(`🔍 Quét radar khu vực ĐÈO PRENN & MIMOSA với bbox: ${BBOX_PASSES}`);
    
    const res = await fetch(
      `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${BBOX_PASSES}&key=${TOMTOM_API_KEY}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,events{description}}}}&language=vi-VN&t=${Date.now()}`
    );
    
    if (!res.ok) {
      console.error(`TomTom API error:`, res.status);
      return {
        hasCriticalRoutes: true,
        totalRoutes: 2,
        openRoutes: 2,
        closedRoutes: 0,
        criticalRoutesClosed: 0,
        routes: [
          { name: 'Đèo Prenn', isOpen: true, incidents: 0, details: [], error: `API error: ${res.status}` },
          { name: 'Đèo Mimosa', isOpen: true, incidents: 0, details: [], error: `API error: ${res.status}` }
        ],
        allCriticalClosed: false
      };
    }
    
    const data = await res.json();
    const incidents = data.incidents || [];
    
    console.log(`📊 Tìm thấy ${incidents.length} sự cố trong khu vực đèo`);
    
    // Lọc sự cố nghiêm trọng trên đèo: 6=Tắc, 8=Đóng, 9=Thi công
    const prennIncidents = [];
    const mimosaIncidents = [];
    
    incidents.forEach(incident => {
      const cat = incident.properties.iconCategory;
      
      // Chỉ quan tâm sự cố nghiêm trọng
      if (cat === 6 || cat === 8 || cat === 9) {
        const coords = incident.geometry.coordinates;
        const point = Array.isArray(coords[0]) ? coords[0] : coords;
        const desc = incident.properties.events?.[0]?.description || 'Closed';
        
        // Phân loại theo vị trí (Prenn ở phía Bắc, Mimosa ở phía Nam)
        if (point[1] > 11.90) {
          // Đèo Prenn (lat > 11.90)
          prennIncidents.push({
            category: cat,
            description: desc,
            coords: point
          });
          console.log(`🚨 Đèo Prenn: ${desc} (category: ${cat})`);
        } else if (point[1] < 11.90 && point[1] > 11.85) {
          // Đèo Mimosa (11.85 < lat < 11.90)
          mimosaIncidents.push({
            category: cat,
            description: desc,
            coords: point
          });
          console.log(`🚨 Đèo Mimosa: ${desc} (category: ${cat})`);
        }
      }
    });
    
    const prennOpen = prennIncidents.length === 0;
    const mimosaOpen = mimosaIncidents.length === 0;
    
    console.log(`${prennOpen ? '✅' : '🚫'} Đèo Prenn: ${prennOpen ? 'OPEN' : 'CLOSED'} (${prennIncidents.length} incidents)`);
    console.log(`${mimosaOpen ? '✅' : '🚫'} Đèo Mimosa: ${mimosaOpen ? 'OPEN' : 'CLOSED'} (${mimosaIncidents.length} incidents)`);
    
    const routes = [
      {
        name: 'Đèo Prenn (QL20)',
        type: 'mountain_pass',
        importance: 'critical',
        description: 'Tuyến đường chính từ TP.HCM/Phan Thiết',
        isOpen: prennOpen,
        incidents: prennIncidents.length,
        details: prennIncidents
      },
      {
        name: 'Đèo Mimosa (Bảo Lộc)',
        type: 'mountain_pass',
        importance: 'critical',
        description: 'Tuyến đường chính từ TP.HCM qua Bảo Lộc',
        isOpen: mimosaOpen,
        incidents: mimosaIncidents.length,
        details: mimosaIncidents
      }
    ];
    
    const closedRoutes = routes.filter(r => !r.isOpen);
    const criticalClosed = closedRoutes.filter(r => r.importance === 'critical');
    
    return {
      hasCriticalRoutes: true,
      totalRoutes: 2,
      openRoutes: routes.filter(r => r.isOpen).length,
      closedRoutes: closedRoutes.length,
      criticalRoutesClosed: criticalClosed.length,
      routes,
      allCriticalClosed: criticalClosed.length === 2 // Cả 2 đèo đều đóng
    };
    
  } catch (error) {
    console.error('Error checking Đà Lạt passes:', error);
    return {
      hasCriticalRoutes: true,
      totalRoutes: 2,
      openRoutes: 2,
      closedRoutes: 0,
      criticalRoutesClosed: 0,
      routes: [
        { name: 'Đèo Prenn', isOpen: true, incidents: 0, details: [], error: error.message },
        { name: 'Đèo Mimosa', isOpen: true, incidents: 0, details: [], error: error.message }
      ],
      allCriticalClosed: false
    };
  }
};

// Lấy thời tiết từ OpenWeatherMap
export const getWeatherData = async (lat, lng) => {
  try {
    // Current weather
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OPM_API_KEY}&units=metric&lang=vi`
    );
    const current = await currentRes.json();

    // Forecast 5 days
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${OPM_API_KEY}&units=metric&lang=vi`
    );
    const forecast = await forecastRes.json();

    return {
      current: {
        temp: current.main.temp,
        feelsLike: current.main.feels_like,
        humidity: current.main.humidity,
        rain: current.rain?.['1h'] || 0,
        wind: current.wind.speed,
        condition: current.weather[0].main,
        description: current.weather[0].description,
        icon: current.weather[0].icon
      },
      forecast: forecast.list.slice(0, 40).map(f => ({
        date: new Date(f.dt * 1000),
        temp: f.main.temp,
        rain: f.rain?.['3h'] || 0,
        wind: f.wind.speed,
        condition: f.weather[0].main,
        description: f.weather[0].description,
        icon: f.weather[0].icon,
        pop: f.pop
      }))
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
};

// Phân tích traffic dùng TomTom Traffic API
// Kiểm tra incidents (kẹt xe, đóng đường, thi công) trong khu vực
export const analyzeTrafficIncidents = async (lat, lng, weather, destinationName) => {
  try {
    console.log(`🚗 Analyzing traffic for ${destinationName} using TomTom API...`);
    
    const byReason = {
      weather: [],
      construction: [],
      accident: [],
      roadClosed: [],
      other: []
    };
    
    const critical = [];
    
    // Tạo bbox bao quanh destination (±0.2 độ ~ 20km)
    const bboxSize = 0.2;
    const bbox = `${lng - bboxSize},${lat - bboxSize},${lng + bboxSize},${lat + bboxSize}`;
    
    console.log(`🔍 Checking TomTom traffic incidents in bbox: ${bbox}`);
    
    try {
      const res = await fetch(
        `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&key=${TOMTOM_API_KEY}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code}}}}&language=vi-VN&t=${Date.now()}`
      );
      
      if (!res.ok) {
        console.error(`TomTom API error: ${res.status}`);
      } else {
        const data = await res.json();
        const incidents = data.incidents || [];
        
        console.log(`📊 Found ${incidents.length} traffic incidents in ${destinationName} area`);
        
        // Phân loại incidents theo category
        incidents.forEach(incident => {
          const cat = incident.properties.iconCategory;
          const desc = incident.properties.events?.[0]?.description || 'Sự cố giao thông';
          const code = incident.properties.events?.[0]?.code || '';
          const delay = incident.properties.magnitudeOfDelay || 0;
          
          const incidentData = {
            category: cat,
            categoryName: getCategoryName(cat),
            description: desc,
            delay,
            code
          };
          
          // Phân loại theo category
          // 0: Unknown, 1: Accident, 2: Fog, 3: Dangerous Conditions, 4: Rain
          // 5: Ice, 6: Jam, 7: Lane Closed, 8: Road Closed, 9: Road Works
          // 10: Wind, 11: Flooding, 14: Broken Down Vehicle
          
          if (cat === 8) {
            // Đóng đường
            incidentData.severity = 'critical';
            critical.push(incidentData);
            byReason.roadClosed.push(incidentData);
            console.log(`🚫 Road closed: ${desc}`);
          } else if (cat === 9) {
            // Thi công
            critical.push(incidentData);
            byReason.construction.push(incidentData);
            console.log(`🚧 Construction: ${desc}`);
          } else if (cat === 6 && delay > 600) {
            // Tắc đường nghiêm trọng (>10 phút)
            incidentData.severity = 'high';
            critical.push(incidentData);
            byReason.roadClosed.push(incidentData);
            console.log(`🚗 Heavy traffic jam (${delay}s delay): ${desc}`);
          } else if (cat === 1) {
            // Tai nạn
            critical.push(incidentData);
            byReason.accident.push(incidentData);
            console.log(`🚨 Accident: ${desc}`);
          } else if (cat === 4 || cat === 11) {
            // Mưa hoặc ngập lụt
            incidentData.severity = 'high';
            critical.push(incidentData);
            byReason.weather.push(incidentData);
            console.log(`🌧️ Weather incident: ${desc}`);
          } else if (cat === 3) {
            // Điều kiện nguy hiểm
            incidentData.severity = 'high';
            critical.push(incidentData);
            byReason.other.push(incidentData);
            console.log(`⚠️ Dangerous conditions: ${desc}`);
          } else if (cat === 7) {
            // Đóng làn đường
            critical.push(incidentData);
            byReason.other.push(incidentData);
            console.log(`⚠️ Lane closed: ${desc}`);
          }
        });
      }
    } catch (apiError) {
      console.error('❌ TomTom API error:', apiError);
    }
    
    // Kiểm tra điều kiện thời tiết nguy hiểm
    const currentRain = weather?.current?.rain || 0;
    const hasHeavyRain = currentRain > 50; // >50mm = mưa lớn
    const hasModerateRain = currentRain > 20; // >20mm = mưa vừa
    
    // Danh sách địa điểm có đèo/núi nguy hiểm
    const mountainousAreas = ['đà lạt', 'da lat', 'sapa', 'sa pa', 'hà giang', 'ha giang', 'cao bằng', 'cao bang'];
    const isMountainous = mountainousAreas.some(area => destinationName.toLowerCase().includes(area));
    
    // Cảnh báo đặc biệt cho Đà Lạt (đèo Prenn & Mimosa)
    const isDalat = destinationName.toLowerCase().includes('đà lạt') || destinationName.toLowerCase().includes('da lat');
    if (isDalat) {
      // Luôn cảnh báo cho Đà Lạt vì đèo nguy hiểm
      if (hasHeavyRain) {
        const warning = {
          category: 8,
          categoryName: 'Đèo nguy hiểm',
          description: '🚨 Đèo Prenn & Mimosa rất nguy hiểm khi mưa lớn. Có thể bị sạt lở!',
          reason: 'dalat_pass_heavy_rain',
          severity: 'critical'
        };
        critical.push(warning);
        byReason.weather.push(warning);
        console.log(`🚨 CRITICAL: Đà Lạt passes dangerous with heavy rain (${currentRain}mm)`);
      } else if (hasModerateRain) {
        const warning = {
          category: 6,
          categoryName: 'Cảnh báo đèo',
          description: '⚠️ Đèo Prenn & Mimosa trơn trượt khi mưa. Cần cẩn thận!',
          reason: 'dalat_pass_moderate_rain'
        };
        critical.push(warning);
        byReason.weather.push(warning);
        console.log(`⚠️ WARNING: Đà Lạt passes slippery with rain (${currentRain}mm)`);
      } else {
        // Cảnh báo chung cho Đà Lạt (luôn có đèo)
        const warning = {
          category: 6,
          categoryName: 'Thông tin đường đi',
          description: 'ℹ️ Đường vào Đà Lạt có đèo Prenn & Mimosa. Nên kiểm tra tình trạng đường trước khi đi.',
          reason: 'dalat_pass_info'
        };
        critical.push(warning);
        byReason.other.push(warning);
        console.log(`ℹ️ INFO: Đà Lạt has mountain passes`);
      }
    }
    // Cảnh báo đường đèo nguy hiểm khi mưa (các địa điểm khác)
    else if (isMountainous && hasHeavyRain) {
      const warning = {
        category: 8,
        categoryName: 'Đóng đường do thời tiết',
        description: 'Đèo có thể bị sạt lở do mưa lớn',
        reason: 'heavy_rain_mountain'
      };
      critical.push(warning);
      byReason.weather.push(warning);
      
      console.log(`⚠️ Mountain pass warning: Heavy rain (${currentRain}mm) in ${destinationName}`);
    } else if (isMountainous && hasModerateRain) {
      const warning = {
        category: 6,
        categoryName: 'Cảnh báo đường đèo',
        description: 'Đường đèo có thể trơn trượt do mưa',
        reason: 'moderate_rain_mountain'
      };
      critical.push(warning);
      byReason.weather.push(warning);
      
      console.log(`⚠️ Mountain pass caution: Moderate rain (${currentRain}mm) in ${destinationName}`);
    }
    
    // Cảnh báo ngập lụt cho vùng thấp
    const lowlandAreas = ['cần thơ', 'can tho', 'đồng tháp', 'dong thap', 'an giang', 'bạc liêu', 'bac lieu'];
    const isLowland = lowlandAreas.some(area => destinationName.toLowerCase().includes(area));
    
    if (isLowland && hasHeavyRain) {
      const warning = {
        category: 8,
        categoryName: 'Nguy cơ ngập lụt',
        description: 'Đường có thể bị ngập do mưa lớn',
        reason: 'flooding_risk'
      };
      critical.push(warning);
      byReason.weather.push(warning);
      
      console.log(`⚠️ Flooding risk: Heavy rain (${currentRain}mm) in lowland ${destinationName}`);
    }
    
    const hasCriticalIssues = byReason.roadClosed.length > 0 || byReason.weather.length > 0;
    
    console.log(`🚨 Traffic analysis result:`, {
      total: critical.length,
      roadClosed: byReason.roadClosed.length,
      weather: byReason.weather.length,
      hasCriticalIssues,
      isMountainous,
      isLowland,
      currentRain: `${currentRain}mm`
    });
    
    return {
      total: critical.length,
      critical,
      byReason,
      hasCriticalIssues
    };
  } catch (error) {
    console.error('Error analyzing traffic:', error);
    return { 
      total: 0, 
      critical: [],
      byReason: {},
      hasCriticalIssues: false 
    };
  }
};

// Helper: Tên category
const getCategoryName = (category) => {
  const names = {
    6: 'Tắc đường nghiêm trọng',
    8: 'Đóng đường',
    9: 'Thi công'
  };
  return names[category] || `Category ${category}`;
};

// Legacy function for backward compatibility
export const getTrafficIncidents = async (lat, lng) => {
  const analysis = await analyzeTrafficIncidents(lat, lng);
  return {
    total: analysis.total,
    roadsClosed: analysis.critical.length,
    incidents: analysis.critical.map(i => ({
      type: i.category === 8 ? 'ROAD_CLOSED' : 'ROAD_BLOCKED',
      description: i.description,
      category: i.category
    }))
  };
};

// Check các tuyến đường quan trọng
export const checkCriticalRoutes = async (destinationName) => {
  const destination = CRITICAL_ROUTES[destinationName];
  if (!destination) {
    return { hasCriticalRoutes: false, routes: [] };
  }

  // Nếu là Đà Lạt, quét toàn bộ khu vực đèo (giống Python code)
  if (destinationName === 'Đà Lạt') {
    return await checkDalatPassesArea();
  }

  const routeStatus = await Promise.all(
    destination.routes.map(async (route) => {
      try {
        // Dùng bbox nhỏ hơn, tập trung vào khu vực đèo (±0.05 độ ~ 5km)
        const bbox = `${route.coords.lng - 0.05},${route.coords.lat - 0.05},${route.coords.lng + 0.05},${route.coords.lat + 0.05}`;
        
        console.log(`🔍 Checking ${route.name} with bbox: ${bbox}`);
        
        const res = await fetch(
          `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&key=${TOMTOM_API_KEY}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description}}}}&language=vi-VN&t=${Date.now()}`
        );
        
        if (!res.ok) {
          console.error(`TomTom API error for ${route.name}:`, res.status);
          return {
            name: route.name,
            type: route.type,
            importance: route.importance,
            description: route.description,
            isOpen: true,
            incidents: 0,
            details: [],
            error: `API error: ${res.status}`
          };
        }
        
        const data = await res.json();
        const incidents = data.incidents || [];
        
        console.log(`📊 ${route.name}: Found ${incidents.length} incidents`);

        // Lọc sự cố nghiêm trọng: 6=Tắc nghiêm trọng, 8=Đóng đường, 9=Thi công
        const criticalIncidents = incidents.filter(i => {
          const cat = i.properties.iconCategory;
          const isCritical = cat === 6 || cat === 8 || cat === 9;
          
          if (isCritical) {
            console.log(`🚨 Critical incident on ${route.name}:`, {
              category: cat,
              description: i.properties.events?.[0]?.description || 'No description'
            });
          }
          
          return isCritical;
        });

        const isOpen = criticalIncidents.length === 0;
        
        console.log(`${isOpen ? '✅' : '🚫'} ${route.name}: ${isOpen ? 'OPEN' : 'CLOSED'} (${criticalIncidents.length} critical incidents)`);

        return {
          name: route.name,
          type: route.type,
          importance: route.importance,
          description: route.description,
          isOpen,
          incidents: criticalIncidents.length,
          details: criticalIncidents.map(i => ({
            category: i.properties.iconCategory,
            description: i.properties.events?.[0]?.description || 'Closed',
            delay: i.properties.magnitudeOfDelay || 0,
            coords: i.geometry.coordinates
          }))
        };
      } catch (error) {
        console.error(`Error checking route ${route.name}:`, error);
        return {
          name: route.name,
          type: route.type,
          importance: route.importance,
          isOpen: true, // Assume open if can't check
          incidents: 0,
          details: [],
          error: error.message
        };
      }
    })
  );

  const criticalRoutesClosed = routeStatus.filter(r => 
    !r.isOpen && r.importance === 'critical'
  );

  return {
    hasCriticalRoutes: true,
    totalRoutes: routeStatus.length,
    openRoutes: routeStatus.filter(r => r.isOpen).length,
    closedRoutes: routeStatus.filter(r => !r.isOpen).length,
    criticalRoutesClosed: criticalRoutesClosed.length,
    routes: routeStatus,
    allCriticalClosed: criticalRoutesClosed.length === routeStatus.filter(r => r.importance === 'critical').length
  };
};

// Phân tích an toàn chuyến đi
export const analyzeTripSafety = async (trip) => {
  const daysUntil = getDaysUntil(trip.startDate);
  
  // Kiểm tra startDate hợp lệ
  if (isNaN(daysUntil)) {
    console.error('❌ Invalid trip.startDate:', trip.startDate);
    return null;
  }
  
  // Chỉ phân tích khi ≤ 14 ngày
  if (daysUntil > 14) {
    console.log(`⏭️ Trip is ${daysUntil} days away, skipping analysis (only analyze ≤14 days)`);
    return null;
  }

  // Lấy tọa độ destination
  const { lat, lng } = await getDestinationCoords(trip.destination);
  const destinationName = typeof trip.destination === 'string' ? trip.destination : trip.destination.name;
  
  // Tính số ngày của chuyến đi
  const tripDuration = calculateTripDuration(trip.startDate, trip.endDate);
  
  console.log('🔍 Analyzing trip:', {
    destination: destinationName,
    startDate: trip.startDate,
    endDate: trip.endDate,
    duration: tripDuration,
    daysUntil
  });
  
  // Lấy dữ liệu
  const weather = await getWeatherData(lat, lng);
  
  // Phân tích traffic cho TẤT CẢ điểm đến (dựa trên thời tiết)
  // Không cần API traffic, phân tích thông minh dựa trên weather + địa hình
  const shouldCheckTraffic = !isNaN(daysUntil) && daysUntil <= 7;
  const trafficAnalysis = shouldCheckTraffic ? await analyzeTrafficIncidents(lat, lng, weather, destinationName) : { 
    total: 0, 
    critical: [],
    byReason: {},
    hasCriticalIssues: false 
  };
  
  console.log(`🛣️ Traffic analysis: ${shouldCheckTraffic ? 'YES (Weather-based)' : 'DISABLED (trip > 7 days)'} (destination: "${destinationName}", daysUntil: ${daysUntil})`);

  if (!weather) return null;

  // Phân tích thời tiết cho TOÀN BỘ chuyến đi
  const tripWeatherAnalysis = analyzeTripWeather(trip, weather);
  
  // Tìm thời tiết ngày đi - TỔNG HỢP CẢ NGÀY
  // Parse startDate (có thể là DD/MM/YYYY hoặc ISO)
  let tripDate;
  if (typeof trip.startDate === 'string' && trip.startDate.includes('/')) {
    const parts = trip.startDate.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      tripDate = new Date(isoDate);
    } else {
      tripDate = new Date(trip.startDate);
    }
  } else {
    tripDate = new Date(trip.startDate);
  }
  
  if (isNaN(tripDate.getTime())) {
    console.error(`❌ Invalid trip date: ${trip.startDate}`);
    return null;
  }
  
  tripDate.setHours(0, 0, 0, 0); // Reset về đầu ngày để so sánh chính xác
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const isToday = tripDate.getTime() === now.getTime();
  
  console.log(`📅 Trip date: ${tripDate.toLocaleDateString('vi-VN')} (${trip.startDate}), Is today: ${isToday}`);
  
  let tripDay;
  
  // Nếu ngày đi là HÔM NAY, dùng thời tiết hiện tại
  if (isToday) {
    console.log('⚠️ Trip is TODAY, using current weather for trip day');
    tripDay = {
      date: tripDate,
      temp: Math.round(weather.current.temp),
      rain: Math.round(weather.current.rain || 0),
      wind: Math.round(weather.current.wind),
      condition: weather.current.condition,
      description: weather.current.description,
      icon: weather.current.icon,
      isToday: true
    };
  } else {
    // Lọc tất cả forecast của ngày đi (so sánh theo ngày, không quan tâm giờ)
    const sameDayForecasts = weather.forecast.filter(f => {
      const forecastDate = new Date(f.date);
      forecastDate.setHours(0, 0, 0, 0);
      return forecastDate.getTime() === tripDate.getTime();
    });
    
    if (sameDayForecasts.length > 0) {
      // Tổng hợp dữ liệu cả ngày
      const totalRain = sameDayForecasts.reduce((sum, f) => sum + (f.rain || 0), 0);
      const avgTemp = sameDayForecasts.reduce((sum, f) => sum + f.temp, 0) / sameDayForecasts.length;
      const maxWind = Math.max(...sameDayForecasts.map(f => f.wind));
      
      // Tìm condition phổ biến nhất trong ngày
      const conditions = sameDayForecasts.map(f => f.condition);
      const mostCommonCondition = conditions.sort((a, b) =>
        conditions.filter(c => c === a).length - conditions.filter(c => c === b).length
      ).pop();
      
      // Tìm icon đại diện (ưu tiên icon có mưa nếu có mưa)
      const hasRain = sameDayForecasts.some(f => f.condition.includes('Rain') || f.rain > 0);
      const representativeIcon = hasRain 
        ? sameDayForecasts.find(f => f.condition.includes('Rain') || f.rain > 0)?.icon
        : sameDayForecasts[Math.floor(sameDayForecasts.length / 2)]?.icon;
      
      tripDay = {
        date: tripDate,
        temp: Math.round(avgTemp),
        rain: Math.round(totalRain),
        wind: Math.round(maxWind),
        condition: mostCommonCondition,
        description: hasRain ? 'có mưa' : sameDayForecasts[0].description,
        icon: representativeIcon || sameDayForecasts[0].icon,
        isAggregated: true // Đánh dấu là dữ liệu tổng hợp
      };
      
      console.log(`📊 Aggregated ${sameDayForecasts.length} forecasts for trip day (${tripDate.toLocaleDateString('vi-VN')}):`, {
        avgTemp: tripDay.temp,
        totalRain: tripDay.rain,
        maxWind: tripDay.wind
      });
    } else if (weather.forecast.length > 0) {
      // Nếu không có forecast của ngày đi, lấy ngày gần nhất (nhưng KHÔNG phải hôm nay)
      const futureForecasts = weather.forecast.filter(f => {
        const forecastDate = new Date(f.date);
        forecastDate.setHours(0, 0, 0, 0);
        return forecastDate.getTime() >= tripDate.getTime();
      });
      
      if (futureForecasts.length > 0) {
        tripDay = futureForecasts[0];
        console.log(`⚠️ Using closest future forecast for trip day: ${new Date(tripDay.date).toLocaleDateString('vi-VN')}`);
      } else {
        // Fallback: lấy forecast cuối cùng
        tripDay = weather.forecast[weather.forecast.length - 1];
        console.log('⚠️ Using last available forecast for trip day');
      }
    }
  }

  // Tính điểm an toàn
  let score = 100;
  const issues = [];

  // CẢNH BÁO ĐẶC BIỆT: Mưa liên tục suốt chuyến đi
  if (tripWeatherAnalysis.rainyDaysCount > 0) {
    const rainyPercentage = (tripWeatherAnalysis.rainyDaysCount / tripWeatherAnalysis.totalDays) * 100;
    const avgRain = tripWeatherAnalysis.avgRainPerDay;
    
    // Phân loại mức độ mưa dựa trên lượng mưa trung bình
    let rainIntensity = 'light'; // Mặc định: mưa nhỏ
    if (avgRain > 50) {
      rainIntensity = 'heavy'; // Mưa lớn
    } else if (avgRain > 20) {
      rainIntensity = 'moderate'; // Mưa vừa
    }
    
    if (rainyPercentage === 100) {
      // TẤT CẢ các ngày đều mưa
      let scoreDeduction = 20; // Mặc định cho mưa nhỏ
      let severity = 'medium';
      
      if (rainIntensity === 'heavy') {
        scoreDeduction = 50;
        severity = 'critical';
        console.log(`🌧️🌧️🌧️ CRITICAL: Mưa LỚN SUỐT ${tripWeatherAnalysis.totalDays} ngày (${avgRain}mm/ngày)!`);
      } else if (rainIntensity === 'moderate') {
        scoreDeduction = 35;
        severity = 'high';
        console.log(`🌧️🌧️ HIGH: Mưa VỪA SUỐT ${tripWeatherAnalysis.totalDays} ngày (${avgRain}mm/ngày)`);
      } else {
        console.log(`🌧️ MEDIUM: Mưa NHỎ SUỐT ${tripWeatherAnalysis.totalDays} ngày (${avgRain}mm/ngày)`);
      }
      
      score -= scoreDeduction;
      issues.push({ 
        type: 'continuous_rain_all_days', 
        severity,
        rainIntensity,
        rainyDays: tripWeatherAnalysis.rainyDaysCount,
        totalDays: tripWeatherAnalysis.totalDays,
        avgRain
      });
    } else if (rainyPercentage >= 70) {
      // Hơn 70% số ngày có mưa
      let scoreDeduction = 15;
      let severity = 'medium';
      
      if (rainIntensity === 'heavy') {
        scoreDeduction = 35;
        severity = 'high';
        console.log(`🌧️🌧️ HIGH: Mưa LỚN ${tripWeatherAnalysis.rainyDaysCount}/${tripWeatherAnalysis.totalDays} ngày (${avgRain}mm/ngày)`);
      } else if (rainIntensity === 'moderate') {
        scoreDeduction = 25;
        severity = 'medium';
        console.log(`🌧️ MEDIUM: Mưa VỪA ${tripWeatherAnalysis.rainyDaysCount}/${tripWeatherAnalysis.totalDays} ngày (${avgRain}mm/ngày)`);
      } else {
        console.log(`🌧️ LOW: Mưa NHỎ ${tripWeatherAnalysis.rainyDaysCount}/${tripWeatherAnalysis.totalDays} ngày (${avgRain}mm/ngày)`);
      }
      
      score -= scoreDeduction;
      issues.push({ 
        type: 'continuous_rain_most_days', 
        severity,
        rainIntensity,
        rainyDays: tripWeatherAnalysis.rainyDaysCount,
        totalDays: tripWeatherAnalysis.totalDays,
        avgRain
      });
    } else if (rainyPercentage >= 50) {
      // Khoảng nửa chuyến đi có mưa
      let scoreDeduction = 10;
      let severity = 'low';
      
      if (rainIntensity === 'heavy') {
        scoreDeduction = 20;
        severity = 'medium';
        console.log(`🌧️ MEDIUM: Mưa LỚN ${tripWeatherAnalysis.rainyDaysCount}/${tripWeatherAnalysis.totalDays} ngày (${avgRain}mm/ngày)`);
      } else if (rainIntensity === 'moderate') {
        scoreDeduction = 15;
        severity = 'low';
        console.log(`🌧️ LOW: Mưa VỪA ${tripWeatherAnalysis.rainyDaysCount}/${tripWeatherAnalysis.totalDays} ngày (${avgRain}mm/ngày)`);
      } else {
        console.log(`ℹ️ INFO: Mưa NHỎ ${tripWeatherAnalysis.rainyDaysCount}/${tripWeatherAnalysis.totalDays} ngày (${avgRain}mm/ngày)`);
      }
      
      score -= scoreDeduction;
      issues.push({ 
        type: 'frequent_rain', 
        severity,
        rainIntensity,
        rainyDays: tripWeatherAnalysis.rainyDaysCount,
        totalDays: tripWeatherAnalysis.totalDays,
        avgRain
      });
    }
  }

  // Phân tích thời tiết hiện tại
  if (weather.current.rain > 100) {
    score -= 25;
    issues.push({ type: 'current_heavy_rain', severity: 'high' });
  } else if (weather.current.rain > 50) {
    score -= 10;
    issues.push({ type: 'current_rain', severity: 'medium' });
  }

  // Phân tích thời tiết ngày đi
  if (tripDay) {
    if (tripDay.rain > 100) {
      score -= 30;
      issues.push({ type: 'heavy_rain_forecast', severity: 'critical' });
    } else if (tripDay.rain > 50) {
      score -= 15;
      issues.push({ type: 'rain_forecast', severity: 'high' });
    }

    if (tripDay.wind > 60) {
      score -= 25;
      issues.push({ type: 'strong_wind', severity: 'high' });
    } else if (tripDay.wind > 40) {
      score -= 10;
      issues.push({ type: 'moderate_wind', severity: 'medium' });
    }

    if (tripDay.temp > 38 || tripDay.temp < 5) {
      score -= 15;
      issues.push({ type: 'extreme_temp', severity: 'medium' });
    }
  }

  // Kiểm tra critical routes (đèo, đường chính)
  const criticalRoutesCheck = await checkCriticalRoutes(destinationName);
  
  if (criticalRoutesCheck.hasCriticalRoutes) {
    console.log(`🛣️ Critical routes check for ${destinationName}:`, {
      total: criticalRoutesCheck.totalRoutes,
      open: criticalRoutesCheck.openRoutes,
      closed: criticalRoutesCheck.closedRoutes,
      criticalClosed: criticalRoutesCheck.criticalRoutesClosed
    });
    
    // CHỈ cảnh báo nghiêm trọng khi TẤT CẢ đường chính đều đóng
    if (criticalRoutesCheck.allCriticalClosed) {
      score -= 50;
      issues.push({
        type: 'all_critical_routes_closed',
        severity: 'critical',
        routes: criticalRoutesCheck.routes.filter(r => !r.isOpen && r.importance === 'critical')
      });
      console.log(`🚫 CRITICAL: TẤT CẢ đường chính đều đóng!`);
    } 
    // Một số đường chính bị đóng → Cảnh báo THÔNG TIN (không trừ điểm nhiều)
    else if (criticalRoutesCheck.criticalRoutesClosed > 0) {
      score -= 5; // Chỉ trừ 5 điểm (nhẹ)
      issues.push({
        type: 'some_critical_routes_closed',
        severity: 'info', // Đổi từ 'high' sang 'info'
        routes: criticalRoutesCheck.routes.filter(r => !r.isOpen && r.importance === 'critical')
      });
      console.log(`ℹ️ INFO: ${criticalRoutesCheck.criticalRoutesClosed} đường chính bị đóng (còn đường khác)`);
    }
    // Đường phụ bị đóng → Chỉ thông tin
    else if (criticalRoutesCheck.closedRoutes > 0) {
      score -= 3; // Trừ rất ít
      issues.push({
        type: 'secondary_routes_closed',
        severity: 'info',
        routes: criticalRoutesCheck.routes.filter(r => !r.isOpen)
      });
      console.log(`ℹ️ INFO: ${criticalRoutesCheck.closedRoutes} đường phụ bị đóng`);
    }
  }
  
  // Phân tích giao thông THÔNG MINH (cho tất cả điểm đến)
  if (trafficAnalysis.hasCriticalIssues) {
    // Đường đóng do thời tiết → NGHIÊM TRỌNG
    if (trafficAnalysis.byReason.weather && trafficAnalysis.byReason.weather.length > 0) {
      score -= 40;
      issues.push({
        type: 'weather_road_closure',
        severity: 'critical',
        count: trafficAnalysis.byReason.weather.length,
        details: trafficAnalysis.byReason.weather
      });
    }
    
    // Nhiều đường đóng (không rõ lý do)
    if (trafficAnalysis.byReason.roadClosed && trafficAnalysis.byReason.roadClosed.length > 2) {
      score -= 30;
      issues.push({
        type: 'multiple_roads_closed',
        severity: 'high',
        count: trafficAnalysis.byReason.roadClosed.length
      });
    } else if (trafficAnalysis.byReason.roadClosed && trafficAnalysis.byReason.roadClosed.length > 0) {
      score -= 15;
      issues.push({
        type: 'some_roads_closed',
        severity: 'medium',
        count: trafficAnalysis.byReason.roadClosed.length
      });
    }
  }
  
  // Thi công → Cảnh báo nhẹ
  if (trafficAnalysis.byReason.construction && trafficAnalysis.byReason.construction.length > 0) {
    score -= 10;
    issues.push({
      type: 'construction',
      severity: 'low',
      count: trafficAnalysis.byReason.construction.length
    });
  }

  // Xác định status
  let status;
  if (score >= 80) status = SAFETY_STATUS.SAFE;
  else if (score >= 50) status = SAFETY_STATUS.CAUTION;
  else if (score >= 20) status = SAFETY_STATUS.WARNING;
  else status = SAFETY_STATUS.DANGER;

  return {
    status: status.value,
    icon: status.icon,
    color: status.color,
    label: status.label,
    score,
    message: generateMessage(status.value, issues, tripDay, trafficAnalysis),
    current: weather.current,
    tripDay: tripDay || null,
    forecast: weather.forecast.slice(0, 7),
    trafficAnalysis,
    issues,
    updatedAt: new Date()
  };
};

// Helper: Tính số ngày của chuyến đi
const calculateTripDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 1; // Default 1 ngày nếu không có endDate
  
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 1;
  }
  
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 để bao gồm cả ngày cuối
  
  return diffDays;
};

// Helper: Parse date từ nhiều format
const parseDate = (dateStr) => {
  if (!dateStr) return new Date();
  
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      return new Date(isoDate);
    }
  }
  
  return new Date(dateStr);
};

// Helper: Phân tích thời tiết cho toàn bộ chuyến đi
const analyzeTripWeather = (trip, weather) => {
  const startDate = parseDate(trip.startDate);
  const endDate = parseDate(trip.endDate || trip.startDate);
  
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  
  const tripDays = [];
  const currentDate = new Date(startDate);
  
  // Tạo danh sách các ngày trong chuyến đi
  while (currentDate <= endDate) {
    tripDays.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`📅 Analyzing weather for ${tripDays.length} days:`, 
    tripDays.map(d => d.toLocaleDateString('vi-VN')).join(', ')
  );
  
  // Phân tích thời tiết cho từng ngày
  let rainyDaysCount = 0;
  let totalRain = 0;
  const dailyWeather = [];
  
  tripDays.forEach(day => {
    // Tìm forecast cho ngày này
    const dayForecasts = weather.forecast.filter(f => {
      const forecastDate = new Date(f.date);
      forecastDate.setHours(0, 0, 0, 0);
      return forecastDate.getTime() === day.getTime();
    });
    
    if (dayForecasts.length > 0) {
      // Tổng hợp mưa trong ngày
      const dayRain = dayForecasts.reduce((sum, f) => sum + (f.rain || 0), 0);
      const hasRain = dayRain > 2 || dayForecasts.some(f => 
        f.condition.includes('Rain') || 
        f.description.includes('mưa') ||
        (f.pop && f.pop > 0.3) // Probability of precipitation > 30%
      );
      
      if (hasRain) {
        rainyDaysCount++;
        totalRain += dayRain;
      }
      
      dailyWeather.push({
        date: day,
        rain: dayRain,
        hasRain,
        forecasts: dayForecasts.length
      });
      
      console.log(`  ${day.toLocaleDateString('vi-VN')}: ${hasRain ? '🌧️' : '☀️'} (${dayRain.toFixed(1)}mm)`);
    }
  });
  
  const avgRainPerDay = rainyDaysCount > 0 ? totalRain / rainyDaysCount : 0;
  
  const result = {
    totalDays: tripDays.length,
    rainyDaysCount,
    avgRainPerDay: Math.round(avgRainPerDay),
    dailyWeather,
    hasData: dailyWeather.length > 0
  };
  
  console.log(`📊 Trip weather summary:`, {
    totalDays: result.totalDays,
    rainyDays: result.rainyDaysCount,
    percentage: `${Math.round((rainyDaysCount / tripDays.length) * 100)}%`,
    avgRain: `${result.avgRainPerDay}mm/day`
  });
  
  return result;
};

// Helper functions
const getDaysUntil = (dateStr) => {
  if (!dateStr) {
    console.warn('⚠️ getDaysUntil: dateStr is null/undefined');
    return NaN;
  }
  
  let target;
  
  // Kiểm tra nếu là format DD/MM/YYYY (Việt Nam)
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // Convert DD/MM/YYYY -> YYYY-MM-DD
      const [day, month, year] = parts;
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      target = new Date(isoDate);
      console.log(`📅 Converted "${dateStr}" (DD/MM/YYYY) -> "${isoDate}" (ISO)`);
    } else {
      target = new Date(dateStr);
    }
  } else {
    target = new Date(dateStr);
  }
  
  // Kiểm tra date hợp lệ
  if (isNaN(target.getTime())) {
    console.warn(`⚠️ getDaysUntil: Invalid date "${dateStr}"`);
    return NaN;
  }
  
  const now = new Date();
  const diff = target - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  
  console.log(`📅 getDaysUntil: "${dateStr}" -> ${days} days`);
  return days;
};

const isSameDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const getDestinationCoords = async (destination) => {
  // Nếu destination đã có lat/lng
  if (destination.lat && destination.lng) {
    return { lat: destination.lat, lng: destination.lng };
  }
  
  // Nếu chỉ có tên, geocode qua Google Maps API
  const name = destination.name || destination;
  const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not found, using fallback coords');
    // Fallback coords (tạm thời)
    const coords = {
      'Đà Lạt': { lat: 11.9404, lng: 108.4583 },
      'Đà Nẵng': { lat: 16.0544, lng: 108.2022 },
      'Nha Trang': { lat: 12.2388, lng: 109.1967 },
      'Phú Quốc': { lat: 10.2899, lng: 103.9840 },
      'Hà Nội': { lat: 21.0285, lng: 105.8542 },
      'TP.HCM': { lat: 10.8231, lng: 106.6297 },
      'TP. Hồ Chí Minh': { lat: 10.8231, lng: 106.6297 }
    };
    return coords[name] || { lat: 10.8231, lng: 106.6297 };
  }
  
  try {
    // Geocode qua Google Maps API để lấy tọa độ chính xác
    const searchQuery = `${name}, Vietnam`;
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      console.log(`✅ Geocoded ${name}:`, { lat, lng });
      return { lat, lng };
    } else {
      console.warn(`⚠️ Could not geocode ${name}, using fallback`);
      // Fallback nếu geocode thất bại
      return { lat: 10.8231, lng: 106.6297 }; // TP.HCM
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    return { lat: 10.8231, lng: 106.6297 }; // TP.HCM
  }
};

const generateMessage = (status, issues, tripDay, trafficAnalysis) => {
  if (status === 'SAFE') {
    return 'Thời tiết tốt, yên tâm đi';
  }

  const messages = [];
  
  issues.forEach(issue => {
    switch (issue.type) {
      case 'continuous_rain_all_days':
        messages.push(`🌧️ MƯA SUỐT ${issue.totalDays} NGÀY (${issue.avgRain}mm/ngày)`);
        break;
      case 'continuous_rain_most_days':
        messages.push(`🌧️ Mưa ${issue.rainyDays}/${issue.totalDays} ngày (${issue.avgRain}mm/ngày)`);
        break;
      case 'frequent_rain':
        messages.push(`Mưa ${issue.rainyDays}/${issue.totalDays} ngày`);
        break;
      case 'heavy_rain_average':
        messages.push(`Mưa lớn trung bình ${issue.avgRain}mm/ngày`);
        break;
      case 'all_critical_routes_closed':
        messages.push(`🚫 TẤT CẢ đường chính đều đóng`);
        break;
      case 'some_critical_routes_closed':
        const routeNames = issue.routes.map(r => r.name).join(', ');
        messages.push(`ℹ️ ${routeNames} đang đóng (còn đường khác)`);
        break;
      case 'secondary_routes_closed':
        // Không thêm vào message chính (chỉ hiển thị trong widget)
        break;
      case 'weather_road_closure':
        messages.push(`${issue.count} đường đóng do thời tiết xấu`);
        break;
      case 'multiple_roads_closed':
        messages.push(`${issue.count} đường bị đóng`);
        break;
      case 'some_roads_closed':
        messages.push(`${issue.count} đường bị đóng`);
        break;
      case 'construction':
        messages.push(`${issue.count} đoạn đường thi công`);
        break;
      case 'heavy_rain_forecast':
        messages.push('Mưa lớn dự kiến');
        break;
      case 'rain_forecast':
        messages.push('Có mưa');
        break;
      case 'current_heavy_rain':
        messages.push('Hiện tại mưa lớn');
        break;
      case 'strong_wind':
        messages.push('Gió mạnh');
        break;
      default:
        break;
    }
  });

  if (messages.length === 0) {
    return 'Có thể gặp khó khăn nhỏ';
  }

  return messages.join(', ') + (status === 'DANGER' ? '. Rất nguy hiểm!' : '. Nên chuẩn bị kỹ.');
};

// Lưu notification vào Firestore
export const saveNotification = async (userId, tripId, notification) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      tripId,
      type: 'weather_alert',
      status: notification.status,
      title: `${notification.icon} ${notification.label}`,
      message: notification.message,
      destination: notification.destination,
      tripDate: notification.tripDate,
      read: false,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Error saving notification:', error);
  }
};

// Lấy notifications của user
export const getUserNotifications = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

// Đánh dấu notification đã đọc
export const markNotificationAsRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

// Đếm notifications chưa đọc
export const getUnreadCount = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};
