const express = require("express");
const router = express.Router();
const db = require("../../db"); // 注意這裡是 ../../

// 查詢商品
router.get("/", (req, res) => {
  db.query("SELECT * FROM products", (err, results) => {
    if (err) {
      return res.json(err);
    }
    res.json(results);
  });
});

// 新增商品
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

// 編輯商品
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

// 刪除商品
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
// 🔥 更新庫存
router.put("/stock/:id", (req, res) => {
  const id = req.params.id;
  const { stock } = req.body;

  db.query(
    "UPDATE products SET stock = ? WHERE id = ?",
    [stock, id],
    (err) => {
      if (err) return res.json(err);
      res.json({ message: "庫存更新成功" });
    }
  );
});