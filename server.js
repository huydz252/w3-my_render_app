require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Khởi tạo bảng dữ liệu
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

// 1. READ & SEARCH: Danh sách và tìm kiếm sản phẩm
app.get('/', async (req, res) => {
  const searchQuery = req.query.search || '';
  const editId = req.query.edit || null;

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

    let editProduct = null;
    if (editId) {
      const editResult = await pool.query('SELECT * FROM products WHERE id = $1', [editId]);
      if (editResult.rows.length > 0) {
        editProduct = editResult.rows[0];
      }
    }

    const tableRows = result.rows.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>$${p.price}</td>
        <td>${new Date(p.created_at).toLocaleDateString()}</td>
        <td>
          <a href="/?edit=${p.id}"><button type="button" style="background:#ffc107; border:none; cursor:pointer; padding:5px 10px; border-radius:3px;">Sửa</button></a>
          <form action="/delete-product/${p.id}" method="POST" style="display:inline;" onsubmit="return confirm('Bạn có chắc muốn xóa?');">
            <button type="submit" style="background:#dc3545; color:white; border:none; cursor:pointer; padding:5px 10px; border-radius:3px;">Xóa</button>
          </form>
        </td>
      </tr>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>CRUD NodeJS + PostgreSQL</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 30px auto; padding: 0 15px; }
          input, button { padding: 8px 12px; margin: 4px 0; border: 1px solid #ccc; border-radius: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f4f4f4; }
          .card { background: #fafafa; padding: 15px; border-radius: 8px; border: 1px solid #eee; margin-bottom: 20px; }
          .btn-primary { background: #007bff; color: white; border: none; cursor: pointer; }
          .btn-success { background: #28a745; color: white; border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>Hệ Thống Quản Lý Sản Phẩm (CRUD + Render PostgreSQL)</h2>

        <!-- FORM CREATE HOẶC UPDATE -->
        <div class="card">
          <h3>${editProduct ? 'Cập Nhật Sản Phẩm (ID: ' + editProduct.id + ')' : 'Thêm Sản Phẩm Mới'}</h3>
          <form action="${editProduct ? '/update-product/' + editProduct.id : '/add-product'}" method="POST">
            <input type="text" name="name" value="${editProduct ? editProduct.name : ''}" placeholder="Tên sản phẩm" required style="width: 45%;">
            <input type="number" step="0.01" name="price" value="${editProduct ? editProduct.price : ''}" placeholder="Giá" required style="width: 25%;">
            <button type="submit" class="${editProduct ? 'btn-success' : 'btn-primary'}">${editProduct ? 'Lưu Thay Đổi' : 'Thêm Mới'}</button>
            ${editProduct ? '<a href="/"><button type="button">Hủy</button></a>' : ''}
          </form>
        </div>

        <!-- FORM SEARCH -->
        <div class="card">
          <h3>Tìm Kiếm</h3>
          <form action="/" method="GET">
            <input type="text" name="search" value="${searchQuery}" placeholder="Nhập tên sản phẩm..." style="width: 60%;">
            <button type="submit">Tìm</button>
            <a href="/"><button type="button">Làm Mới</button></a>
          </form>
        </div>

        <!-- DANH SÁCH SẢN PHẨM -->
        <h3>Danh Sách Hiện Có</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Giá</th>
              <th>Ngày Tạo</th>
              <th>Hành Động</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="5" style="text-align: center;">Chưa có dữ liệu.</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Database Error: ' + err.message);
  }
});

// 2. CREATE: Thêm sản phẩm
app.post('/add-product', async (req, res) => {
  const { name, price } = req.body;
  try {
    await pool.query('INSERT INTO products (name, price) VALUES ($1, $2)', [name, price]);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Error adding product: ' + err.message);
  }
});

// 3. UPDATE: Cập nhật thông tin sản phẩm
app.post('/update-product/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price } = req.body;
  try {
    await pool.query('UPDATE products SET name = $1, price = $2 WHERE id = $3', [name, price, id]);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Error updating product: ' + err.message);
  }
});

// 4. DELETE: Xóa sản phẩm
app.post('/delete-product/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Error deleting product: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});