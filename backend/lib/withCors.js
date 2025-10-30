export default function withCors(handler) {
  return async (req, res) => {
    // Sempre define os headers CORS
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200, https://dieti.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Trata o preflight OPTIONS
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Chama o handler real
    return handler(req, res);
  };
}