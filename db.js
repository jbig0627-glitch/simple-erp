const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",   // XAMPP 預設是空
  database: "erp"
});

db.connect(err => {
  if (err) {
    console.error("資料庫連線失敗:", err);
  } else {
    console.log("資料庫連線成功");
  }
});

module.exports = db;