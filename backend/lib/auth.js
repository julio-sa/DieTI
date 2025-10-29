import jwt from 'jsonwebtoken';

// Extrai o userId do token JWT
export const getUserIdFromToken = (token) => {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId; // ou `id`, dependendo do seu payload
  } catch (error) {
    return null;
  }
};

// Verifica se o token é válido
export const validateToken = (token) => {
  if (!token) return { valid: false, error: 'No token provided' };

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { valid: true, userId: decoded.userId };
  } catch (error) {
    return { valid: false, error: 'Invalid or expired token' };
  }
};