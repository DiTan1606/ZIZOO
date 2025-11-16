# 🗺️ Zizoo - Hệ thống Lịch trình Du lịch Thông minh Hoàn chỉnh

## 🎯 Tổng quan

Zizoo là ứng dụng du lịch thông minh sử dụng AI, Machine Learning và Big Data để tạo ra những lịch trình du lịch cá nhân hóa 100%, cập nhật thời gian thực, tiết kiệm chi phí & thời gian, đồng thời thúc đẩy du lịch bền vững.

## 🚀 Tính năng chính đã hoàn thành

### 1. **Hệ thống Gợi ý Cá nhân hóa AI** 🤖
- **Collaborative Filtering**: Neural network học từ hành vi users tương tự
- **Content-Based Filtering**: Phân tích đặc điểm destinations và user profile
- **Deep Learning Model**: Dự đoán sở thích từ context (tháng, ngân sách, loại hình...)
- **Hybrid Engine**: Kết hợp 3 phương pháp với trọng số tối ưu
- **Auto-training**: Tự động retrain models khi có dữ liệu mới
- **Explainable AI**: Giải thích tại sao AI gợi ý điểm đến này

### 2. **Lịch trình Du lịch Hoàn chỉnh** 📋
Theo đúng cấu trúc chuẩn 8 phần:

#### **1. Thông tin cơ bản (Header)**
- Tên chuyến đi (VD: "Hà Nội – Đà Nẵng 4N3Đ")
- Thời gian: từ ngày ... đến ngày ... 
- Số người lớn/trẻ em
- Phong cách: tiết kiệm – trung bình – thoải mái – sang trọng
- Ngân sách dự kiến (tổng và theo đầu người)

#### **2. Lịch trình chi tiết theo từng ngày**
- **Giờ giấc cụ thể**: 06:30 khởi hành, 12:30 check-in...
- **Địa điểm tham quan**: thứ tự hợp lý theo khoảng cách
- **Bữa ăn**: sáng/trưa/tối → ăn ở đâu, món đặc sản gì
- **Hoạt động tự do**: buổi tối, mua sắm, dạo phố
- **Lưu ý đặc biệt**: mua vé trước, mang áo mưa, thời tiết...

#### **3. Danh sách chi phí dự kiến (chi tiết)**
- Vé máy bay/xe/tàu khứ hồi
- Khách sạn/nhà nghỉ (tên + link đặt phòng)
- Ăn uống (ước tính mỗi ngày)
- Vé tham quan, cáp treo, thuê xe máy...
- Chi phí phát sinh dự phòng (15%)
- **→ Tổng cộng: ... VND/người**

#### **4. Phương tiện di chuyển**
- **Đi từ nơi ở đến điểm du lịch**: máy bay, limousine, xe khách...
- **Di chuyển tại điểm đến**: thuê xe máy, Grab, taxi, xe đạp...
- Gợi ý apps: Grab, Be, Gojek
- Chi phí và thời gian ước tính

#### **5. Lưu trú**
- Tên khách sạn/homestay/resort từng đêm
- Link đặt phòng (Booking, Agoda, Airbnb...)
- Số điện thoại liên hệ
- Amenities và location phù hợp với budget

#### **6. Danh sách đồ cần mang (Packing list)**
- **Đồ cần thiết**: Giấy tờ, tiền, điện thoại, thuốc men...
- **Quần áo**: phù hợp với thời tiết và hoạt động
- **Đồ điện tử**: sạc dự phòng, adapter, máy ảnh...
- **Đồ vệ sinh**: kem chống nắng, thuốc chống muỗi...
- **Đồ tùy chọn**: theo sở thích (photography, adventure...)
- **Đồ cấm**: chất lỏng >100ml, vật sắc nhọn...

#### **7. Lưu ý quan trọng**
- **Thời tiết**: dự báo và chuẩn bị
- **Văn hóa địa phương**: ăn mặc, phong tục
- **An toàn**: số điện thoại khẩn cấp, bảo hiểm
- **Y tế**: bệnh viện địa phương, thuốc men
- **Tiền tệ**: tỷ giá, thanh toán, ATM
- **Ngôn ngữ**: cụm từ hữu ích

#### **8. Bản đồ và tối ưu lộ trình**
- Thứ tự di chuyển hợp lý
- Tránh đi lòng vòng, tiết kiệm thời gian
- Gộp địa điểm gần nhau trong cùng buổi
- Ước tính khoảng cách và thời gian di chuyển

### 3. **Tích hợp Dữ liệu Thời gian Thực** 🔄
- Google Maps API: địa điểm, đánh giá, ảnh
- OpenWeatherMap: dự báo thời tiết
- Firebase: lưu trữ dữ liệu user, feedback, trips
- Places Service: tìm kiếm và đánh giá địa điểm

