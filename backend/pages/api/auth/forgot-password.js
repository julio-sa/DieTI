import connectDB from '../../../lib/mongodb';
import User from '../../../models/User';
import { getResetTokensCollection } from '../../../lib/db';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY não configurado');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

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

    // resposta neutra pra não vazar se existe ou não
    if (!user) {
      return res
        .status(200)
        .json({ message: 'Se o email existir, um código foi enviado.' });
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

    if (!process.env.SENDGRID_API_KEY || !process.env.EMAIL_FROM) {
      console.error('❌ Falta SENDGRID_API_KEY ou EMAIL_FROM');
      return res.status(500).json({
        message:
          'Configuração de envio de e-mail ausente. Contate o suporte da aplicação.'
      });
    }

    const msg = {
      to: email,
      from: process.env.EMAIL_FROM,
      subject: 'Recuperação de Senha - DieTI',
      text: `Seu código de recuperação é: ${code}. Ele expira em 15 minutos.`,
      // opcionalmente:
      html: `<p>Seu código de recuperação é:</p><h2>${code}</h2><p>Ele expira em 15 minutos.</p>`
    };

    const [response] = await sgMail.send(msg);
    console.log('📩 Forgot password email status:', response.statusCode);

    return res.status(200).json({ message: 'Código de recuperação enviado.' });
  } catch (err) {
    console.error('❌ Erro no forgot-password:', err.response?.body || err);
    return res.status(500).json({
      message: 'Erro ao enviar o código de recuperação. Tente novamente em instantes.'
    });
  }
}
