import withCors from '../../../lib/withCors';
import jwt from 'jsonwebtoken';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import bcrypt from 'bcryptjs';

const handler = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    await connectDB();

    const { id, name, email, password, bdate, weight, height, goals } = req.body;

    // Validação dos campos obrigatórios
    if (!name || !email || !password || !bdate || !weight || !height) {
      return res.status(400).json({ message: "Faltando informações obrigatórias" });
    }

    // Validação do formato da data
    const birthDate = new Date(bdate);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ message: "Data de nascimento inválida" });
    }

    // Cálculo da idade
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Validação de idade mínima (opcional)
    if (age < 13) {
      return res.status(400).json({ message: "Idade mínima é 13 anos" });
    }

    // Metas padrão
    const defaultGoals = {
      calorias: 2704,
      proteinas: 176,
      carbo: 320,
      gordura: 80
    };

    const userGoals = goals || defaultGoals;

    // Verifica se o email já está cadastrado
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email já cadastrado" });

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criação do novo usuário
    const newUser = new User({
      id,
      name,
      email,
      password: hashedPassword,
      bdate,        // Data de nascimento
      age,          // Idade calculada
      weight,
      height,
      goals: userGoals
    });

    await newUser.save();

    // Gera token JWT
    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Retorna resposta de sucesso
    return res.status(201).json({
      message: "Usuário criado com sucesso",
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        age: newUser.age,
        bdate: newUser.bdate,
        weight: newUser.weight,
        height: newUser.height,
        goals: newUser.goals
      }
    });
  } catch (error) {
    console.error("Sign-up error:", error);
    return res.status(500).json({ 
      message: "Erro no servidor", 
      error: error.message 
    });
  }
};

export default withCors(handler);