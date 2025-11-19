// src/components/DestinationSelector.js
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { searchPlacesByText, initPlacesService } from '../services/placesService';
import provinceCoords from '../assets/provinceCoord.json';
import './DestinationSelector.css';

// Import icons
import tddtcIcon from '../icon/tddtc.png';
import ctcIcon from '../icon/ctc.png';
import bctcIcon from '../icon/bctc.png';

const DestinationSelector = ({ preferences, onConfirm, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [destinations, setDestinations] = useState([]);
    const [selectedDestinations, setSelectedDestinations] = useState([]);
    const [activeCategory, setActiveCategory] = useState('all');
    const [placesServiceReady, setPlacesServiceReady] = useState(false);
    
    // Custom destination input
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customDestination, setCustomDestination] = useState({
        name: '',
        address: '',
        preferredTime: '',
        duration: '2',
        type: 'tourist_attraction',
        price: ''
    });

    const categories = [
        { id: 'all', name: 'Tất cả', icon: '🗺️' },
        { id: 'tourist_attraction', name: 'Tham quan', icon: '🏛️' },
        { id: 'restaurant', name: 'Nhà hàng', icon: '🍽️' },
        { id: 'cafe', name: 'Cà phê', icon: '☕' },
        { id: 'park', name: 'Công viên', icon: '🌳' },
        { id: 'museum', name: 'Bảo tàng', icon: '🎨' },
        { id: 'shopping_mall', name: 'Mua sắm', icon: '🛍️' },
        { id: 'night_club', name: 'Giải trí', icon: '🎉' }
    ];

    // Initialize Places Service
    useEffect(() => {
        const initService = async () => {
            try {
                // Wait for Google Maps API to load
                await new Promise((resolve) => {
                    if (window.google?.maps?.places) {
                        resolve();
                    } else {
                        const checkInterval = setInterval(() => {
                            if (window.google?.maps?.places) {
                                clearInterval(checkInterval);
                                resolve();
                            }
                        }, 100);
                        
                        // Timeout after 10 seconds
                        setTimeout(() => {
                            clearInterval(checkInterval);
                            resolve();
                        }, 10000);
                    }
                });

                // Create a hidden map for Places Service if not exists
                if (!window.hiddenMapForPlaces) {
                    const mapDiv = document.createElement('div');
                    mapDiv.style.display = 'none';
                    document.body.appendChild(mapDiv);
                    
                    window.hiddenMapForPlaces = new window.google.maps.Map(mapDiv, {
                        center: { lat: 16.047, lng: 108.220 },
                        zoom: 10
                    });
                }

                // Initialize Places Service
                const success = initPlacesService(window.hiddenMapForPlaces);
                setPlacesServiceReady(success);
                
                if (!success) {
                    toast.warning('⚠️ Google Maps Places API không khả dụng. Vui lòng thêm địa điểm tùy chỉnh.');
                }
            } catch (error) {
                console.error('Error initializing Places Service:', error);
                setPlacesServiceReady(false);
            }
        };

        initService();
    }, []);

    useEffect(() => {
        if (placesServiceReady) {
            loadDestinations();
        }
    }, [preferences.destination, placesServiceReady]);

    const loadDestinations = async () => {
        if (!placesServiceReady) {
            console.warn('Places Service not ready yet');
            setLoading(false);
            setDestinations([]);
            return;
        }

        setLoading(true);
        try {
            const coord = provinceCoords[preferences.destination] || { lat: 16.047, lng: 108.220 };
            
            // Tìm kiếm địa điểm theo từng danh mục
            const allPlaces = [];
            
            for (const category of categories) {
                if (category.id === 'all') continue;
                
                try {
                    const query = `${category.name} ở ${preferences.destination}`;
                    const results = await searchPlacesByText(query, coord, 20000, preferences.destination);
                    
                    const places = results.slice(0, 10).map(place => ({
                        id: place.place_id,
                        name: place.name,
                        address: place.vicinity || place.formatted_address,
                        rating: place.rating || 0,
                        userRatingsTotal: place.user_ratings_total || 0,
                        types: place.types || [],
                        category: category.id,
                        categoryName: category.name,
                        categoryIcon: category.icon,
                        lat: place.geometry?.location?.lat,
                        lng: place.geometry?.location?.lng,
                        photos: place.photos || [],
                        priceLevel: place.price_level || 2,
                        openNow: place.opening_hours?.open_now
                    }));
                    
                    allPlaces.push(...places);
                } catch (error) {
                    console.warn(`Không thể tải ${category.name}:`, error);
                    // KHÔNG TẠO FALLBACK DATA - chỉ log lỗi
                }
            }
            
            // Loại bỏ trùng lặp
            const uniquePlaces = Array.from(
                new Map(allPlaces.map(place => [place.id, place])).values()
            );
            
            // Sắp xếp theo rating
            uniquePlaces.sort((a, b) => b.rating - a.rating);
            
            setDestinations(uniquePlaces);
            
            if (uniquePlaces.length === 0) {
                toast.warning('⚠️ Không tìm thấy địa điểm nào. Vui lòng kiểm tra Google Maps API key hoặc thêm địa điểm tùy chỉnh.');
            } else {
                console.log(`✅ Đã tải ${uniquePlaces.length} địa điểm`);
            }
        } catch (error) {
            console.error('Lỗi tải địa điểm:', error);
            toast.error('❌ Không thể tải danh sách địa điểm. Vui lòng thêm địa điểm tùy chỉnh.');
            setDestinations([]); // Đặt mảng rỗng thay vì fallback data
        } finally {
            setLoading(false);
        }
    };

    const toggleDestination = (destination) => {
        setSelectedDestinations(prev => {
            const exists = prev.find(d => d.id === destination.id);
            if (exists) {
                return prev.filter(d => d.id !== destination.id);
            } else {
                // Thêm với thông tin thời gian mặc định
                return [...prev, {
                    ...destination,
                    preferredTime: '',
                    duration: '2',
                    isCustom: false
                }];
            }
        });
    };

    const updateDestinationTime = (destinationId, field, value) => {
        setSelectedDestinations(prev => 
            prev.map(d => 
                d.id === destinationId 
                    ? { ...d, [field]: value }
                    : d
            )
        );
    };

    const addCustomDestination = () => {
        if (!customDestination.name.trim()) {
            toast.warning('Vui lòng nhập tên địa điểm!');
            return;
        }

        // Get category info based on type
        const categoryInfo = categories.find(cat => cat.id === customDestination.type) || {
            id: 'other',
            name: 'Khác',
            icon: '📍'
        };

        const newDestination = {
            id: `custom_${Date.now()}`,
            name: customDestination.name,
            address: customDestination.address || preferences.destination,
            rating: 0,
            userRatingsTotal: 0,
            types: [customDestination.type],
            category: customDestination.type,
            categoryName: categoryInfo.name,
            categoryIcon: categoryInfo.icon,
            preferredTime: customDestination.preferredTime,
            duration: customDestination.duration,
            isCustom: true,
            // Price info
            price: customDestination.price ? parseInt(customDestination.price) : null,
            priceLevel: customDestination.price ? calculatePriceLevel(parseInt(customDestination.price)) : 2,
            // Store original type for better categorization
            placeType: customDestination.type
        };

        setSelectedDestinations(prev => [...prev, newDestination]);
        
        // Reset form
        setCustomDestination({
            name: '',
            address: '',
            preferredTime: '',
            duration: '2',
            type: 'tourist_attraction',
            price: ''
        });
        setShowCustomInput(false);
        
        toast.success(`✅ Đã thêm "${newDestination.name}"`);
    };

    // Helper function to calculate price level from VND
    const calculatePriceLevel = (price) => {
        if (price < 50000) return 1;      // Rẻ
        if (price < 200000) return 2;     // Trung bình
        if (price < 500000) return 3;     // Cao
        return 4;                          // Rất cao
    };

    const removeDestination = (destinationId) => {
        setSelectedDestinations(prev => prev.filter(d => d.id !== destinationId));
    };

    const toggleAll = () => {
        const filtered = getFilteredDestinations();
        if (selectedDestinations.length === filtered.length) {
            setSelectedDestinations([]);
        } else {
            setSelectedDestinations(filtered);
        }
    };

    const getFilteredDestinations = () => {
        if (activeCategory === 'all') {
            return destinations;
        }
        return destinations.filter(d => d.category === activeCategory);
    };

    const handleConfirm = () => {
        if (selectedDestinations.length === 0) {
            toast.warning('Vui lòng chọn ít nhất một địa điểm!');
            return;
        }

        // Kiểm tra xem có địa điểm nào có thời gian trùng không
        const timesSet = selectedDestinations
            .filter(d => d.preferredTime)
            .map(d => d.preferredTime);
        
        const hasDuplicates = timesSet.length !== new Set(timesSet).size;
        
        if (hasDuplicates) {
            toast.warning('⚠️ Có địa điểm trùng khung giờ! Hệ thống sẽ tự động điều chỉnh.');
        }
        
        onConfirm(selectedDestinations);
    };

    const getPriceText = (priceLevel) => {
        const prices = ['Rất rẻ', 'Rẻ', 'Trung bình', 'Đắt', 'Rất đắt'];
        return prices[priceLevel] || 'Chưa rõ';
    };

    const filteredDestinations = getFilteredDestinations();
    const allSelected = selectedDestinations.length === filteredDestinations.length && filteredDestinations.length > 0;

    if (loading) {
        return (
            <div className="destination-selector">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Đang tìm kiếm địa điểm tại {preferences.destination}...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="destination-selector">
            <div className="selector-header">
                <h1><strong>Chọn địa điểm bạn muốn đi</strong></h1>
                <p>Chọn các địa điểm bạn quan tâm và chỉ định khung giờ (tùy chọn)</p>
                <div className="selection-summary">
                    <span className="selected-count">
                        Đã chọn: <strong>{selectedDestinations.length}</strong> địa điểm
                    </span>
                    <div className="header-actions">
                        <button 
                            className="add-custom-btn"
                            onClick={() => setShowCustomInput(!showCustomInput)}
                        >
                            <img src={tddtcIcon} alt="Thêm" className="btn-icon" />
                            Thêm địa điểm tùy chỉnh
                        </button>
                        <button 
                            className="toggle-all-btn"
                            onClick={toggleAll}
                        >
                            <img src={allSelected ? bctcIcon : ctcIcon} alt={allSelected ? "Bỏ chọn" : "Chọn"} className="btn-icon" />
                            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Custom Destination Input */}
            {showCustomInput && (
                <div className="custom-input-panel">
                    <h3> Thêm địa điểm tùy chỉnh</h3>
                    <div className="custom-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Tên địa điểm *</label>
                                <input
                                    type="text"
                                    placeholder="VD: Nhà hàng ABC, Chùa XYZ..."
                                    value={customDestination.name}
                                    onChange={(e) => setCustomDestination(prev => ({
                                        ...prev,
                                        name: e.target.value
                                    }))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Địa chỉ (tùy chọn)</label>
                                <input
                                    type="text"
                                    placeholder="VD: 123 Đường ABC, Quận 1..."
                                    value={customDestination.address}
                                    onChange={(e) => setCustomDestination(prev => ({
                                        ...prev,
                                        address: e.target.value
                                    }))}
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Loại địa điểm *</label>
                                <select
                                    value={customDestination.type}
                                    onChange={(e) => setCustomDestination(prev => ({
                                        ...prev,
                                        type: e.target.value
                                    }))}
                                >
                                    <option value="tourist_attraction">🏛️ Tham quan</option>
                                    <option value="restaurant">🍽️ Nhà hàng</option>
                                    <option value="cafe">☕ Cà phê</option>
                                    <option value="park">🌳 Công viên</option>
                                    <option value="museum">🎨 Bảo tàng</option>
                                    <option value="shopping_mall">🛍️ Mua sắm</option>
                                    <option value="night_club">🎉 Giải trí</option>
                                    <option value="hotel">🏨 Khách sạn</option>
                                    <option value="beach">🏖️ Bãi biển</option>
                                    <option value="temple">🏯 Đền/Chùa</option>
                                    <option value="market">🏪 Chợ</option>
                                    <option value="other">📍 Khác</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Giá (VNĐ) - tùy chọn</label>
                                <input
                                    type="number"
                                    placeholder="VD: 100000"
                                    value={customDestination.price}
                                    onChange={(e) => setCustomDestination(prev => ({
                                        ...prev,
                                        price: e.target.value
                                    }))}
                                    min="0"
                                    step="1000"
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Khung giờ mong muốn (tùy chọn)</label>
                                <input
                                    type="time"
                                    value={customDestination.preferredTime}
                                    onChange={(e) => setCustomDestination(prev => ({
                                        ...prev,
                                        preferredTime: e.target.value
                                    }))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Thời gian tham quan (giờ)</label>
                                <select
                                    value={customDestination.duration}
                                    onChange={(e) => setCustomDestination(prev => ({
                                        ...prev,
                                        duration: e.target.value
                                    }))}
                                >
                                    <option value="0.5">30 phút</option>
                                    <option value="1">1 giờ</option>
                                    <option value="1.5">1.5 giờ</option>
                                    <option value="2">2 giờ</option>
                                    <option value="3">3 giờ</option>
                                    <option value="4">4 giờ</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button 
                                className="cancel-btn"
                                onClick={() => setShowCustomInput(false)}
                            >
                                Hủy
                            </button>
                            <button 
                                className="add-btn-custom"
                                onClick={addCustomDestination}
                            >
                                 Thêm địa điểm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selected Destinations Panel */}
            {selectedDestinations.length > 0 && (
                <div className="selected-panel">
                    <h3>📋 Địa điểm đã chọn ({selectedDestinations.length})</h3>
                    <div className="selected-list">
                        {selectedDestinations.map((dest, index) => (
                            <div key={dest.id} className="selected-item">
                                <div className="item-header">
                                    <span className="item-number">{index + 1}</span>
                                    <span className="item-name">{dest.name}</span>
                                    {dest.isCustom && <span className="custom-badge">Tùy chỉnh</span>}
                                    {dest.categoryIcon && (
                                        <span className="category-icon" title={dest.categoryName}>
                                            {dest.categoryIcon}
                                        </span>
                                    )}
                                    {dest.price && (
                                        <span className="price-badge" title="Giá dự kiến">
                                            💰 {dest.price.toLocaleString('vi-VN')}đ
                                        </span>
                                    )}
                                    <button 
                                        className="remove-btn-text"
                                        onClick={() => removeDestination(dest.id)}
                                        title="Xóa"
                                    >
                                        ✕ Xóa
                                    </button>
                                </div>
                                {dest.address && (
                                    <div className="item-address">
                                        📍 {dest.address}
                                    </div>
                                )}
                                <div className="item-controls">
                                    <div className="control-group">
                                        <label>⏰ Khung giờ:</label>
                                        <input
                                            type="time"
                                            value={dest.preferredTime || ''}
                                            onChange={(e) => updateDestinationTime(dest.id, 'preferredTime', e.target.value)}
                                            placeholder="Tùy chọn"
                                        />
                                    </div>
                                    <div className="control-group">
                                        <label>⏱️ Thời gian:</label>
                                        <select
                                            value={dest.duration || '2'}
                                            onChange={(e) => updateDestinationTime(dest.id, 'duration', e.target.value)}
                                        >
                                            <option value="0.5">30 phút</option>
                                            <option value="1">1 giờ</option>
                                            <option value="1.5">1.5 giờ</option>
                                            <option value="2">2 giờ</option>
                                            <option value="3">3 giờ</option>
                                            <option value="4">4 giờ</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="panel-note">
                        💡 <strong>Lưu ý:</strong> Nếu không chọn khung giờ, hệ thống sẽ tự động sắp xếp hợp lý
                    </div>
                </div>
            )}

            <div className="category-tabs">
                {categories.map(category => {
                    const count = category.id === 'all' 
                        ? destinations.length 
                        : destinations.filter(d => d.category === category.id).length;
                    
                    return (
                        <button
                            key={category.id}
                            className={`category-tab ${activeCategory === category.id ? 'active' : ''}`}
                            onClick={() => setActiveCategory(category.id)}
                        >
                            <span className="category-icon">{category.icon}</span>
                            <span className="category-name">{category.name}</span>
                            <span className="category-count">({count})</span>
                        </button>
                    );
                })}
            </div>

            <div className="destinations-grid">
                {filteredDestinations.length === 0 ? (
                    <div className="no-results">
                        <div className="no-results-icon">📍</div>
                        <h3>Không tìm thấy địa điểm nào</h3>
                        <p>
                            {destinations.length === 0 
                                ? 'Google Maps API không khả dụng. Vui lòng thêm địa điểm tùy chỉnh bằng nút bên trên.'
                                : 'Không có địa điểm nào trong danh mục này. Hãy thử danh mục khác hoặc thêm địa điểm tùy chỉnh.'
                            }
                        </p>
                        <button 
                            className="add-custom-btn-large"
                            onClick={() => setShowCustomInput(true)}
                        >
                            ➕ Thêm địa điểm tùy chỉnh
                        </button>
                    </div>
                ) : (
                    filteredDestinations.map(destination => {
                        const isSelected = selectedDestinations.find(d => d.id === destination.id);
                        
                        return (
                            <div
                                key={destination.id}
                                className={`destination-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleDestination(destination)}
                            >
                                <div className="card-header">
                                    <div className="checkbox">
                                        {isSelected && <span>✓</span>}
                                    </div>
                                    <span className="category-badge">
                                        {destination.categoryIcon} {destination.categoryName}
                                    </span>
                                </div>
                                
                                <div className="card-body">
                                    <h3 className="destination-name">{destination.name}</h3>
                                    <p className="destination-address">{destination.address}</p>
                                    
                                    <div className="destination-info">
                                        <div className="info-item">
                                            <span className="rating">
                                                ⭐ {destination.rating.toFixed(1)}
                                            </span>
                                            <span className="reviews">
                                                ({destination.userRatingsTotal} đánh giá)
                                            </span>
                                        </div>
                                        
                                        <div className="info-item">
                                            <span className="price">
                                                💰 {getPriceText(destination.priceLevel)}
                                            </span>
                                        </div>
                                        
                                        {destination.openNow !== undefined && (
                                            <div className="info-item">
                                                <span className={`status ${destination.openNow ? 'open' : 'closed'}`}>
                                                    {destination.openNow ? '🟢 Đang mở cửa' : '🔴 Đã đóng cửa'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="selector-actions">
                <button 
                    className="back-btn"
                    onClick={onBack}
                >
                     Quay lại
                </button>
                <button 
                    className="confirm-btn"
                    onClick={handleConfirm}
                    disabled={selectedDestinations.length === 0}
                >
                    Tiếp tục với {selectedDestinations.length} địa điểm đã chọn 
                </button>
            </div>
        </div>
    );
};

export default DestinationSelector;
