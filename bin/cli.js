#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const home = os.homedir();
const installDir = path.join(home, '.markdown-memory');
const repoUrl = 'https://github.com/mworldorg/markdown-memory.git';

function runCmd(cmd, options = {}) {
  try {
    return execSync(cmd, { stdio: 'inherit', ...options });
  } catch (err) {
    console.error(`\n❌ Error executing command: ${cmd}`);
    process.exit(1);
  }
}

function getPythonCommand() {
  const commands = ['python3', 'python'];
  for (const cmd of commands) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch (e) {
      // try next
    }
  }
  console.error("❌ Error: Python is not installed or not in PATH. Please install Python 3.");
  process.exit(1);
}

function checkGit() {
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch (e) {
    console.error("❌ Error: Git is not installed or not in PATH. Please install Git.");
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
markdown-memory CLI Installer

Usage:
  npx markdown-memory [command]

Commands:
  install       Clone/update the repository and register skills (default)
  update        Force update (git pull) and re-register skills
  register      Register skills from the current directory
  help          Show this help message
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'install';

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  checkGit();
  const pythonCmd = getPythonCommand();

  if (command === 'register') {
    const currentRepoRoot = path.resolve(__dirname, '..');
    const registerScript = path.join(currentRepoRoot, 'scripts', 'register-skills.py');
    console.log(`📂 Registering skills from current directory: ${currentRepoRoot}`);
    if (!fs.existsSync(registerScript)) {
      console.error(`❌ Error: register-skills.py not found at ${registerScript}`);
      process.exit(1);
    }
    runCmd(`"${pythonCmd}" "${registerScript}"`);
    console.log("✅ Skills registered successfully!");
    return;
  }

  if (command === 'install' || command === 'update') {
    if (!fs.existsSync(installDir)) {
      console.log(`📥 Cloning markdown-memory repository to ${installDir}...`);
      runCmd(`git clone ${repoUrl} "${installDir}"`);
    } else {
      console.log(`🔄 Repository already exists at ${installDir}. Pulling latest updates...`);
      try {
        runCmd(`git pull`, { cwd: installDir });
      } catch (err) {
        console.warn("⚠️ Warning: git pull failed. Proceeding with registration of existing files.");
      }
    }

    const registerScript = path.join(installDir, 'scripts', 'register-skills.py');
    console.log("⚙️ Registering skills...");
    if (!fs.existsSync(registerScript)) {
      console.error(`❌ Error: register-skills.py not found at ${registerScript}`);
      process.exit(1);
    }
    runCmd(`"${pythonCmd}" "${registerScript}"`);

    console.log("\n=============================================");
    console.log("🎉 markdown-memory skill system is ready!");
    console.log("=============================================");
    console.log("Next steps:");
    console.log("1. Open Claude Code or Antigravity IDE.");
    console.log("2. Run '/mm setup' (or '/mm onboard') to personalize the system.");
    console.log("3. Start using short commands: /mm help");
    console.log("=============================================\n");
    return;
  }

  console.error(`❌ Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}

main();
