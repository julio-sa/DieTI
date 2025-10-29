import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { validateToken } from '../../../lib/auth';

export default async function handler(req, res) {
  // Headers CORS fixos
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = req.headers['authorization']?.split(' ')[1];
  const { valid, userId } = validateToken(token);

  if (!valid) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  await connectDB();

  const result = await User.findByIdAndDelete(userId);
  if (!result) {
    return res.status(404).json({ message: 'Usuário não encontrado' });
  }

  return res.status(200).json({ message: 'Conta deletada com sucesso' });
}