import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { collection_reset_tokens } from '../../../lib/db'; // Importe a coleção
import crypto from 'crypto';

const frontendUrl = environment.frontendUrl;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', `${frontendUrl}`);
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

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email é obrigatório' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(200).json({ message: 'Se o email existir, um código foi enviado.' });
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // ✅ Salva na coleção dedicated
  await collection_reset_tokens.updateOne(
    { email },
    { $set: { code, expiresAt } },
    { upsert: true }
  );

  return res.status(200).json({ message: 'Código de recuperação enviado.' });
}

process.on('SIGINT', async () => {
  await client.close();
  process.exit(0);
});