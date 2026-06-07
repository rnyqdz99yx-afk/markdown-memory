#!/usr/bin/env python3
import os
import sys
import subprocess
import time
from pathlib import Path

# Rate limit: 12 hours (43200 seconds)
RATE_LIMIT_SECONDS = 43200

def get_repo_root():
    # 1. Env variable MM_REPO_ROOT
    env_root = os.environ.get("MM_REPO_ROOT")
    if env_root and os.path.exists(env_root):
        return os.path.abspath(env_root)
        
    # 2. Check ~/.markdown-memory
    home = os.path.expanduser("~")
    default_dir = os.path.join(home, ".markdown-memory")
    if os.path.exists(default_dir):
        return os.path.abspath(default_dir)
        
    # 3. Parent of scripts directory
    current_root = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    if os.path.exists(os.path.join(current_root, "config", "mm-config.json")):
        return current_root
        
    return None

def main():
    args = sys.argv[1:]
    background = "--background" in args
    is_child = "--background-child" in args
    force = "--force" in args
    
    # Detached daemon spawning
    if background and not is_child:
        child_args = [sys.executable, __file__, "--background", "--background-child"]
        if force:
            child_args.append("--force")
            
        try:
            if sys.platform == "win32":
                # On Windows, use CREATE_NO_WINDOW
                CREATE_NO_WINDOW = 0x08000000
                subprocess.Popen(child_args, close_fds=True, creationflags=CREATE_NO_WINDOW)
            else:
                # On Unix, use start_new_session=True to detach from parent shell session
                subprocess.Popen(child_args, close_fds=True, start_new_session=True)
        except Exception:
            # Fallback if spawning fails
            pass
        sys.exit(0)
        
    repo_root = get_repo_root()
    if not repo_root:
        if not background:
            print("❌ Error: Could not find markdown-memory repository root.")
        sys.exit(1)
        
    home = os.path.expanduser("~")
    dot_dir = os.path.join(home, ".markdown-memory")
    os.makedirs(dot_dir, exist_ok=True)
    
    timestamp_file = os.path.join(dot_dir, ".last_update_check")
    
    # Rate limit check for background process
    if background and not force:
        if os.path.exists(timestamp_file):
            mtime = os.path.getmtime(timestamp_file)
            age = time.time() - mtime
            if age < RATE_LIMIT_SECONDS:
                sys.exit(0)
                
    # Update timestamp
    try:
        Path(timestamp_file).touch(exist_ok=True)
    except Exception:
        pass
        
    # Execute Git update check
    try:
        git_dir = os.path.join(repo_root, ".git")
        if not os.path.exists(git_dir):
            if not background:
                print("📂 Not a git repository. Skipping update.")
            sys.exit(0)
            
        if not background:
            print("🔍 Checking remote for updates...")
            
        # git fetch
        subprocess.run(["git", "fetch", "origin", "main"], cwd=repo_root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        # Compare local vs remote
        local_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo_root, text=True).strip()
        remote_commit = subprocess.check_output(["git", "rev-parse", "origin/main"], cwd=repo_root, text=True).strip()
        
        if local_commit != remote_commit:
            behind = subprocess.run(["git", "merge-base", "--is-ancestor", "HEAD", "origin/main"], cwd=repo_root).returncode == 0
            if behind:
                if not background:
                    print("📥 Updating markdown-memory to the latest version...")
                
                subprocess.run(["git", "pull", "origin", "main"], cwd=repo_root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                
                # Re-register skills
                register_script = os.path.join(repo_root, "scripts", "register-skills.py")
                if os.path.exists(register_script):
                    subprocess.run([sys.executable, register_script], cwd=repo_root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                
                if not background:
                    print("🎉 Successfully updated and re-registered skills!")
            else:
                if not background:
                    print("⚠️ Local branch has diverged or is ahead of origin/main. Skipping update.")
        else:
            if not background:
                print("✅ markdown-memory is already up to date.")
    except Exception as e:
        if not background:
            print(f"❌ Error updating repository: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
