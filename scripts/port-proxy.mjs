import http from 'node:http';

const server = http.createServer((req, res) => {
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: 3005,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: req.headers.host || 'localhost:3005' }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy error: waiting for Next.js dev server on port 3005 to respond');
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Port 3000 bridge active -> forwarding all traffic to port 3005');
});
