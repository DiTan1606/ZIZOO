# 💰 Budget-Smart Recommendations - Hoàn Thiện

## ✅ Đã Hoàn Thành

### 1. **MEAL_COSTS Constants**
- ✅ Thêm `MEAL_COSTS` vào `src/constants/index.js`
- ✅ Định nghĩa giá theo 4 travel styles: budget, standard, comfort, luxury
- ✅ Bao gồm: breakfast, lunch, dinner, streetFood, cafe
- ✅ Mỗi loại có min/avg/max price

### 2. **Helper Functions**
- ✅ `isLuxuryRestaurant(name)` - Nhận diện nhà hàng cao cấp
- ✅ `estimateMealCostFromPriceLevel(priceLevel, mealType, travelStyle)` - Tính giá từ Google Places price_level

### 3. **Smart Restaurant Queries**
- ✅ Luxury/Comfort: Ưu tiên `fine dining`, `luxury restaurants`, `5 star`, `rooftop`
- ✅ Budget/Standard: Ưu tiên `local food`, `popular restaurants`, `street food`

### 4. **Restaurant Filtering & Sorting**
- ✅ Minimum rating: 4.3 cho luxury/comfort, 4.0 cho budget/standard
- ✅ Sort ưu tiên luxury restaurants lên đầu khi travelStyle = luxury/comfort
- ✅ Fuzzy matching để tránh trùng lặp

### 5. **Real API Pricing**
- ✅ Breakfast: Sử dụng `estimateMealCostFromPriceLevel()` từ Google Places
- ✅ Lunch: Tính giá theo price_level và travelStyle
- ✅ Dinner: Tính giá theo price_level và travelStyle
- ✅ Fallback: Sử dụng `styleCosts` từ MEAL_COSTS nếu không có data

### 6. **Cost Calculation Updates** ✅ HOÀN THIỆN
- ✅ `calculateEnhancedDayCost()` sử dụng `restaurants.estimatedCost` từ API
- ✅ Fallback về `styleCosts.{meal}.avg` nếu không có estimatedCost
- ✅ Log chi tiết giá vé từng địa điểm: `${dest.name}: ${fee.toLocaleString()}đ`
- ✅ Tính chi phí di chuyển giữa các địa điểm dựa trên `transportDataService.getTravelTime()`
- ✅ Sử dụng `roundPrice()` để làm tròn đến 10,000đ
- ✅ Tổng chi phí = vé tham quan + ăn uống + di chuyển + phát sinh

### 7. **Budget-Based Destination Selection**
- ✅ `findRealDestinationsForDay()` nhận `travelStyle` và `dailyBudget`
- ✅ `canAffordPremium = dailyBudget > 800k || luxury/comfort`
- ✅ Ưu tiên queries cao cấp: `luxury attractions`, `vinpearl`, `sun world`
- ✅ Sort ưu tiên premium attractions khi `canAffordPremium = true`

## 🎯 Logic Flow

### Khi tạo itinerary:
1. **Nhận input**: travelStyle, dailyBudget
2. **Chọn destinations**: 
   - Nếu budget cao → Ưu tiên Vinpearl, Bà Nà Hills, cable car
   - Nếu budget thấp → Ưu tiên địa điểm miễn phí, công viên
3. **Chọn restaurants**:
   - Nếu luxury/comfort → Ưu tiên fine dining, rooftop, 5 star
   - Nếu budget/standard → Ưu tiên local food, street food
4. **Tính giá thực tế**:
   - Sử dụng `price_level` từ Google Places
   - Map sang MEAL_COSTS theo travelStyle
   - Fallback về giá trung bình nếu không có data

## 📊 Price Mapping

### Google Places price_level → Cost:
- 0 (Free) → min price
- 1 (Inexpensive) → min price
- 2 (Moderate) → avg price
- 3 (Expensive) → max price
- 4 (Very Expensive) → max price × 1.5

### Example (Standard style, Lunch):
- price_level = 2 → 100,000đ (avg)
- price_level = 3 → 150,000đ (max)
- price_level = 4 → 225,000đ (max × 1.5)

## 🔍 Keywords

### Luxury Restaurant Keywords:
- fine dining, luxury, premium, 5 sao, five star
- rooftop, sky, intercontinental, sheraton, marriott
- hilton, hyatt, pullman, novotel, lotte
- cao cấp, sang trọng, resort

### Premium Attraction Keywords:
- vinpearl, vinwonders, sun world, bà nà, ba na
- cable car, cáp treo, fansipan, safari
- resort, luxury, premium, 5 sao, five star

## 🚀 Kết Quả

Hệ thống bây giờ sẽ:
- ✅ Gợi ý địa điểm phù hợp với ngân sách thực tế
- ✅ Ưu tiên nhà hàng cao cấp khi budget cho phép
- ✅ Tính giá chính xác từ Google Places API price_level
- ✅ Tránh gợi ý Vinpearl khi budget thấp (< 1.5M/người)
- ✅ Đa dạng hóa trải nghiệm theo travel style
- ✅ Chi phí ngày được tính dựa trên giá thực tế từ API
- ✅ Tự động điều chỉnh gợi ý theo ngân sách hàng ngày

## 📝 Chi Tiết Tính Giá

### Chi phí ngày = 4 thành phần:

1. **Vé tham quan**: Giá thực tế từ `estimateEntryFeeFromName()`
   - Vinpearl: 700k-800k
   - Bà Nà Hills: 750k
   - Bảo tàng: 40k
   - Miễn phí: Chùa, công viên, biển

2. **Ăn uống**: Ưu tiên `estimatedCost` từ API, fallback về `MEAL_COSTS`
   - Breakfast: 30k-350k (tùy style)
   - Lunch: 50k-700k
   - Dinner: 80k-1.2M
   - Street food: 20k-80k
   - Cafe: 25k-150k

3. **Di chuyển trong ngày**: 
   - Base cost: 60k-800k/ngày (tùy style)
   - Giữa các địa điểm: 20k-50k/lần (dựa trên khoảng cách)

4. **Phát sinh**: 50k cố định (nước, tip, mua sắm nhỏ)

### Làm tròn: 
- Tất cả giá được làm tròn đến 10,000đ bằng `roundPrice()`
