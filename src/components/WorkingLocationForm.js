// Branch 3: feature/working-location-ui
// Developer C - UI form nhập địa điểm làm việc

import React, { useState, useRef, useEffect } from 'react';
import './WorkingLocationForm.css';

const WorkingLocationForm = ({ tripDates, onAddWorkingLocation, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        coordinates: { lat: null, lng: null },
        startTime: '09:00',
        endTime: '17:00',
        workingDays: [],
        isAllDays: false,
        description: ''
    });

    const addressInputRef = useRef(null);
    const autocompleteRef = useRef(null);

    // Initialize Google Places Autocomplete
    useEffect(() => {
        let retryCount = 0;
        const maxRetries = 20; // Thử lại tối đa 20 lần (10 giây)

        const initAutocomplete = () => {
            if (!window.google || !window.google.maps || !window.google.maps.places) {
                retryCount++;
                if (retryCount < maxRetries) {
                    console.log(`Google Maps API chưa sẵn sàng, thử lại lần ${retryCount}...`);
                    setTimeout(initAutocomplete, 500);
                } else {
                    console.error('Google Maps API không load được sau 10 giây');
                    alert('Không thể tải Google Maps. Vui lòng refresh trang.');
                }
                return;
            }

            if (!addressInputRef.current) {
                console.log('Address input ref chưa sẵn sàng');
                setTimeout(initAutocomplete, 100);
                return;
            }

            try {
                console.log('✅ Khởi tạo Google Places Autocomplete...');
                
                // Xóa autocomplete cũ nếu có
                if (autocompleteRef.current) {
                    window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
                }

                autocompleteRef.current = new window.google.maps.places.Autocomplete(
                    addressInputRef.current,
                    {
                        componentRestrictions: { country: 'vn' },
                        fields: ['formatted_address', 'geometry', 'name', 'place_id'],
                        types: ['establishment', 'geocode']
                    }
                );

                autocompleteRef.current.addListener('place_changed', handlePlaceSelect);
                console.log('✅ Google Places Autocomplete đã sẵn sàng!');
            } catch (error) {
                console.error('❌ Lỗi khởi tạo Google Places:', error);
            }
        };

        // Bắt đầu khởi tạo
        initAutocomplete();

        return () => {
            if (autocompleteRef.current && window.google) {
                window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
            }
        };
    }, []);

    const handlePlaceSelect = () => {
        const place = autocompleteRef.current.getPlace();
        
        if (!place.geometry) {
            alert('Không tìm thấy địa chỉ này. Vui lòng chọn từ danh sách gợi ý.');
            return;
        }

        setFormData(prev => ({
            ...prev,
            address: place.formatted_address || place.name,
            coordinates: {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
            }
        }));
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleDayToggle = (date) => {
        setFormData(prev => ({
            ...prev,
            workingDays: prev.workingDays.includes(date)
                ? prev.workingDays.filter(d => d !== date)
                : [...prev.workingDays, date]
        }));
    };

    const handleAllDaysToggle = () => {
        setFormData(prev => ({
            ...prev,
            isAllDays: !prev.isAllDays,
            workingDays: !prev.isAllDays ? [] : prev.workingDays
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validation
        if (!formData.name.trim()) {
            alert('Vui lòng nhập tên địa điểm làm việc');
            return;
        }
        
        if (!formData.address.trim()) {
            alert('Vui lòng nhập địa chỉ');
            return;
        }
        
        if (!formData.coordinates.lat || !formData.coordinates.lng) {
            alert('Vui lòng chọn địa chỉ từ danh sách gợi ý để xác định vị trí chính xác');
            return;
        }
        
        if (!formData.isAllDays && formData.workingDays.length === 0) {
            alert('Vui lòng chọn ít nhất một ngày làm việc');
            return;
        }

        onAddWorkingLocation(formData);
    };

    return (
        <div className="working-location-form">
            <div className="form-header">
                <h3>Thêm địa điểm làm việc</h3>
                <p>Địa điểm này sẽ được cố định trong lịch trình</p>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Debug info - Xóa sau khi test xong */}
                {!window.google?.maps?.places && (
                    <div style={{
                        padding: '10px',
                        background: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: '8px',
                        marginBottom: '15px',
                        fontSize: '0.9rem'
                    }}>
                        ⚠️ Google Maps API chưa sẵn sàng. Vui lòng đợi...
                    </div>
                )}

                {/* Tên địa điểm */}
                <div className="form-group">
                    <label>Tên địa điểm làm việc *</label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="VD: Văn phòng công ty ABC, Hội nghị khách sạn XYZ"
                        required
                    />
                </div>

                {/* Địa chỉ với Google Places Autocomplete */}
                <div className="form-group">
                    <label>Địa chỉ * 
                        <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 'normal', marginLeft: '8px' }}>
                            (Gõ và chọn từ danh sách gợi ý)
                        </span>
                    </label>
                    <input
                        ref={addressInputRef}
                        type="text"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        placeholder="VD: 123 Đường ABC, Quận 1, TP.HCM"
                        required
                    />
                    {formData.coordinates.lat && formData.coordinates.lng && (
                        <div style={{ 
                            fontSize: '0.85rem', 
                            color: '#28a745', 
                            marginTop: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}>
                            ✓ Đã xác định vị trí: {formData.coordinates.lat.toFixed(6)}, {formData.coordinates.lng.toFixed(6)}
                        </div>
                    )}
                </div>

                {/* Thời gian làm việc */}
                <div className="form-row form-row-two-cols">
                    <div className="form-group">
                        <label>Giờ bắt đầu *</label>
                        <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => handleInputChange('startTime', e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Giờ kết thúc *</label>
                        <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => handleInputChange('endTime', e.target.value)}
                            required
                        />
                    </div>
                </div>

                {/* Chọn ngày làm việc */}
                <div className="form-group">
                    <label>Ngày làm việc *</label>
                    
                    <div className="all-days-toggle">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.isAllDays}
                                onChange={handleAllDaysToggle}
                            />
                            <span>Áp dụng cho tất cả các ngày trong chuyến đi</span>
                        </label>
                    </div>

                    {!formData.isAllDays && (
                        <div className="working-days-selector">
                            {tripDates.map((date, index) => (
                                <button
                                    key={date}
                                    type="button"
                                    className={`day-button ${formData.workingDays.includes(date) ? 'active' : ''}`}
                                    onClick={() => handleDayToggle(date)}
                                >
                                    <div className="day-label">Ngày {index + 1}</div>
                                    <div className="day-date">{new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mô tả */}
                <div className="form-group">
                    <label>Mô tả (tùy chọn)</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Ghi chú về công việc, cuộc họp..."
                        rows="3"
                    />
                </div>

                {/* Buttons */}
                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={onCancel}>
                        Hủy
                    </button>
                    <button type="submit" className="btn-submit">
                        Thêm địa điểm
                    </button>
                </div>
            </form>
        </div>
    );
};

export default WorkingLocationForm;
