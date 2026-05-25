import os, shutil, re

# Create api dir
os.makedirs('api', exist_ok=True)

# Move backend files
if os.path.exists('backend/main.py'):
    shutil.move('backend/main.py', 'api/index.py')
if os.path.exists('backend/requirements.txt'):
    shutil.move('backend/requirements.txt', 'requirements.txt')

# Modify FastAPI routes in api/index.py
if os.path.exists('api/index.py'):
    with open('api/index.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('@app.get("/search"', '@app.get("/api/search"')
    content = content.replace('@app.get("/stream"', '@app.get("/api/stream"')
    content = content.replace('@app.get("/lyrics"', '@app.get("/api/lyrics"')
    
    with open('api/index.py', 'w', encoding='utf-8') as f:
        f.write(content)

# Move frontend files to root
if os.path.exists('frontend'):
    for item in os.listdir('frontend'):
        src = os.path.join('frontend', item)
        dst = os.path.join('.', item)
        if os.path.exists(dst):
            if os.path.isdir(dst): shutil.rmtree(dst)
            else: os.remove(dst)
        shutil.move(src, dst)

# Update App.jsx backend URL
if os.path.exists('src/App.jsx'):
    with open('src/App.jsx', 'r', encoding='utf-8') as f:
        app_content = f.read()
    
    app_content = re.sub(r"const BACKEND_URL = .*", "const BACKEND_URL = '';", app_content)
    
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(app_content)

print("Restructure complete.")
