const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình đọc form dữ liệu và JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Kết nối PostgreSQL qua biến môi trường DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Tự động tạo bảng 'products' nếu chưa có khi khởi động
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}
initDB();

// Giao diện chính + Chức năng Tìm kiếm (Render HTML trực tiếp)
app.get('/', async (req, res) => {
  const searchQuery = req.query.search || '';
  try {
    let result;
    if (searchQuery) {
      result = await pool.query(
        'SELECT * FROM products WHERE name ILIKE $1 ORDER BY id DESC',
        [`%${searchQuery}%`]
      );
    } else {
      result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    }

    const rows = result.rows;
    const tableRows = rows.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>$${p.price}</td>
        <td>${new Date(p.created_at).toLocaleString()}</td>
      </tr>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Product Management</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 700px; margin: 30px auto; padding: 0 15px; }
          input, button { padding: 8px 12px; margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f4f4f4; }
          .card { background: #fafafa; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h2>Quản lý Sản phẩm (NodeJS + PostgreSQL)</h2>
        
        <!-- Chức năng 1: Thêm sản phẩm -->
        <div class="card">
          <h3>1. Thêm sản phẩm mới</h3>
          <form action="/add-product" method="POST">
            <input type="text" name="name" placeholder="Tên sản phẩm" required style="width: 50%;">
            <input type="number" step="0.01" name="price" placeholder="Giá" required style="width: 25%;">
            <button type="submit">Thêm</button>
          </form>
        </div>

        <!-- Chức năng 2: Tìm kiếm sản phẩm -->
        <div class="card">
          <h3>2. Tìm kiếm sản phẩm</h3>
          <form action="/" method="GET">
            <input type="text" name="search" value="${searchQuery}" placeholder="Nhập tên sản phẩm...">
            <button type="submit">Tìm</button>
            <a href="/"><button type="button">Xóa lọc</button></a>
          </form>
        </div>

        <!-- Danh sách hiển thị -->
        <h3>Danh sách Sản phẩm</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Giá</th>
              <th>Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="4" style="text-align: center;">Chưa có sản phẩm nào.</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Database Error: ' + err.message);
  }
});

// Xử lý Thêm sản phẩm
app.post('/add-product', async (req, res) => {
  const { name, price } = req.body;
  try {
    await pool.query('INSERT INTO products (name, price) VALUES ($1, $2)', [name, price]);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Error adding product: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});