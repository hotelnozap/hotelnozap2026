import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET,OPTIONS')) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY || 'BNssYPXA_K4D951xVf3i7Uc__CzL_roft6oTXiJ27t3JvNbT_ftbGaqPvVaBc6CHpUZP1nfA8xqUZqosT_hlxzA';

  return res.status(200).json({
    publicKey
  });
}
