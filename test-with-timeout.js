const { spawn } = require('child_process');

console.log('Running change password test...');

const child = spawn('npx', [
  'jest', 
  'tests/unit/controllers/changePasswordController.test.ts',
  '--verbose',
  '--no-cache',
  '--forceExit',
  '--testNamePattern=should successfully change password'
], {
  stdio: 'pipe',
  shell: true
});

let output = '';
let hasFinished = false;

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stderr.write(text);
});

child.on('close', (code) => {
  hasFinished = true;
  console.log(`\nTest finished with code: ${code}`);
});

// Timeout after 30 seconds
setTimeout(() => {
  if (!hasFinished) {
    console.log('\nTest timed out, killing process...');
    child.kill('SIGTERM');
    
    // Force exit after 5 more seconds
    setTimeout(() => {
      child.kill('SIGKILL');
      process.exit(1);
    }, 5000);
  }
}, 30000);
