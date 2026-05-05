const express = require("express");
const router = express.Router();
const db = require("../db");

// 查詢商品（從資料庫）
router.get("/", (req, res) => {
  db.query("SELECT * FROM products", (err, results) => {
    if (err) {
      return res.json(err);
    }
    res.json(results);
  });
});

// 新增商品（寫入資料庫）
router.post("/", (req, res) => {
  const { name, price } = req.body;

  db.query(
    "INSERT INTO products (name, price) VALUES (?, ?)",
    [name, price],
    (err, result) => {
      if (err) {
        return res.json(err);
      }

      res.json({
        message: "新增成功",
        id: result.insertId
      });
    }
  );
});

// 🔥 編輯商品（新增這段）
router.put("/:id", (req, res) => {
  const id = req.params.id;
  const { name, price } = req.body;

  db.query(
    "UPDATE products SET name = ?, price = ? WHERE id = ?",
    [name, price, id],
    (err) => {
      if (err) {
        return res.json(err);
      }

      res.json({
        message: "編輯成功"
      });
    }
  );
});

// 刪除商品（資料庫版）
router.delete("/:id", (req, res) => {
  const id = req.params.id;

  db.query(
    "DELETE FROM products WHERE id = ?",
    [id],
    (err) => {
      if (err) {
        return res.json(err);
      }

      res.json({
        message: "刪除成功"
      });
    }
  );
});

module.exports = router;