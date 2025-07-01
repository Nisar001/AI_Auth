#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 AI Auth Setup Verification\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
} else {
  console.log('❌ .env file missing - copy from .env.example');
}

// Check if logs directory exists
const logsPath = path.join(__dirname, 'logs');
if (fs.existsSync(logsPath)) {
  console.log('✅ logs directory exists');
} else {
  console.log('❌ logs directory missing - create it manually');
}

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules exists');
} else {
  console.log('❌ node_modules missing - run npm install');
}

// Check TypeScript compilation
console.log('\n🔧 Checking TypeScript compilation...');
const { execSync } = require('child_process');

try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.log('❌ TypeScript compilation failed');
  console.log('Error:', error.stdout ? error.stdout.toString() : error.message);
}

console.log('\n📝 Setup Complete! Next steps:');
console.log('1. Configure your .env file with database and service credentials');
console.log('2. Set up PostgreSQL database');
console.log('3. Configure Gmail and Twilio credentials');
console.log('4. Run: npm run dev');
console.log('\n🚀 Ready to start development!');
