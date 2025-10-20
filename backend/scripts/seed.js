import bcrypt from "bcryptjs";
import connectDB from "../utils/db.js";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

async function seed() {
  try {
    await connectDB();
    await User.deleteMany();

    const users = [
      {
        name: "Lucas Silva",
        email: "lucas@email.com",
        password: await bcrypt.hash("senha123", 10),
        age: 28,
        weight: 75,
        height: 1.8,
        objective: "Gain muscle"
      },
      {
        name: "Maria Souza",
        email: "maria@email.com",
        password: await bcrypt.hash("minhasenha", 10),
        age: 32,
        weight: 62,
        height: 1.65,
        objective: "Lose weight"
      },
      {
        name: "João Pereira",
        email: "joao@email.com",
        password: await bcrypt.hash("teste123", 10),
        age: 40,
        weight: 85,
        height: 1.75,
        objective: "Maintain"
      }
    ];

    await User.insertMany(users);

    console.log("✅ Usuários inseridos com sucesso!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erro ao inserir usuários:", err);
    process.exit(1);
  }
}

seed();
