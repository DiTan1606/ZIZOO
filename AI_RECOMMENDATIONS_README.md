# 🤖 Hệ thống Gợi ý Cá nhân hóa AI - Zizoo

## Tổng quan

Hệ thống AI Recommendations của Zizoo sử dụng kết hợp **Collaborative Filtering**, **Content-Based Filtering** và **Deep Learning** để tạo ra những gợi ý du lịch cá nhân hóa 100% cho từng người dùng.

## 🎯 Tính năng chính

### 1. **Collaborative Filtering**
- Phân tích hành vi của users tương tự
- Neural Collaborative Filtering với TensorFlow.js
- Tự động học từ feedback và lịch sử trips

### 2. **Content-Based Filtering**
- Phân tích đặc điểm destinations (loại hình, rating, giá cả...)
- Tạo user profile từ lịch sử và sở thích
- Tính similarity giữa user và destinations

### 3. **Deep Learning Model**
- Dự đoán sở thích user dựa trên context
- Input: tháng, ngân sách, loại hình, mức mạo hiểm...
- Output: xác suất thích các loại destinations

### 4. **Hybrid Engine**
- Kết hợp 3 phương pháp trên với trọng số tối ưu
- Đảm bảo diversity và novelty trong gợi ý
- Giải thích lý do gợi ý cho user

## 🚀 Cách sử dụng

### Cho End Users

1. **Truy cập trang AI Gợi ý**: `/ai-recommendations`
2. **Thiết lập sở thích**:
   - Tháng du lịch
   - Ngân sách
   - Loại hình du lịch
   - Mức độ mạo hiểm
   - Tỉnh thành muốn đi
   - Du lịch xanh/bền vững

3. **Nhận gợi ý cá nhân hóa**:
   - Danh sách destinations được AI phân tích
   - Điểm confidence cho mỗi gợi ý
   - Giải thích tại sao AI gợi ý
   - Thông tin chi tiết (rating, giá, lễ hội...)

4. **Đánh giá feedback**:
   - Rate từ 1-5 sao cho mỗi gợi ý
   - Hệ thống học hỏi và cải thiện

### Cho Developers

#### Khởi tạo hệ thống
```javascript
import { startAutoTraining } from './services/aiTrainingService';
import { generatePersonalizedRecommendations } from './ml/hybridRecommendationEngine';

// Bắt đầu auto-training
startAutoTraining();
```

#### Tạo gợi ý cho user
```javascript
const recommendations = await generatePersonalizedRecommendations(
    userId, 
    {
        month: 6,
        budget: 'medium',
        type: 'Nghỉ dưỡng',
        adventureLevel: 'high',
        ecoFriendly: true,
        provinces: ['Hà Nội', 'Đà Nẵng']
    },
    {
        topK: 10,
        includeExplanations: true,
        diversityBoost: true,
        noveltyBoost: true
    }
);
```

#### Ghi nhận feedback
```javascript
import { recordUserFeedback } from './services/recommendationService';

await recordUserFeedback(userId, destinationId, rating, {
    destination: destinationData,
    userPreferences: userPrefs,
    timestamp: new Date()
});
```

#### Training models
```javascript
import { trainAllAIModels } from './services/aiTrainingService';

// Manual training
const result = await trainAllAIModels();
console.log('Training result:', result);
```

## 🏗️ Kiến trúc hệ thống

```
src/ml/
├── collaborativeFiltering.js     # Neural Collaborative Filtering
├── contentBasedFiltering.js      # Content-based recommendations  
├── hybridRecommendationEngine.js # Hybrid engine kết hợp tất cả
├── userPreferenceModel.js        # Deep learning model
├── riskModel.js                  # Risk prediction model
└── trainer.js                    # Training coordinator

src/services/
├── recommendationService.js      # Main recommendation API
├── aiTrainingService.js         # Training management
└── firestoreService.js          # Database operations

src/components/
└── PersonalizedRecommendations.js # React UI component
```

## 📊 Dữ liệu và Training

### Dữ liệu đầu vào
- **User Feedback**: ratings, comments từ users
- **Trip History**: lịch sử các chuyến đi đã thực hiện
- **User Preferences**: sở thích được khai báo
- **Destination Features**: đặc điểm của các điểm đến
- **Contextual Data**: thời gian, thời tiết, sự kiện...

