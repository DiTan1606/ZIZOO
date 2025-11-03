import React, { useEffect, useState } from 'react';
import './App.css';
import { db } from './firebase'; // <-- 1. Import 'db' từ file config
import { collection, getDocs } from 'firebase/firestore'; // <-- 2. Import hàm của Firestore

function App() {
  const [message, setMessage] = useState("Đang kết nối tới CSDL...");

  // Dùng useEffect để chạy code 1 lần khi app khởi động
  useEffect(() => {
    // 3. Định nghĩa một hàm async để lấy data
    const testFirestoreConnection = async () => {
      try {
        console.log("Đang thử đọc collection 'test'...");

        // 4. Gọi CSDL: Lấy tất cả document từ collection 'test'
        const querySnapshot = await getDocs(collection(db, "test"));

        if (querySnapshot.empty) {
          setMessage("Kết nối CSDL thành công, nhưng collection 'test' bị rỗng.");
          console.log("Không tìm thấy document nào trong 'test'.");
        } else {
          // 5. Lấy data từ document đầu tiên
          const docData = querySnapshot.docs[0].data();
          setMessage(`Kết nối CSDL thành công! Data: ${docData.message}`); // Hiển thị data
          console.log("DỮ LIỆU NHẬN ĐƯỢC:", docData);
        }
      } catch (error) {
        // 6. Nếu có lỗi (vd: sai Rules, sai API key...)
        setMessage("LỖI KẾT NỐI CSDL! (Xem Console F12)");
        console.error("Firebase Connection Error:", error);
      }
    };

    // 7. Chạy hàm test
    testFirestoreConnection();

  }, []); // Dấu [] nghĩa là chỉ chạy 1 lần

  return (
    <div className="App">
      <header className="App-header">
        <h2>Bài Test Kết nối Firebase</h2>
        <p style={{ color: 'yellow' }}>
          {message}
        </p>
        <p>(Hãy nhấn F12 để xem Console log)</p>
      </header>
    </div>
  );
}

export default App;