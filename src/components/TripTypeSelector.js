// Branch 1: feature/trip-type-selector
// Developer A - UI chọn loại hình du lịch

import React from 'react';
import './TripTypeSelector.css';

const TripTypeSelector = ({ selectedType, onTypeChange }) => {
    const tripTypes = [
        {
            value: 'pure-travel',
            name: 'Thuần Du lịch',
            icon: '🏖️',
            description: 'Chuyến đi hoàn toàn dành cho nghỉ dưỡng và khám phá'
        },
        {
            value: 'business-travel',
            name: 'Công tác + Du lịch',
            icon: '💼',
            description: 'Kết hợp công việc và du lịch trong cùng chuyến đi'
        }
    ];

    return (
        <div className="trip-type-selector">
            <h3>Chọn loại hình chuyến đi</h3>
            <div className="trip-type-options">
                {tripTypes.map(type => (
                    <button
                        key={type.value}
                        className={`trip-type-card ${selectedType === type.value ? 'active' : ''}`}
                        onClick={() => onTypeChange(type.value)}
                    >
                        <div className="trip-type-icon">{type.icon}</div>
                        <div className="trip-type-name">{type.name}</div>
                        <div className="trip-type-desc">{type.description}</div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default TripTypeSelector;
