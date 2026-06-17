const { spawn } = require('child_process');
const path = require('path');

// In some environments (e.g. Claude Code shell) ELECTRON_RUN_AS_NODE is set,
// which makes Electron behave like plain Node and breaks require('electron').
delete process.env.ELECTRON_RUN_AS_NODE;

const electronPath = require('electron');
const mainPath = path.join(__dirname, '..', 'dist', 'main.js');

const child = spawn(electronPath, [mainPath], {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