### 4. **Tối ưu Lộ trình Thông minh** 🧠
- **Thuật toán**: Linear Programming, Genetic Algorithms, TSP
- **Tối ưu đa mục tiêu**: thời gian – chi phí – sở thích – cảnh đẹp
- **Tự động tái tối ưu**: khi có thay đổi đột xuất
- **Clustering**: nhóm địa điểm theo khu vực gần nhau

### 5. **Cảnh báo & Tự động Điều chỉnh** ⚠️
- Push notification: thời tiết xấu, đóng cửa điểm đến
- AI dự đoán rủi ro + tự đề xuất phương án thay thế
- Risk prediction model cho thiên tai, thời tiết
- Người dùng xác nhận chỉ bằng 1 nút

## 🏗️ Kiến trúc Hệ thống

```
src/
├── ml/                                    # Machine Learning Models
│   ├── collaborativeFiltering.js         # Neural Collaborative Filtering
│   ├── contentBasedFiltering.js          # Content-based recommendations
│   ├── hybridRecommendationEngine.js     # Hybrid AI engine
│   ├── userPreferenceModel.js            # Deep learning model
│   ├── riskModel.js                      # Risk prediction
│   └── trainer.js                        # Training coordinator
│
├── services/                              # Business Logic Services
│   ├── completeItineraryService.js       # Complete itinerary generation
│   ├── recommendationService.js          # AI recommendations API
│   ├── aiTrainingService.js              # ML training management
│   ├── personalItineraryService.js       # Personal itinerary logic
│   ├── placesService.js                  # Google Places integration
│   ├── weatherService.js                 # Weather API integration
│   ├── firestoreService.js               # Firebase operations
│   └── riskService.js                    # Risk assessment
│
├── components/                            # React UI Components
│   ├── CompleteItineraryPlanner.js       # Complete itinerary UI
│   ├── PersonalizedRecommendations.js    # AI recommendations UI
│   ├── MapViewer.js                      # Interactive maps
│   └── Navbar.js                         # Navigation
│
├── pages/                                 # Main Pages
│   ├── Home.js                           # Landing page
│   ├── PersonalItineraryPlanner.js       # Basic planner
│   ├── ItineraryDemo.js                  # System demo
│   ├── MyTrips.js                        # User trips
│   └── RiskMapGoogle.js                  # Risk visualization
│
└── utils/                                 # Utilities
    ├── testAIRecommendations.js          # AI testing suite
    ├── tsp.js                            # Route optimization
    └── riskConfig.js                     # Risk configuration
```

## 🎮 Cách sử dụng

### Cho End Users

#### 1. **Lịch trình Hoàn chỉnh** (`/complete-planner`)
1. Chọn điểm khởi hành và điểm đến
2. Thiết lập ngày, số người, ngân sách
3. Chọn phong cách du lịch (tiết kiệm → sang trọng)
4. Chọn sở thích (văn hóa, thiên nhiên, ẩm thực...)
5. Nhận lịch trình hoàn chỉnh 8 phần
6. In hoặc tải xuống PDF/JSON

#### 2. **AI Gợi ý Cá nhân hóa** (`/ai-recommendations`)
1. Thiết lập sở thích chi tiết
2. AI phân tích và tạo gợi ý riêng biệt
3. Xem giải thích tại sao AI gợi ý
4. Đánh giá feedback để AI học hỏi
5. Hệ thống cải thiện theo thời gian

#### 3. **Demo Hệ thống** (`/demo`)
- Test tất cả tính năng với dữ liệu mẫu
- Xem kết quả JSON chi tiết
- Không cần đăng nhập

### Cho Developers

#### Khởi tạo dự án
```bash
npm install
npm start
```

#### Tạo lịch trình hoàn chỉnh
```javascript
import { createCompleteItinerary } from './services/completeItineraryService';

const itinerary = await createCompleteItinerary({
    destination: 'Đà Nẵng',
    departureCity: 'Hà Nội',
    startDate: '2025-12-01',
    duration: 4,
    travelers: 2,
    budget: 8000000,
    travelStyle: 'comfort',
    interests: ['culture', 'food', 'photography']
}, userId);
```

#### Tạo AI recommendations
```javascript
import { generatePersonalizedRecommendations } from './ml/hybridRecommendationEngine';

const recommendations = await generatePersonalizedRecommendations(userId, {
    month: 6,
    budget: 'medium',
    type: 'Nghỉ dưỡng',
    adventureLevel: 'medium',
    ecoFriendly: false,
    provinces: ['Đà Nẵng', 'Quảng Nam']
}, {
    topK: 10,
    includeExplanations: true,
    diversityBoost: true
});
```

#### Training AI models
```javascript
import { trainAllAIModels, generateSyntheticData } from './services/aiTrainingService';

// Generate test data
await generateSyntheticData(20, 100);

// Train models
const result = await trainAllAIModels();
```

## 🧪 Testing

