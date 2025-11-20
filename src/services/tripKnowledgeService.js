// Trip Knowledge Service - Học thông tin chuyến đi của user
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

/**
 * Lấy tất cả chuyến đi của user từ complete_itineraries để training chatbot
 */
export const getUserTripsForTraining = async (userId) => {
  try {
    console.log(`🔍 Querying complete_itineraries for userId: ${userId}`);
    const itinerariesRef = collection(db, 'complete_itineraries');
    
    // Thử query với orderBy, nếu lỗi thì query đơn giản
    let snapshot;
    try {
      const q = query(
        itinerariesRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      console.log('📡 Executing query with orderBy...');
      snapshot = await getDocs(q);
    } catch (indexError) {
      console.warn('⚠️ Index not ready, using simple query:', indexError.message);
      // Fallback: Query đơn giản không cần index
      const q = query(itinerariesRef, where('userId', '==', userId));
      console.log('📡 Executing simple query...');
      snapshot = await getDocs(q);
    }
    
    const allTrips = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📚 Found ${allTrips.length} total itineraries`);
    
    // Debug: Log first trip to see structure
    if (allTrips.length > 0) {
      const sample = allTrips[0];
      console.log('📋 Sample trip data:', {
        id: sample.id,
        destination: sample.destination,
        startDate: sample.startDate,
        keys: Object.keys(sample)
      });
      console.log('📋 All fields:', sample);
      console.log('📋 Header:', sample.header);
      console.log('📋 Cost breakdown:', sample.costBreakdown);
      console.log('📋 Daily itinerary:', sample.dailyItinerary);
      console.log('📋 Selected hotel:', sample.selectedHotel);
      console.log('📋 Selected places:', sample.selectedPlaces);
      
      // Log chi tiết dailyItinerary nếu có
      if (sample.dailyItinerary && sample.dailyItinerary.length > 0) {
        console.log('📋 First day details:', sample.dailyItinerary[0]);
        console.log('📋 First day destinations:', sample.dailyItinerary[0]?.destinations);
        console.log('📋 First day restaurants:', sample.dailyItinerary[0]?.restaurants);
        console.log('📋 First day hotel:', sample.dailyItinerary[0]?.hotel);
      }
    }
    
    // TẠM THỜI: Lấy tất cả trips để test (không filter)
    const trips = allTrips;
    
    console.log(`✅ Loaded ${trips.length} itineraries for training (no filter)`);
    
    // DEBUG: Nếu không tìm thấy gì, thử query tất cả để test
    if (allTrips.length === 0) {
      console.warn('⚠️ No trips found for this user. Testing query without userId filter...');
      try {
        const testSnapshot = await getDocs(collection(db, 'complete_itineraries'));
        console.log(`🧪 Total documents in complete_itineraries: ${testSnapshot.size}`);
        if (testSnapshot.size > 0) {
          const firstDoc = testSnapshot.docs[0].data();
          console.log('🧪 Sample document userId:', firstDoc.userId);
          console.log('🧪 Current userId:', userId);
          console.log('🧪 Match:', firstDoc.userId === userId);
        }
      } catch (testError) {
        console.error('🧪 Test query failed:', testError);
      }
    }
    
    return trips;
  } catch (error) {
    console.error('Error loading itineraries:', error);
    return [];
  }
};

/**
 * Lấy status của trip (giống logic trong itineraryManagementService)
 */
const getTripStatus = (trip) => {
  // Ưu tiên status từ DB
  if (trip.status === 'completed') return 'completed';
  if (trip.status === 'cancelled') return 'cancelled';
  
  // Tự động phát hiện "ongoing" dựa trên ngày
  const now = new Date();
  const startDateStr = trip.header?.duration?.startDate || trip.startDate;
  const endDateStr = trip.header?.duration?.endDate || trip.endDate;
  
  if (startDateStr && endDateStr) {
    const startDate = parseDate(startDateStr);
    const endDate = parseDate(endDateStr);
    
    if (now >= startDate && now <= endDate) {
      return 'ongoing';
    }
  }
  
  // Mặc định là active (sắp tới)
  return 'active';
};

/**
 * Chuyển đổi trips thành text để training chatbot
 */
export const convertTripsToTrainingText = (trips) => {
  console.log(`🔄 Converting ${trips?.length || 0} trips to training text`);
  
  if (!trips || trips.length === 0) {
    return 'Người dùng chưa có chuyến đi nào.';
  }
  
  // DEBUG: Log toàn bộ dữ liệu thô
  console.log('🔍 RAW TRIP DATA FOR TRAINING:');
  trips.forEach((trip, i) => {
    console.log(`\n📦 Trip ${i + 1}:`, {
      id: trip.id,
      tripName: trip.header?.tripName,
      hasDailyItinerary: !!trip.dailyItinerary,
      dailyItineraryLength: trip.dailyItinerary?.length,
      hasSelectedHotel: !!trip.selectedHotel,
      hasSelectedPlaces: !!trip.selectedPlaces,
      allKeys: Object.keys(trip)
    });
  });
  
  // Phân loại theo STATUS thực tế
  const activeTrips = [];
  const ongoingTrips = [];
  const completedTrips = [];
  const cancelledTrips = [];
  
  trips.forEach(trip => {
    const status = getTripStatus(trip);
    if (status === 'active') activeTrips.push(trip);
    else if (status === 'ongoing') ongoingTrips.push(trip);
    else if (status === 'completed') completedTrips.push(trip);
    else if (status === 'cancelled') cancelledTrips.push(trip);
  });
  
  console.log(`📊 Trips by status: ${activeTrips.length} active, ${ongoingTrips.length} ongoing, ${completedTrips.length} completed, ${cancelledTrips.length} cancelled`);
  
  let trainingText = '# THÔNG TIN CHUYẾN ĐI CỦA NGƯỜI DÙNG\n\n';
  
  // Chuyến đi đang diễn ra (ưu tiên cao nhất)
  if (ongoingTrips.length > 0) {
    trainingText += '## 🚀 CHUYẾN ĐI ĐANG DIỄN RA:\n\n';
    ongoingTrips.forEach((trip, index) => {
      trainingText += formatTripInfo(trip, index + 1, 'ongoing');
    });
  }
  
  // Chuyến đi sắp tới
  if (activeTrips.length > 0) {
    trainingText += '\n## 📅 CHUYẾN ĐI SẮP TỚI:\n\n';
    activeTrips.forEach((trip, index) => {
      trainingText += formatTripInfo(trip, index + 1, 'active');
    });
  }
  
  // Chuyến đi đã hoàn thành
  if (completedTrips.length > 0) {
    trainingText += '\n## ✅ CHUYẾN ĐI ĐÃ HOÀN THÀNH:\n\n';
    completedTrips.forEach((trip, index) => {
      trainingText += formatTripInfo(trip, index + 1, 'completed');
    });
  }
  
  // Chuyến đi đã hủy
  if (cancelledTrips.length > 0) {
    trainingText += '\n## ❌ CHUYẾN ĐI ĐÃ HỦY:\n\n';
    cancelledTrips.forEach((trip, index) => {
      trainingText += formatTripInfo(trip, index + 1, 'cancelled');
    });
  }
  
  return trainingText;
};

/**
 * Format thông tin 1 chuyến đi từ complete_itineraries
 */
const formatTripInfo = (trip, index, status) => {
  // Đọc từ header
  const header = trip.header || {};
  const costBreakdown = trip.costBreakdown || {};
  
  const tripName = header.tripName || 'Chưa đặt tên';
  const startDate = header.duration?.startDate || 'Chưa xác định';
  const endDate = header.duration?.endDate || startDate;
  const durationText = header.duration?.text || 'Chưa xác định';
  const travelers = header.travelers?.count || 1;
  const grandTotal = costBreakdown.grandTotal || 0;
  const perPerson = costBreakdown.perPerson || 0;
  
  // Thêm status label
  const statusLabel = {
    'active': '📅 Sắp tới',
    'ongoing': '🚀 Đang đi',
    'completed': '✅ Đã hoàn thành',
    'cancelled': '❌ Đã hủy'
  }[status] || '';
  
  let text = `### ${index}. ${tripName} ${statusLabel}\n`;
  text += `- **Ngày đi**: ${startDate}\n`;
  if (endDate && endDate !== startDate) {
    text += `- **Ngày về**: ${endDate}\n`;
  }
  text += `- **Thời gian**: ${durationText}\n`;
  text += `- **Số người**: ${travelers} người\n`;
  if (grandTotal > 0) {
    text += `- **Ngân sách tổng**: ${grandTotal.toLocaleString('vi-VN')} ₫\n`;
    text += `- **Ngân sách/người**: ${perPerson.toLocaleString('vi-VN')} ₫/người\n`;
  }
  
  // Thêm lý do hủy nếu có
  if (status === 'cancelled' && trip.cancelReason) {
    text += `- **Lý do hủy**: ${trip.cancelReason}\n`;
  }
  
  // Thêm thời gian hoàn thành nếu có
  if (status === 'completed' && trip.completedAt) {
    const completedDate = trip.completedAt.toDate ? trip.completedAt.toDate() : new Date(trip.completedAt);
    text += `- **Hoàn thành lúc**: ${completedDate.toLocaleDateString('vi-VN')}\n`;
  }
  
  // Thêm thông tin khách sạn nếu có (nhiều cách lưu khác nhau)
  const hotel = trip.selectedHotel || trip.accommodation?.selected || trip.hotel;
  if (hotel) {
    text += `- **Khách sạn**: ${hotel.name}\n`;
    const hotelPrice = hotel.price || hotel.pricePerNight || hotel.totalCost;
    if (hotelPrice) {
      text += `  - Giá: ${hotelPrice.toLocaleString('vi-VN')} ₫/đêm\n`;
    }
  }
  
  // Thêm thông tin địa điểm nếu có
  if (trip.selectedPlaces && trip.selectedPlaces.length > 0) {
    text += `- **Địa điểm tham quan** (${trip.selectedPlaces.length} địa điểm):\n`;
    trip.selectedPlaces.slice(0, 5).forEach(place => {
      text += `  - ${place.name}\n`;
    });
    if (trip.selectedPlaces.length > 5) {
      text += `  - ... và ${trip.selectedPlaces.length - 5} địa điểm khác\n`;
    }
  }
  
  // THÊM: Chi tiết lịch trình từng ngày
  if (trip.dailyItinerary && trip.dailyItinerary.length > 0) {
    console.log(`� Processinhg dailyItinerary for trip ${trip.id || index}:`, trip.dailyItinerary.length, 'days');
    text += `\n**📋 Lịch trình chi tiết:**\n`;
    trip.dailyItinerary.forEach((day, dayIndex) => {
      console.log(`  Day ${dayIndex + 1}:`, {
        date: day.date,
        destinations: day.destinations?.length,
        restaurants: day.restaurants?.length,
        hotel: day.hotel?.name
      });
      text += `\n  **Ngày ${dayIndex + 1}** (${day.date || ''}):\n`;
      
      // Địa điểm trong ngày
      if (day.destinations && day.destinations.length > 0) {
        day.destinations.forEach((dest, destIndex) => {
          text += `  ${destIndex + 1}. ${dest.name}`;
          if (dest.arrivalTime) text += ` (${dest.arrivalTime})`;
          if (dest.category) text += ` - ${dest.category}`;
          text += '\n';
          
          // Thêm hoạt động nếu có
          if (dest.activities && dest.activities.length > 0) {
            dest.activities.forEach(activity => {
              text += `     • ${activity}\n`;
            });
          }
        });
      }
      
      // Nhà hàng trong ngày
      if (day.restaurants && day.restaurants.length > 0) {
        text += `  🍽️ Nhà hàng:\n`;
        day.restaurants.forEach(restaurant => {
          text += `     • ${restaurant.name}`;
          if (restaurant.mealType) text += ` (${restaurant.mealType})`;
          if (restaurant.estimatedCost) text += ` - ${restaurant.estimatedCost.toLocaleString('vi-VN')}₫`;
          text += '\n';
        });
      }
      
      // Khách sạn trong ngày
      if (day.hotel) {
        text += `  🏨 Khách sạn: ${day.hotel.name}`;
        if (day.hotel.price) text += ` - ${day.hotel.price.toLocaleString('vi-VN')}₫/đêm`;
        text += '\n';
      }
      
      // Chi phí ngày
      if (day.totalCost) {
        text += `  💰 Chi phí ngày: ${day.totalCost.toLocaleString('vi-VN')}₫\n`;
      }
    });
  }
  
  text += '\n';
  return text;
};

/**
 * Tính thời gian chuyến đi
 */
const calculateDuration = (startDate, endDate) => {
  if (!endDate) return '1 ngày';
  
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const nights = diffDays - 1;
  
  return `${diffDays} ngày ${nights} đêm`;
};

/**
 * Parse date từ nhiều format
 */
const parseDate = (dateStr) => {
  if (!dateStr) return new Date();
  
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    }
  }
  
  return new Date(dateStr);
};

/**
 * Tạo context cho chatbot với thông tin chuyến đi
 */
export const createTripContext = async (userId) => {
  const trips = await getUserTripsForTraining(userId);
  const trainingText = convertTripsToTrainingText(trips);
  
  // Tính summary theo status thực tế
  const summary = {
    total: trips.length,
    active: trips.filter(t => getTripStatus(t) === 'active').length,
    ongoing: trips.filter(t => getTripStatus(t) === 'ongoing').length,
    completed: trips.filter(t => getTripStatus(t) === 'completed').length,
    cancelled: trips.filter(t => getTripStatus(t) === 'cancelled').length
  };
  
  return {
    trips,
    trainingText,
    summary
  };
};
