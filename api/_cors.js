/**
 * api/_cors.js
 * Utilitário de segurança centralizado para validação e restrição de CORS
 * nas rotas serverless do HotelNoZap.
 */

export function applyCors(req, res, allowedMethods = 'GET,POST,OPTIONS') {
  const origin = req.headers.origin || req.headers.Origin || '';

  const isAllowedOrigin = (orig) => {
    if (!orig) return false;
    try {
      const parsed = new URL(orig);
      const host = parsed.hostname.toLowerCase();
      return (
        host === 'hotelnozap.com.br' ||
        host.endsWith('.hotelnozap.com.br') ||
        host.endsWith('.vercel.app') ||
        host === 'localhost' ||
        host === '127.0.0.1'
      );
    } catch {
      return false;
    }
  };

  const allowedOrigin = isAllowedOrigin(origin) ? origin : 'https://hotelnozap.com.br';

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
