import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import bcrypt from 'bcryptjs';
import { getResetTokensCollection } from '../../../lib/db';

export default async function handler(req, res) {
  const allowedOrigins = ['http://localhost:4200', 'https://dieti.vercel.app'];
  const origin = req.headers.origin || '';

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  

  try {
    await connectDB();

    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Todos os campos são obrigatórios' });
    }

    const resetTokens = await getResetTokensCollection();

    // Busca o token para esse email
    const stored = await resetTokens.findOne({ email });

    if (!stored) {
      return res
        .status(400)
        .json({ message: 'Nenhum código solicitado para este email' });
    }

    // Garante comparação como string
    if (String(stored.code) !== String(code)) {
      return res.status(400).json({ message: 'Código inválido' });
    }

    // Verifica expiração
    if (Date.now() > new Date(stored.expiresAt).getTime()) {
      await resetTokens.deleteOne({ email });
      return res.status(400).json({ message: 'Código expirado' });
    }

    // Atualiza a senha do usuário
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const result = await User.updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    if (!result.matchedCount) {
      return res
        .status(500)
        .json({ message: 'Falha ao atualizar senha do usuário' });
    }

    // Remove o token após uso
    await resetTokens.deleteOne({ email });

    return res.status(200).json({ message: 'Senha redefinida com sucesso!' });
  } catch (err) {
    console.error('❌ Erro no reset-password:', err);
    return res.status(500).json({
      message: 'Erro ao redefinir senha. Tente novamente em instantes.'
    });
  }
}
