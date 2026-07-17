const mongoose = require("mongoose");
require("dotenv").config();

console.log("MONGO_DB_ONLINE:", process.env.MONGO_DB_ONLINE ? "✅ Defined" : "❌ Undefined");
console.log("MONGO_DB_LOCAL:", process.env.MONGO_DB_LOCAL ? "✅ Defined" : "❌ Undefined");

mongoose
  .connect(process.env.MONGO_DB_ONLINE, {})
  // .connect(process.env.MONGO_DB_LOCAL, {})
  .then(() => console.log("✅ Connected to Database"))
  .catch((err) => console.error("❌ Error connecting to Database", err));