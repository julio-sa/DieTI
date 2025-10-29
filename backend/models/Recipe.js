import mongoose from 'mongoose';

const RecipeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ingredients: { type: Array, required: true },
  calorias: { type: Number },
  proteinas: { type: Number },
  carbo: { type: Number },
  gordura: { type: Number },
  userId: { type: String, required: true }, // ✅ Novo campo
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Recipe || mongoose.model('Recipe', RecipeSchema);