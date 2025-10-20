import withCors from '../../../lib/withCors';
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import jwt from 'jsonwebtoken';

const handler = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({message: 'Method not allowed.'});
    }

    await connectDB();

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({message: 'Não autorizado - Nenhum token fornecido'});
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Usuário nao encontrado' });
        }

        return res.status(200).json({ user });
    } catch (e) {
        return res.status(401).json({ message: 'Invalid token'});
    }
};

export default withCors(handler);