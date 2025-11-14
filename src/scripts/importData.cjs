// src/scripts/importAllData.cjs
const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const {
    getFirestore, collection, addDoc, writeBatch, doc, getDocs, query, where
} = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === DANH SÁCH FILE & CẤU HÌNH IMPORT ===
const IMPORT_CONFIG = [
    // 1. Đông Nam Bộ + Tây Nguyên
    {
        file: 'DongNamBo_TayNguyen_Cleaned.xlsx',
        sheets: [
            { name: 'TinhThanh', coll: 'provinces', idField: 'TenTinhThanh' },
            { name: 'DacDiem', coll: 'province_features', idField: 'TinhThanh' },
            { name: 'DiaDiem', coll: 'attractions', idField: 'DiaDiem' },
            { name: 'ThoiTiet', coll: 'weather_sample' },
            { name: 'LeHoi', coll: 'festivals' },
            { name: 'DacSan', coll: 'specialties', idField: 'DacSanNoiTieng' },
        ]
    },
    // 2. Disaster Data
    {
        file: 'Disaster_Travel_Data_Cleaned.xlsx',
        sheets: [
            { name: 'Provinces', coll: 'provinces', idField: 'Province_Name' },
            { name: 'Storms_Cleaned', coll: 'storms' },
            { name: 'Floods_Cleaned', coll: 'floods' },
            { name: 'Travel_Suggestions', coll: 'travel_suggestions' },
            { name: 'Festivals_Cleaned', coll: 'festivals' },
            { name: 'Disaster_Summary', coll: 'disaster_summary' },
        ]
    },
    // 3. Miền Bắc
    {
        file: 'MienBac_Cleaned.xlsx',
        sheets: [
            { name: 'TinhThanh', coll: 'provinces', idField: 'TenTinhThanh' },
            { name: 'DacDiem', coll: 'province_features', idField: 'TinhThanh' },
            { name: 'DiaDiem', coll: 'attractions', idField: 'DiaDiem' },
            { name: 'ThoiTiet', coll: 'weather_sample' },
            { name: 'LeHoi', coll: 'festivals' },
            { name: 'DacSan', coll: 'specialties', idField: 'DacSanNoiTieng' },
        ]
    },
    // 4. Miền Tây
    {
        file: 'MienTay_Cleaned.xlsx',
        sheets: [
            { name: 'TinhThanh', coll: 'provinces', idField: 'TenTinhThanh' },
            { name: 'DacDiem', coll: 'province_features', idField: 'TinhThanh' },
            { name: 'DiaDiem', coll: 'attractions', idField: 'DiaDiem' },
            { name: 'ThoiTiet', coll: 'weather_sample' },
            { name: 'LeHoi', coll: 'festivals' },
            { name: 'DacSan', coll: 'specialties', idField: 'DacSanNoiTieng' },
        ]
    },
    // 5. Miền Trung
    {
        file: 'MienTrung_Cleaned.xlsx',
        sheets: [
            { name: 'TinhThanh', coll: 'provinces', idField: 'TenTinhThanh' },
            { name: 'DacDiem', coll: 'province_features', idField: 'TinhThanh' },
            { name: 'DiaDiem', coll: 'attractions', idField: 'DiaDiem' },
            { name: 'ThoiTiet', coll: 'weather_sample' },
            { name: 'LeHoi', coll: 'festivals' },
            { name: 'DacSan', coll: 'specialties', idField: 'DacSanNoiTieng' },
        ]
    },
];

// === HÀM LÀM SẠCH DỮ LIỆU ===
function cleanValue(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return value;
    return String(value).trim();
}

function cleanObject(obj) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        cleaned[key] = cleanValue(value);
    }
    return cleaned;
}

// === HÀM KIỂM TRA TRÙNG (nếu có idField) ===
async function getExistingIds(coll, idField) {
    const q = query(collection(db, coll));
    const snap = await getDocs(q);
    const ids = new Set();
    snap.forEach(doc => {
        const data = doc.data();
        if (data[idField]) ids.add(String(data[idField]));
    });
    return ids;
}

// === HÀM ĐẨY BATCH ===
async function uploadBatch(collectionName, docs, idField = null) {
    if (docs.length === 0) return;

    const existingIds = idField ? await getExistingIds(collectionName, idField) : new Set();
    let batch = writeBatch(db);
    let count = 0;

    for (const raw of docs) {
        const cleaned = cleanObject(raw);
        const docId = idField ? String(cleaned[idField]) : null;

        if (idField && existingIds.has(docId)) {
            console.log(`BỎ QUA (trùng): ${collectionName} - ${docId}`);
            continue;
        }

        const ref = docId
            ? doc(db, collectionName, docId)
            : doc(collection(db, collectionName));

        batch.set(ref, cleaned);
        count++;

        if (count % 500 === 0) {
            await batch.commit();
            console.log(`  Đã commit ${count} docs vào ${collectionName}...`);
            batch = writeBatch(db);
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`HOÀN TẤT: ${collectionName} → ${count} docs mới`);
    }
}

// === HÀM IMPORT 1 SHEET ===
async function importSheet(filePath, sheetConfig) {
    const { name: sheetName, coll, idField } = sheetConfig;
    console.log(`\nĐang đọc: ${filePath} → Sheet: ${sheetName} → Collection: ${coll}`);

    try {
        const workbook = XLSX.readFile(filePath);
        if (!workbook.Sheets[sheetName]) {
            console.log(`Sheet "${sheetName}" không tồn tại → BỎ QUA`);
            return;
        }

        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
        console.log(`Tìm thấy ${data.length} bản ghi`);

        await uploadBatch(coll, data, idField);
    } catch (err) {
        console.error(`LỖI đọc file ${filePath}[${sheetName}]:`, err.message);
    }
}

// === HÀM CHÍNH ===
(async () => {
    console.log('BẮT ĐẦU IMPORT TOÀN BỘ DỮ LIỆU...');

    for (const config of IMPORT_CONFIG) {
        const filePath = `/Users/kelvin/Downloads/DoAn/ZIZOO/src/assets/${config.file}`;
        if (!require('fs').existsSync(filePath)) {
            console.log(`KHÔNG TÌM THẤY FILE: ${filePath} → BỎ QUA`);
            continue;
        }

        for (const sheet of config.sheets) {
            await importSheet(filePath, sheet);
        }
    }

    console.log('\nTOÀN BỘ DỮ LIỆU ĐÃ ĐƯỢC ĐẨY LÊN FIRESTORE!');
    process.exit(0);
})();