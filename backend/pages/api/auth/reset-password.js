import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import bcrypt from 'bcryptjs';
import { collection_reset_tokens } from '../../../lib/db';

export default async function handler(req, res) {
  const allowedOrigins = ['http://localhost:4200', 'https://dieti.vercel.app'];
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') {
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  res.setHeader('Access-Control-Allow-Origin', `${frontendUrl}`);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  await connectDB();

  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
  }

  // ✅ Busca o código na coleção dedicated
  const stored = await collection_reset_tokens.findOne({ email });

  if (!stored) {
    return res.status(400).json({ message: 'Nenhum código solicitado para este email' });
  }

  if (stored.code !== code) {
    return res.status(400).json({ message: 'Código inválido' });
  }

  if (Date.now() > stored.expiresAt) {
    await collection_reset_tokens.deleteOne({ email });
    return res.status(400).json({ message: 'Código expirado' });
  }

  // ✅ Atualiza a senha do usuário
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  const result = await User.updateOne(
    { email },
    { $set: { password: hashedPassword } }
  );

  if (result.matched_count === 0) {
    return res.status(500).json({ message: 'Falha ao atualizar senha' });
  }

  // ✅ Remove o código usado
  await collection_reset_tokens.deleteOne({ email });

  return res.status(200).json({ message: 'Senha redefinida com sucesso!' });
}

process.on('SIGINT', async () => {
  await client.close();
  process.exit(0);
});