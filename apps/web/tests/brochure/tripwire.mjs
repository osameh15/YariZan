import { createServer } from 'node:http';
// Records every request that reaches the API port. GET /tripwire reports the count only.
const hits = [];
createServer((request, response) => {
  if (request.url === '/tripwire') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ hits: hits.length, paths: hits }));
    return;
  }
  hits.push(`${request.method} ${request.url}`);
  response.writeHead(500, { 'Content-Type': 'application/json' });
  response.end('{"error":{"code":"TRIPWIRE"}}');
}).listen(3101, '127.0.0.1');
