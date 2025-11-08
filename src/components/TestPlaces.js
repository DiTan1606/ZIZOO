// src/components/TestPlaces.js
import React, { useState } from 'react';
import { getTouristPlaces } from '../utils/getTouristPlaces';

export default function TestPlaces() {
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleTest = async () => {
        setLoading(true);
        try {
            const data = await getTouristPlaces('Đà Nẵng');
            setPlaces(data);
            console.log('THÀNH CÔNG:', data);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-10">
            <button
                onClick={handleTest}
                disabled={loading}
                className="bg-green-600 text-white px-8 py-4 rounded-lg font-bold"
            >
                {loading ? 'Đang tải...' : 'TEST ĐÀ NẴNG'}
            </button>

            <div className="grid grid-cols-3 gap-4 mt-8">
                {places.map(p => (
                    <div key={p.name} className="border rounded-lg overflow-hidden shadow">
                        <img src={p.photo} alt={p.name} className="w-full h-48 object-cover" />
                        <div className="p-3">
                            <h3 className="font-bold">{p.name}</h3>
                            <p className="text-sm text-gray-600">{p.address}</p>
                            <p className="text-yellow-600">★ {p.rating}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}