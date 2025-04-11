const http = require('http');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');

// Default port
const DEFAULT_PORT = 8081;

// Configure command line options
program
  .option('-p, --port <number>', 'Port to run the demo client on', DEFAULT_PORT)
  .parse(process.argv);

const options = program.opts();

// Validate port number
const port = parseInt(options.port, 10);
if (isNaN(port) || port < 1 || port > 65535) {
  console.error('Error: Port must be a number between 1 and 65535');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // Serve the demo client HTML file
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'demo-client.html'), (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading demo client');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
  } else {
    // Handle 404
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Demo client server running at http://localhost:${port}`);
  console.log(`Open this URL in your browser to test the notification server`);
}); 