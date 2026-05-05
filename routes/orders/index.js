const express = require("express");
const router = express.Router();
const db = require("../../db");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");

// 建立多商品訂單 + 自動扣庫存（允許負庫存）
router.post("/", (req, res) => {
  const { items, customer_name } = req.body;

  if (!items || items.length === 0) {
    return res.json({ success: false, message: "訂單沒有商品" });
  }

  const productIds = items.map(item => item.product_id);

  db.query(
    "SELECT id, name, price, stock FROM products WHERE id IN (?)",
    [productIds],
    (err, products) => {
      if (err) return res.json(err);

      let totalPrice = 0;
      const orderItems = [];

      for (const item of items) {
        const product = products.find(p => p.id === item.product_id);

        if (!product) {
          return res.json({ success: false, message: "有商品不存在" });
        }

        const subtotal = product.price * item.quantity;
        totalPrice += subtotal;

        orderItems.push({
          product_id: product.id,
          quantity: item.quantity,
          price: product.price,
          subtotal
        });
      }

      db.beginTransaction(err => {
        if (err) return res.json(err);

        db.query(
          "INSERT INTO orders (customer_name, total_price) VALUES (?, ?)",
          [customer_name || "", totalPrice],
          (err, orderResult) => {
            if (err) return db.rollback(() => res.json(err));

            const orderId = orderResult.insertId;

            const values = orderItems.map(item => [
              orderId,
              item.product_id,
              item.quantity,
              item.price,
              item.subtotal
            ]);

            db.query(
              "INSERT INTO order_items (order_id, product_id, quantity, price, subtotal) VALUES ?",
              [values],
              (err) => {
                if (err) return db.rollback(() => res.json(err));

                let completed = 0;

                orderItems.forEach(item => {
                  db.query(
                    "UPDATE products SET stock = stock - ? WHERE id = ?",
                    [item.quantity, item.product_id],
                    (err) => {
                      if (err) return db.rollback(() => res.json(err));

                      completed++;

                      if (completed === orderItems.length) {
                        db.commit(err => {
                          if (err) return db.rollback(() => res.json(err));

                          res.json({
                            success: true,
                            message: "訂單建立成功，庫存已扣除",
                            order_id: orderId,
                            total_price: totalPrice
                          });
                        });
                      }
                    }
                  );
                });
              }
            );
          }
        );
      });
    }
  );
});

// 查詢訂單主表
router.get("/", (req, res) => {
  db.query("SELECT * FROM orders ORDER BY id DESC", (err, results) => {
    if (err) return res.json(err);
    res.json(results);
  });
});

// 匯出 Excel
router.get("/export/excel", async (req, res) => {
  db.query(
    `SELECT 
      orders.id AS order_id,
      orders.customer_name,
      orders.total_price,
      orders.created_at,
      products.name AS product_name,
      order_items.quantity,
      order_items.price,
      order_items.subtotal
    FROM orders
    LEFT JOIN order_items ON orders.id = order_items.order_id
    LEFT JOIN products ON order_items.product_id = products.id
    ORDER BY orders.id DESC, order_items.id ASC`,
    async (err, rows) => {
      if (err) return res.json(err);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("訂單報表");

      sheet.columns = [
        { header: "訂單編號", key: "order_id", width: 12 },
        { header: "客人名稱", key: "customer_name", width: 20 },
        { header: "商品名稱", key: "product_name", width: 30 },
        { header: "數量", key: "quantity", width: 10 },
        { header: "單價", key: "price", width: 10 },
        { header: "小計", key: "subtotal", width: 10 },
        { header: "訂單總價", key: "total_price", width: 12 },
        { header: "建立時間", key: "created_at", width: 25 }
      ];

      rows.forEach(row => {
        sheet.addRow({
          order_id: row.order_id,
          customer_name: row.customer_name || "未填客人",
          product_name: row.product_name || "",
          quantity: row.quantity || "",
          price: row.price || "",
          subtotal: row.subtotal || "",
          total_price: row.total_price,
          created_at: row.created_at
        });
      });

      sheet.getRow(1).font = { bold: true };

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=orders.xlsx"
      );

      await workbook.xlsx.write(res);
      res.end();
    }
  );
});

