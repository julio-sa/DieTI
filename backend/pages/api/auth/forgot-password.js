import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { collection_reset_tokens } from '../../../lib/db';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

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

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email é obrigatório' });
    }

    const user = await User.findOne({ email });

    // resposta neutra pra não expor se o email existe
    if (!user) {
      return res.status(200).json({
        message: 'Se o email existir, um código foi enviado.'
      });
    }

    // Gera código 6 dígitos
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await collection_reset_tokens.updateOne(
      { email },
      {
        $set: {
          code,
          expiresAt,
          used: false
        }
      },
      { upsert: true }
    );

    // Transporter correto
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,         // ex: smtp.gmail.com
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,                        // true se usar porta 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const info = await transporter.sendMail({
      from: `"DieTI" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Recuperação de Senha - DieTI',
      text: `Seu código de recuperação é: ${code}. Ele expira em 15 minutos.`
    });

    console.log('Forgot password email sent:', info.messageId);

    return res.status(200).json({ message: 'Código de recuperação enviado.' });
  } catch (err) {
    console.error('Erro no forgot-password:', err);
    return res.status(500).json({
      message: 'Erro ao enviar o código de recuperação. Tente novamente em instantes.'
    });
  }
}
