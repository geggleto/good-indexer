import { createServer, IncomingMessage, ServerResponse } from 'node:http';

const port = Number(process.env.PORT ?? 3000);

const server = createServer((request: IncomingMessage, response: ServerResponse) => {
  const url = request.url ?? '/';
  if (url === '/healthz') {
    const body = JSON.stringify({ status: 'green' });
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json');
    response.end(body);
    return;
  }
  response.statusCode = 404;
  response.end('not found');
});

server.listen(port, () => {
  console.log(`core server listening on ${port}`);
});

