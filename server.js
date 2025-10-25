#!/usr/bin/env node
// Startet den eigentlichen Server im Unterordner "server"
// So funktioniert auch "node server.js" aus dem Projekt-Root korrekt

const { spawn } = require('child_process');
const path = require('path');

const serverDir = path.join(__dirname, 'server');

const child = spawn(process.execPath, ['server.js'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code));
