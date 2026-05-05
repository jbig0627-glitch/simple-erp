const express = require("express");
const router = express.Router();
const db = require("../db");

// 🔐 登入
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password],
    (err, results) => {
      if (err) return res.json(err);

      if (results.length === 0) {
        return res.json({ success: false, message: "帳號或密碼錯誤" });
      }

      const user = results[0];

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    }
  );
});

module.exports = router;