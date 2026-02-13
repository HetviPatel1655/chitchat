import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URL as string);
    console.log("--Connected to DB--");
    console.log(`DB Host: ${mongoose.connection.host}`);
    console.log(`DB Name: ${mongoose.connection.name}`);
    console.log(`Connection State: ${mongoose.connection.readyState}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};
