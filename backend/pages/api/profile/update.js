import withCors from '../../../lib/withCors';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import jwt from 'jsonwebtoken';

const handler = async (req, res) => {
  if (req.method === 'OPTIONS') {
    // preflight CORS
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  await connectDB();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Não autorizado - Nenhum token fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const { name, email, bdate, weight, height } = req.body || {};

    const missing = [];
    if (!name?.trim())   missing.push('nome');
    if (!email?.trim())  missing.push('email');
    if (!bdate?.trim())  missing.push('data de nascimento');
    if (weight === undefined || weight === null || weight === '') missing.push('peso');
    if (height === undefined || height === null || height === '') missing.push('altura');

    if (missing.length) {
      return res.status(400).json({ message: `Campos obrigatórios ausentes: ${missing.join(', ')}` });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, email, bdate, weight, height },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    return res.status(200).json({ message: 'Perfil atualizado com sucesso.', user: updatedUser });

  } catch (error) {
    console.error('Falha ao atualizar perfil:', error);
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(500).json({ message: 'Server internal error.' });
  }
};

export default withCors(handler);
