const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static("public"));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products/index.js"));
app.use("/api/orders", require("./routes/orders/index.js"));

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});