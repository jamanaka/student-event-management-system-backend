require("dotenv").config();
const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

const mongoDBConnection = mongoose
  .connect(process.env.MONGODBCONNECTIONSTRING)
  .then(async () => { 
    console.log("MongoDB Connected"); 
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    throw new AppError("MongoDB connection failed", 500, "DATABASE_CONNECTION_ERROR");
  });

module.exports = mongoDBConnection;