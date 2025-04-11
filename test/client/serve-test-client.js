const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;

const server = http.createServer((req, res) => {
  // Serve the test client HTML file
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'test-client.html'), (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading test client');
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

server.listen(PORT, () => {
  console.log(`Test client server running at http://localhost:${PORT}`);
  console.log(`Open this URL in your browser to test the notification server`);
}); 