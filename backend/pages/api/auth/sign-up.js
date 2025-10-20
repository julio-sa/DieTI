import withCors from '../../../lib/withCors';
import jwt from 'jsonwebtoken';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import bcrypt from 'bcryptjs';

const handler = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    await connectDB();

    const { id, name, email, password, age, weight, height } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Faltando informações obrigatórias" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email já cadastrado" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      id,
      name,
      email,
      password: hashedPassword,
      age,
      weight,
      height,
    });

    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: "Usuário criado com sucesso",
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      }
    });
  } catch (error) {
    console.error("Sign-up error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export default withCors(handler);
