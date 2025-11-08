// src/scripts/importData.cjs
const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
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

// Danh sách file mới
const files = [
    { file: '1_bao_lichsu_ml.xlsx', sheet: '1_bao_lichsu_ml', coll: 'storms' },
    { file: '2_lu_chitiet_ml.xlsx', sheet: '2_lu_chitiet_ml', coll: 'floods' },
    { file: '3_diemden_hot_ml.xlsx', sheet: '3_diemden_hot_ml', coll: 'destinations' },
    { file: '4_lehoi_dongkhach_ml.xlsx', sheet: '4_lehoi_dongkhach_ml', coll: 'festivals' },
];

function cleanValue(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return !isNaN(num) ? num : String(value).trim();
}

async function importFile({ file, sheet, coll }) {
    const workbook = XLSX.readFile(`src/assets/${file}`);
    const ws = workbook.Sheets[sheet];
    if (!ws) {
        console.log(`Sheet "${sheet}" không tồn tại trong ${file} → BỎ QUA`);
        return;
    }

    const data = XLSX.utils.sheet_to_json(ws, { defval: null });
    console.log(`Đang import ${coll}: ${data.length} bản ghi...`);

    let success = 0, fail = 0;
    for (const raw of data) {
        const cleaned = {};
        for (const key in raw) {
            cleaned[key] = cleanValue(raw[key]);
        }
        try {
            await addDoc(collection(db, coll), cleaned);
            success++;
        } catch (err) {
            console.error(`LỖI ${coll}:`, cleaned, err.message);
            fail++;
        }
    }
    console.log(`${coll}: THÀNH CÔNG ${success}, THẤT BẠI ${fail}`);
}

(async () => {
    try {
        for (const config of files) {
            await importFile(config);
        }
        console.log('IMPORT 4 FILE MỚI HOÀN TẤT!');
    } catch (e) {
        console.error('LỖI CHUNG:', e);
    }
})();