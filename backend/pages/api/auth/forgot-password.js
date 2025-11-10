// pages/api/auth/forgot-password.js
import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { getResetTokensCollection } from '../../../lib/db';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  const allowedOrigins = ['http://localhost:4200', 'https://dieti.vercel.app'];
  const origin = req.headers.origin || '';

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

    if (!user) {
      return res.status(200).json({
        message: 'Se o email existir, um código foi enviado.'
      });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const resetTokens = await getResetTokensCollection();

    await resetTokens.updateOne(
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

    // sanity check das envs (só loga se faltar algo)
    const required = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
    for (const key of required) {
      if (!process.env[key]) {
        console.error(`❌ Env faltando: ${key}`);
        return res.status(500).json({
          message: 'Configuração de email ausente no servidor.'
        });
      }
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'Recuperação de Senha - DieTI',
      text: `Seu código de recuperação é: ${code}. Ele expira em 15 minutos.`
    });

    console.log('📩 Forgot password email sent:', info.messageId);

    return res.status(200).json({ message: 'Código de recuperação enviado.' });
  } catch (err) {
    console.error('❌ Erro no forgot-password:', err);
    return res.status(500).json({
      message: 'Erro ao enviar o código de recuperação. Tente novamente em instantes.'
    });
  }
}
