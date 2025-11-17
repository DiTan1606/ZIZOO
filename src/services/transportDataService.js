// Service để xử lý dữ liệu giao thông từ CSV
class TransportDataService {
  constructor() {
    this.data = [];
    this.loadCSVData();
  }

  async loadCSVData() {
    try {
      // Đọc file CSV từ public folder
      const response = await fetch('/DiaDiemVeXe.csv');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const csvText = await response.text();
      this.parseCSV(csvText);
    } catch (error) {
      console.error('❌ Error loading CSV:', error);
      // Fallback: parse inline nếu không load được
      this.parseCSVInline();
    }
  }

  parseCSV(csvText) {
    try {
      const lines = csvText.split('\n');
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = this.parseCSVLine(lines[i]);
        if (values.length >= 5) {
          this.data.push({
            from: values[0].trim(),
            to: values[1].trim(),
            company: values[2].trim(),
            price: parseInt(values[3].trim().replace(/\D/g, '')),
            note: values[4].trim()
          });
        }
      }
      console.log(`✅ Loaded ${this.data.length} transport routes from CSV`);
    } catch (error) {
      console.error('Error parsing transport CSV:', error);
    }
  }
  
  parseCSVInline() {
    // Fallback data nếu không load được CSV
    console.warn('⚠️ Using fallback transport data');
    this.data = [
      { from: 'TP Hồ Chí Minh', to: 'Vũng Tàu', company: 'Phương Trang', price: 140000, note: '2h - Ghế ngồi' },
      { from: 'TP Hồ Chí Minh', to: 'Đà Lạt', company: 'Phương Trang', price: 220000, note: '7h - Giường nằm' },
      { from: 'TP Hồ Chí Minh', to: 'Nha Trang', company: 'Phương Trang', price: 280000, note: '9h - Giường nằm' },
      { from: 'Hà Nội', to: 'Sapa', company: 'Sao Việt', price: 450000, note: '5h30 - Giường nằm' },
      { from: 'Hà Nội', to: 'Hạ Long', company: 'Hoàng Long', price: 250000, note: '3h30 - Giường nằm' }
    ];
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  // Tìm thông tin xe giữa 2 địa điểm
  findRoute(from, to) {
    const normalizedFrom = this.normalizeLocation(from);
    const normalizedTo = this.normalizeLocation(to);
    
    const routes = this.data.filter(route => {
      const routeFrom = this.normalizeLocation(route.from);
      const routeTo = this.normalizeLocation(route.to);
      return routeFrom === normalizedFrom && routeTo === normalizedTo;
    });
    
    return routes;
  }

  // Lấy giá xe rẻ nhất giữa 2 địa điểm
  getCheapestRoute(from, to) {
    const routes = this.findRoute(from, to);
    if (routes.length === 0) return null;
    
    return routes.reduce((min, route) => 
      route.price < min.price ? route : min
    );
  }

  // Lấy tất cả các tùy chọn xe
  getAllRoutes(from, to) {
    return this.findRoute(from, to);
  }

  // Trích xuất thời gian từ ghi chú (vd: "3h30 - Giường nằm" -> 3.5)
  extractTravelTime(note) {
    if (!note) return null;
    
    const match = note.match(/(\d+)h(\d*)/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      return hours + (minutes / 60);
    }
    return null;
  }

  // Lấy thời gian di chuyển giữa 2 địa điểm (giờ)
  getTravelTime(from, to) {
    const route = this.getCheapestRoute(from, to);
    if (!route) return null;
    
    return this.extractTravelTime(route.note);
  }

  // Chuẩn hóa tên địa điểm để so sánh
  normalizeLocation(location) {
    if (!location) return '';
    
    return location
      .toLowerCase()
      .replace(/tp\s+/gi, '')
      .replace(/thành phố\s+/gi, '')
      .replace(/tỉnh\s+/gi, '')
      .replace(/huyện\s+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Tìm kiếm gần đúng địa điểm
  findSimilarLocation(location) {
    const normalized = this.normalizeLocation(location);
    const allLocations = new Set();
    
    this.data.forEach(route => {
      allLocations.add(route.from);
      allLocations.add(route.to);
    });
    
    for (const loc of allLocations) {
      if (this.normalizeLocation(loc) === normalized) {
        return loc;
      }
    }
    
    // Tìm kiếm chứa chuỗi con
    for (const loc of allLocations) {
      const normalizedLoc = this.normalizeLocation(loc);
      if (normalizedLoc.includes(normalized) || normalized.includes(normalizedLoc)) {
        return loc;
      }
    }
    
    return null;
  }

  // Lấy thông tin gợi ý cho AI
  getTransportSuggestion(from, to, depth = 0) {
    // Ngăn đệ quy vô hạn
    if (depth > 2) {
      console.warn(`⚠️ Max recursion depth reached for ${from} → ${to}`);
      return null;
    }
    
    const routes = this.getAllRoutes(from, to);
    
    if (routes.length === 0) {
      // Thử tìm địa điểm tương tự (chỉ 1 lần)
      if (depth === 0) {
        const similarFrom = this.findSimilarLocation(from);
        const similarTo = this.findSimilarLocation(to);
        
        // Kiểm tra xem có khác với input không (tránh vòng lặp)
        if (similarFrom && similarTo && 
            (similarFrom !== from || similarTo !== to)) {
          console.log(`🔄 Trying similar: ${similarFrom} → ${similarTo}`);
          return this.getTransportSuggestion(similarFrom, similarTo, depth + 1);
        }
      }
      
      return null;
    }
    
    const cheapest = routes.reduce((min, r) => r.price < min.price ? r : min);
    const fastest = routes.reduce((min, r) => {
      const time1 = this.extractTravelTime(r.note) || 999;
      const time2 = this.extractTravelTime(min.note) || 999;
      return time1 < time2 ? r : min;
    });
    
    return {
      from: routes[0].from,
      to: routes[0].to,
      cheapest: {
        company: cheapest.company,
        price: cheapest.price,
        note: cheapest.note,
        travelTime: this.extractTravelTime(cheapest.note)
      },
      fastest: {
        company: fastest.company,
        price: fastest.price,
        note: fastest.note,
        travelTime: this.extractTravelTime(fastest.note)
      },
      allOptions: routes.map(r => ({
        company: r.company,
        price: r.price,
        note: r.note,
        travelTime: this.extractTravelTime(r.note)
      }))
    };
  }

  // Trích xuất loại xe từ ghi chú (bỏ thời gian)
  extractVehicleType(note) {
    if (!note) return '';
    
    // Tách theo dấu "-" và lấy phần sau (loại xe)
    const parts = note.split('-');
    if (parts.length >= 2) {
      return parts[1].trim(); // "Giường nằm", "Ghế ngồi", "Limousine"
    }
    
    return note.trim();
  }

  // Format thông tin cho AI prompt
  formatForAI(from, to) {
    const suggestion = this.getTransportSuggestion(from, to);
    
    if (!suggestion) {
      return `Không tìm thấy thông tin xe từ ${from} đến ${to} trong dữ liệu.`;
    }
    
    let text = `Thông tin xe từ ${suggestion.from} đến ${suggestion.to}:\n`;
    text += `- Rẻ nhất: ${suggestion.cheapest.company} - ${suggestion.cheapest.price.toLocaleString('vi-VN')}đ (${suggestion.cheapest.note})\n`;
    
    if (suggestion.fastest.company !== suggestion.cheapest.company) {
      text += `- Nhanh nhất: ${suggestion.fastest.company} - ${suggestion.fastest.price.toLocaleString('vi-VN')}đ (${suggestion.fastest.note})\n`;
    }
    
    if (suggestion.allOptions.length > 2) {
      text += `- Có ${suggestion.allOptions.length} tùy chọn khác\n`;
    }
    
    return text;
  }
}

// Export singleton instance
const transportDataService = new TransportDataService();
export default transportDataService;