// 匯出 PDF
router.get("/export/pdf", (req, res) => {
  db.query(
    `SELECT 
      orders.id AS order_id,
      orders.customer_name,
      orders.total_price,
      orders.created_at,
      products.name AS product_name,
      order_items.quantity,
      order_items.price,
      order_items.subtotal
    FROM orders
    LEFT JOIN order_items ON orders.id = order_items.order_id
    LEFT JOIN products ON order_items.product_id = products.id
    ORDER BY orders.id DESC, order_items.id ASC`,
    (err, rows) => {
      if (err) return res.json(err);

      const doc = new PDFDocument({ margin: 40 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=orders.pdf");

      doc.pipe(res);

      const fontPath = "C:/Windows/Fonts/msjh.ttc";
      if (fs.existsSync(fontPath)) {
        doc.font(fontPath);
      }

      doc.fontSize(20).text("月暈 ERP 訂單報表", { align: "center" });
      doc.moveDown();

      let currentOrderId = null;

      rows.forEach(row => {
        if (currentOrderId !== row.order_id) {
          currentOrderId = row.order_id;

          doc.moveDown(0.5);
          doc.fontSize(13).text(
            `訂單 #${row.order_id}｜客人：${row.customer_name || "未填客人"}｜總價：$${row.total_price}`
          );
          doc.fontSize(10).text(`建立時間：${row.created_at}`);
        }

        if (row.product_name) {
          doc.fontSize(11).text(
            `  - ${row.product_name} x${row.quantity}｜單價 $${row.price}｜小計 $${row.subtotal}`
          );
        }
      });

      doc.end();
    }
  );
});

// 清空所有訂單，不回加庫存
function clearAllOrders(req, res) {
  db.beginTransaction(err => {
    if (err) return res.json({ success: false, error: err });

    db.query("DELETE FROM order_items", (err) => {
      if (err) return db.rollback(() => res.json({ success: false, error: err }));

      db.query("DELETE FROM orders", (err) => {
        if (err) return db.rollback(() => res.json({ success: false, error: err }));

        db.commit(err => {
          if (err) return db.rollback(() => res.json({ success: false, error: err }));

          res.json({
            success: true,
            message: "所有訂單已清空，庫存未回加"
          });
        });
      });
    });
  });
}

router.delete("/clear", clearAllOrders);
router.get("/clear", clearAllOrders);

// 查詢單筆訂單明細
router.get("/:id", (req, res) => {
  const orderId = req.params.id;

  db.query(
    `SELECT 
      order_items.id,
      order_items.order_id,
      order_items.product_id,
      products.name,
      order_items.quantity,
      order_items.price,
      order_items.subtotal
    FROM order_items
    JOIN products ON order_items.product_id = products.id
    WHERE order_items.order_id = ?`,
    [orderId],
    (err, results) => {
      if (err) return res.json(err);
      res.json(results);
    }
  );
});

// 刪除單筆訂單 + 庫存加回
router.delete("/:id", (req, res) => {
  const orderId = req.params.id;

  db.query(
    "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
    [orderId],
    (err, items) => {
      if (err) return res.json(err);

      db.beginTransaction(err => {
        if (err) return res.json(err);

        if (items.length === 0) {
          return db.query("DELETE FROM orders WHERE id = ?", [orderId], (err) => {
            if (err) return db.rollback(() => res.json(err));

            db.commit(err => {
              if (err) return db.rollback(() => res.json(err));
              res.json({ message: "訂單刪除成功" });
            });
          });
        }

        let completed = 0;

        items.forEach(item => {
          db.query(
            "UPDATE products SET stock = stock + ? WHERE id = ?",
            [item.quantity, item.product_id],
            (err) => {
              if (err) return db.rollback(() => res.json(err));

              completed++;

              if (completed === items.length) {
                db.query("DELETE FROM order_items WHERE order_id = ?", [orderId], (err) => {
                  if (err) return db.rollback(() => res.json(err));

                  db.query("DELETE FROM orders WHERE id = ?", [orderId], (err) => {
                    if (err) return db.rollback(() => res.json(err));

                    db.commit(err => {
                      if (err) return db.rollback(() => res.json(err));
                      res.json({ message: "訂單刪除成功，庫存已加回" });
                    });
                  });
                });
              }
            }
          );
        });
      });
    }
  );
});

module.exports = router;