import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { collection_reset_tokens } from '../../../lib/db';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

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

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  await connectDB();

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email é obrigatório' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    // Não revela se o email existe (segurança)
    return res.status(200).json({ message: 'Se o email existir, um código foi enviado.' });
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await collection_reset_tokens.updateOne(
    { email },
    { $set: { code, expiresAt } },
    { upsert: true }
  );

  // ✅ Configuração do Nodemailer com Gmail
  const transporter = nodemailer.createTransporter({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,    // ex: julio.ccbeu@gmail.com
      pass: process.env.EMAIL_PASS     // Senha de App (16 caracteres)
    }
  });

  try {
    await transporter.sendMail({
      from: `"DieTI" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Recuperação de Senha - DieTI',
      text: `Seu código de recuperação é: ${code}. Ele expira em 15 minutos.`
    });

    return res.status(200).json({ message: 'Código de recuperação enviado.' });
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return res.status(500).json({ message: 'Falha ao enviar o email. Tente novamente mais tarde.' });
  }
}