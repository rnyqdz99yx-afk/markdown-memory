#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil
import platform
import re

def main():
    repo_root = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    external_dir = os.path.join(repo_root, "external")
    bot_dir = os.path.join(external_dir, "claude-code-telegram")
    env_template = os.path.join(repo_root, "templates", "tg-bot-env.example")
    env_file = os.path.join(bot_dir, ".env")
    
    print("=== mm-tg-bridge installer (Python) ===")
    print("")
    
    # 1. Dependency checks
    print("[1/5] Checking dependencies...")
    python_exe = sys.executable
    py_version = platform.python_version()
    print(f"  Python executable: {python_exe}")
    print(f"  Python version: {py_version}")
    
    # Check version >= 3.11
    match = re.match(r"^3\.(\d+)", py_version)
    if not match or int(match.group(1)) < 11:
        print(f"  ERROR: Python 3.11+ required, you have {py_version}")
        sys.exit(1)
        
    # Check claude cli
    claude_found = False
    for path in os.environ.get("PATH", "").split(os.pathsep):
        for ext in ["", ".cmd", ".bat", ".exe"]:
            p = os.path.join(path, "claude" + ext)
            if os.path.exists(p) and not os.path.isdir(p):
                print(f"  Claude CLI found: {p}")
                claude_found = True
                break
        if claude_found:
            break
    if not claude_found:
         print("  WARN: claude CLI not found in PATH. The bot will require it to run.")
         
    # 2. Clone repo
    print("\n[2/5] Cloning claude-code-telegram...")
    if not os.path.exists(external_dir):
        os.makedirs(external_dir, exist_ok=True)
        
    if os.path.exists(bot_dir):
        print(f"  Already cloned: {bot_dir}")
        print("  Updating via git pull...")
        try:
            subprocess.run(["git", "pull", "--ff-only"], cwd=bot_dir, check=True)
        except subprocess.CalledProcessError as e:
            print(f"  WARN: git pull failed: {e}")
    else:
        try:
            subprocess.run(["git", "clone", "https://github.com/RichardAtCT/claude-code-telegram.git", bot_dir], check=True)
        except subprocess.CalledProcessError as e:
            print(f"  ERROR: git clone failed: {e}")
            sys.exit(1)
            
    # 3. Virtual environment and dependencies
    print("\n[3/5] Virtual environment and dependencies...")
    venv_dir = os.path.join(bot_dir, ".venv")
    if not os.path.exists(venv_dir):
        print("  Creating .venv...")
        try:
            subprocess.run([python_exe, "-m", "venv", venv_dir], check=True)
        except subprocess.CalledProcessError as e:
            print(f"  ERROR: Failed to create venv: {e}")
            sys.exit(1)
    else:
        print("  .venv already exists.")
        
    is_windows = (platform.system() == 'Windows')
    if is_windows:
        pip_exe = os.path.join(venv_dir, "Scripts", "pip.exe")
        python_bin = os.path.join(venv_dir, "Scripts", "python.exe")
    else:
        pip_exe = os.path.join(venv_dir, "bin", "pip")
        python_bin = os.path.join(venv_dir, "bin", "python")
        
    if not os.path.exists(pip_exe):
        print(f"  ERROR: {pip_exe} not found in venv.")
        sys.exit(1)
        
    req_file = os.path.join(bot_dir, "requirements.txt")
    pyproject_file = os.path.join(bot_dir, "pyproject.toml")
    
    try:
        print("  Upgrading pip...")
        subprocess.run([pip_exe, "install", "--upgrade", "pip"], check=True, stdout=subprocess.DEVNULL)
        
        if os.path.exists(req_file):
            print("  pip install -r requirements.txt...")
            subprocess.run([pip_exe, "install", "-r", req_file], check=True)
        elif os.path.exists(pyproject_file):
            print("  pip install -e . (via pyproject.toml)...")
            subprocess.run([pip_exe, "install", "-e", bot_dir], check=True)
        else:
            print("  WARN: No requirements.txt or pyproject.toml found.")
    except subprocess.CalledProcessError as e:
        print(f"  ERROR: Failed to install dependencies: {e}")
        sys.exit(1)
        
    # 4. .env file configuration
    print("\n[4/5] Configuration (.env)...")
    if os.path.exists(env_file):
        print(f"  .env already exists: {env_file} (Not overwriting)")
    elif os.path.exists(env_template):
        try:
            shutil.copy(env_template, env_file)
            print(f"  Created: {env_file} (from template)")
            print("  FILL IN: TELEGRAM_BOT_TOKEN, ALLOWED_USERS, APPROVED_DIRECTORY")
        except Exception as e:
            print(f"  ERROR: Failed to copy .env template: {e}")
    else:
        print(f"  WARN: env template not found at {env_template}")
        
    # 5. Summary instructions
    print("\n[5/5] Done.")
    print("\nNext steps (manual):")
    print("  1. Create a Telegram Bot: @BotFather -> /newbot -> get token")
    print("  2. Find your user_id: @userinfobot -> /start")
    print(f"  3. Open {env_file} and configure:")
    print("     - TELEGRAM_BOT_TOKEN=<token from @BotFather>")
    print("     - ALLOWED_USERS=<your user_id>")
    if is_windows:
         print("     - APPROVED_DIRECTORY=C:\\Users\\<USER>\\Desktop  (or where your projects live)")
    else:
         print("     - APPROVED_DIRECTORY=/Users/<USER>/Desktop  (or where your projects live)")
    print("  4. Start the bot:")
    print(f"     cd {bot_dir}")
    if is_windows:
         print("     .\\.venv\\Scripts\\python.exe -m bot")
    else:
         print("     ./.venv/bin/python -m bot")
    print("  5. In Telegram: open your bot -> /start -> /help")
    print("\nAfter setting up, add the bot details in config/mm-config.local.json:")
    print('  { "tg_bridge": { "enabled": true, "bot_username": "@my_claude_bot" } }')

if __name__ == "__main__":
    main()
