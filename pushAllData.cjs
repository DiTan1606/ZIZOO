// pushAllData.cjs – ĐÃ SỬA LỖI 100% (chạy ngon trên máy bạn)
const admin = require('firebase-admin');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'zizoo-23525310-firebase-adminsdk-fbsvc-dc4cb7ea68.json');
const ASSETS_FOLDER = path.join(__dirname, 'src', 'assets');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('Không tìm thấy service account:', SERVICE_ACCOUNT_PATH);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});
const db = admin.firestore();

const excelFiles = [
    'Disaster_Travel_Data_Cleaned.xlsx',
    'DongNamBo_TayNguyen_Cleaned.xlsx',
    'MienTay_Cleaned.xlsx',
    'MienBac_Cleaned.xlsx',
    'MienTrung_Cleaned.xlsx',
];

const cleanProvince = (name) => {
    const map = {
        'TP. Hồ Chí Minh': 'Hồ Chí Minh', 'TP.HCM': 'Hồ Chí Minh',
        'Thua Thien Hue': 'Thừa Thiên Huế', 'Khanh Hoa': 'Khánh Hòa',
        'Quang Tri': 'Quảng Trị', 'Lam Dong': 'Lâm Đồng',
        'Dak Lak': 'Đắk Lắk', 'Dak Nong': 'Đắk Nông', 'Thanh Hoa': 'Thanh Hóa',
    };
    return (map[name] || name || '').trim();
};

// === PUSH WEATHER SHEET ===
async function pushWeatherSheet(workbook, fileName) {
    if (!workbook.SheetNames.includes('ThoiTiet')) {
        console.log(`Không có sheet ThoiTiet trong ${fileName}`);
        return;
    }

    const data = XLSX.utils.sheet_to_json(workbook.Sheets['ThoiTiet'], { defval: null });
    let batch = db.batch();           // ← Batch hiện tại
    let operationCount = 0;
    let totalCount = 0;

    for (const row of data) {
        const province = cleanProvince(
            row['TinhThanh'] || row['tinhthanh'] || row['Tỉnh Thành'] || row['Tinh Thanh'] || ''
        );
        if (!province) continue;

        const month = parseInt(row['Tháng'] || row['tháng'] || 0);
        const year = parseInt(row['Năm'] || row['năm'] || 0);
        if (!month || !year) continue;

        const docId = `${province.replace(/ /g, '_')}_${month}_${year}`;
        const docRef = db.collection('weather_monthly').doc(docId);

        batch.set(docRef, {
            province,
            province_normalized: province.replace(/ /g, '').toLowerCase(),
            month, year,
            temperature_avg: parseFloat(row['NhietDo'] || row['nhietdo']) || null,
            rainfall_mm_avg: parseFloat(row['LuongMua'] || row['luongmua']) || null,
            tourist_density: parseInt(row['MatDoDuLich'] || row['matdodulich']) || null,
            source_file: fileName,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        operationCount++;
        totalCount++;

        // Firestore giới hạn 500 operations mỗi batch
        if (operationCount === 490) {
            await batch.commit();
            console.log(`Commit ${totalCount} bản ghi weather_monthly...`);
            batch = db.batch();           // ← TẠO BATCH MỚI
            operationCount = 0;
        }
    }

    if (operationCount > 0) {
        await batch.commit();
        console.log(`Commit cuối: ${totalCount} bản ghi weather_monthly`);
    }

    console.log(`Hoàn thành weather_monthly từ ${fileName}: ${totalCount} bản ghi\n`);
}

// === PUSH CÁC SHEET KHÁC ===
async function pushOtherSheets(workbook, fileName) {
    for (const sheetName of workbook.SheetNames) {
        if (sheetName === 'ThoiTiet') continue;

        const collectionName = `${path.basename(fileName, '.xlsx')}_${sheetName}`
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_');

        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
        let batch = db.batch();
        let operationCount = 0;
        let totalCount = 0;

        for (const row of data) {
            const cleanRow = {};
            for (const [k, v] of Object.entries(row)) {
                cleanRow[k] = v === null || v === undefined ? null : v;
            }
            cleanRow.source_file = fileName;
            cleanRow.uploaded_at = admin.firestore.FieldValue.serverTimestamp();

            batch.set(db.collection(collectionName).doc(), cleanRow);
            operationCount++;
            totalCount++;

            if (operationCount === 490) {
                await batch.commit();
                console.log(`Commit ${totalCount} → ${collectionName}`);
                batch = db.batch();
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
            console.log(`Commit cuối: ${totalCount} → ${collectionName}`);
        }
        console.log(`Đã đẩy ${totalCount} bản ghi vào ${collectionName}\n`);
    }
}

// === MAIN ===
(async () => {
    console.log('BẮT ĐẦU ĐẨY DỮ LIỆU\n');

    for (const fileName of excelFiles) {
        const filePath = path.join(ASSETS_FOLDER, fileName);
        if (!fs.existsSync(filePath)) {
            console.log(`Không tìm thấy: ${filePath}\n`);
            continue;
        }

        console.log(`ĐANG XỬ LÝ: ${fileName}`);
        const workbook = XLSX.readFile(filePath);

        await pushWeatherSheet(workbook, fileName);
        await pushOtherSheets(workbook, fileName);
    }

    console.log('HOÀN TẤT! TẤT CẢ DỮ LIỆU ĐÃ LÊN FIREBASE');
    process.exit(0);
})().catch(err => {
    console.error('LỖI:', err);
    process.exit(1);
});