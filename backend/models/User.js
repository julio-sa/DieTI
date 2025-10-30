import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  age: { type: Number, required: true },
  password: { type: String, required: true },
  weight: { type: Number, required: true },
  height: { type: Number, required: true },
  goals: {
    type: Object,
    default: {
      calorias: 2704,
      proteinas: 176,
      carbo: 320,
      gordura: 80
    }
  },
  resetPasswordCode: { type: String },
  resetPasswordExpires: { type: Date },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", UserSchema);