### Chạy test suite
```javascript
import { runFullTestSuite } from './utils/testAIRecommendations';

const results = await runFullTestSuite();
console.log('Test results:', results);
```

### Test categories
- **Basic Tests**: Synthetic data, model training, recommendations
- **Performance Tests**: Tốc độ generate recommendations (<5s)
- **Accuracy Tests**: Độ chính xác (cần real data)

## 📊 Dữ liệu và Performance

### Dữ liệu đầu vào
- **User Feedback**: ratings, comments từ users
- **Trip History**: lịch sử các chuyến đi
- **User Preferences**: sở thích được khai báo
- **Destination Features**: đặc điểm địa điểm (rating, type, location...)
- **Contextual Data**: thời tiết, mùa, sự kiện

### Performance Metrics
- **Recommendation Speed**: <5 giây cho 10 gợi ý
- **Model Training**: Auto-retrain mỗi 24h nếu có đủ data mới
- **Data Quality Score**: Đánh giá chất lượng dữ liệu training
- **User Satisfaction**: Tracking qua feedback ratings

### Scalability
- **Caching**: User profiles, destination features
- **Lazy Loading**: Models chỉ load khi cần
- **Background Training**: Không block UI
- **Database Indexing**: Tối ưu queries

## 🔧 Configuration

### Environment Variables (.env)
```env
# Firebase
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id

# Google Maps
REACT_APP_GOOGLE_MAPS_API_KEY=your_maps_key

# Weather API
REACT_APP_WEATHER_API_KEY=your_weather_key
```

### Model Parameters
```javascript
// Hybrid Engine Weights
this.weights = {
    collaborative: 0.4,    // Collaborative Filtering
    contentBased: 0.4,     // Content-Based Filtering  
    deepLearning: 0.2      // Deep Learning Model
};

// Training Parameters
const trainingConfig = {
    epochs: 50,
    batchSize: 32,
    validationSplit: 0.2,
    learningRate: 0.001
};
```

## 🚀 Deployment

### Build production
```bash
npm run build
firebase deploy
```

### Firebase Setup
1. Tạo Firebase project
2. Enable Firestore, Authentication
3. Setup security rules
4. Deploy functions (nếu có)

## 🔮 Roadmap

### Phase 2 (Đã hoàn thành)
- ✅ **Complete Itinerary System**: 8 phần hoàn chỉnh
- ✅ **AI Recommendations**: Hybrid CF + CB + DL
- ✅ **Auto-training**: Tự động retrain models
- ✅ **Real-time Data**: Weather, Places, Risk assessment
- ✅ **Route Optimization**: TSP, clustering algorithms
- ✅ **Explainable AI**: Giải thích recommendations

### Phase 3 (Tương lai)
- [ ] **Mobile App**: React Native version
- [ ] **Social Features**: Share trips, follow friends
- [ ] **Advanced NLP**: Phân tích reviews, comments
- [ ] **Computer Vision**: Nhận diện ảnh destinations
- [ ] **Blockchain**: Loyalty points, NFT collectibles
- [ ] **AR/VR**: Virtual tour preview

### Phase 4 (Advanced)
- [ ] **Federated Learning**: Privacy-preserving training
- [ ] **Multi-language**: Support English, Chinese, Korean
- [ ] **Global Expansion**: International destinations
- [ ] **Enterprise**: B2B solutions for travel agencies

## 🤝 Contributing

### Thêm tính năng mới
1. Fork repository
2. Tạo feature branch
3. Implement trong thư mục phù hợp
4. Thêm tests
5. Update documentation
6. Tạo Pull Request

### Cải thiện AI models
1. Thử nghiệm hyperparameters
2. Thêm features mới
3. Implement algorithms mới
4. A/B test với users

## 📈 Analytics & Monitoring

### Key Metrics
- **User Engagement**: Time spent, pages viewed
- **Recommendation CTR**: Click-through rate
- **Trip Completion**: Số lượng trips được thực hiện
- **User Satisfaction**: Average rating, feedback
- **System Performance**: Response time, error rate

### Monitoring Tools
- Firebase Analytics
- Google Analytics
- Custom logging system
- Error tracking (Sentry)

## 🔒 Security & Privacy

### Data Protection
- User data encryption
- GDPR compliance
- Secure API endpoints
- Regular security audits

### Privacy Features
- Anonymous analytics
- Data deletion requests
- Consent management
- Minimal data collection

## 📞 Support

### Documentation
- [AI Recommendations Guide](./AI_RECOMMENDATIONS_README.md)
- [Complete System Overview](./COMPLETE_SYSTEM_README.md)
- API Documentation (coming soon)

### Contact
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: support@zizoo.travel (placeholder)

---

**Zizoo** - Tạo lịch trình du lịch thông minh, cá nhân hóa 100% bằng AI 🤖✈️

*"Mỗi chuyến đi là một câu chuyện riêng, Zizoo giúp bạn viết câu chuyện đó một cách hoàn hảo."*