### Auto-training
- Hệ thống tự động retrain mỗi 24h nếu có đủ dữ liệu mới
- Kiểm tra chất lượng dữ liệu trước khi training
- Log training metrics để theo dõi performance

### Synthetic Data (Development)
```javascript
import { generateSyntheticData } from './services/aiTrainingService';

// Tạo dữ liệu test
await generateSyntheticData(20, 100); // 20 users, 100 feedbacks
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
- **Performance Tests**: Tốc độ generate recommendations
- **Accuracy Tests**: Độ chính xác (cần real data)

## ⚙️ Configuration

### Model weights (có thể điều chỉnh)
```javascript
// src/ml/hybridRecommendationEngine.js
this.weights = {
    collaborative: 0.4,    // Collaborative Filtering
    contentBased: 0.4,     // Content-Based Filtering  
    deepLearning: 0.2      // Deep Learning Model
};
```

### Training parameters
```javascript
// Collaborative Filtering
epochs: 50,
batchSize: 32,
embeddingSize: 50

// Content-Based
learningRate: 0.1,
similarityThreshold: 0.6

// Deep Learning  
epochs: 60,
batchSize: 8,
validationSplit: 0.2
```

## 🔧 Troubleshooting

### Lỗi thường gặp

1. **"Model not trained yet"**
   - Chạy `trainAllAIModels()` để train models
   - Kiểm tra có đủ dữ liệu training không

2. **"Not enough interaction data"**
   - Cần ít nhất 10 user interactions để train CF
   - Sử dụng `generateSyntheticData()` để test

3. **Recommendations trống**
   - Kiểm tra user có trong database không
   - Verify destinations data trong Firestore
   - Check console logs để debug

4. **Training fails**
   - Kiểm tra Firebase connection
   - Verify data format trong collections
   - Check memory usage (TensorFlow.js)

### Debug mode
```javascript
// Enable verbose logging
localStorage.setItem('AI_DEBUG', 'true');

// Check model status
console.log('CF Model:', collaborativeFilteringModel.model);
console.log('CB Model:', contentBasedFilteringModel.userProfiles);
```

## 📈 Performance Optimization

### Caching
- User profiles được cache trong memory
- Destination features được pre-compute
- Model predictions có cache với TTL

### Lazy Loading
- Models chỉ load khi cần thiết
- Batch processing cho multiple users
- Background training không block UI

### Scalability
- Sử dụng Web Workers cho heavy computations
- Implement model versioning
- Database indexing cho queries

## 🔮 Roadmap

### Phase 2 (Tương lai)
- [ ] **Real-time Recommendations**: Cập nhật gợi ý theo thời gian thực
- [ ] **Multi-modal AI**: Tích hợp image recognition cho destinations
- [ ] **Social Recommendations**: Gợi ý dựa trên bạn bè/social network
- [ ] **Advanced NLP**: Phân tích reviews và comments
- [ ] **Reinforcement Learning**: Tối ưu recommendations qua A/B testing

### Phase 3 (Advanced)
- [ ] **Federated Learning**: Training phân tán bảo vệ privacy
- [ ] **Explainable AI**: Giải thích chi tiết hơn về decisions
- [ ] **Cross-platform Sync**: Đồng bộ preferences across devices
- [ ] **Predictive Analytics**: Dự đoán trends du lịch

## 🤝 Contributing

### Thêm tính năng mới
1. Tạo branch từ `main`
2. Implement trong thư mục `src/ml/` hoặc `src/services/`
3. Thêm tests trong `src/utils/testAIRecommendations.js`
4. Update documentation
5. Tạo Pull Request

### Cải thiện models
1. Thử nghiệm với hyperparameters khác
2. Thêm features mới cho destinations
3. Implement algorithms mới
4. A/B test với users thật

---

**Liên hệ**: Nếu có câu hỏi về hệ thống AI, vui lòng tạo issue hoặc liên hệ team development.

**License**: MIT - Sử dụng tự do cho mục đích học tập và phát triển.