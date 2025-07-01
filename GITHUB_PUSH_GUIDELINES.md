# GitHub Push Guidelines - AI Auth Project

## 🚨 CRITICAL: Files You Should NEVER Push to GitHub

### 1. **Environment Files (.env)**
```
.env
.env.local
.env.production
.env.development.local
```
**Why:** Contains sensitive information like:
- Database passwords
- JWT secrets
- OAuth client secrets
- API keys (Twilio, email service)
- Private keys

### 2. **Dependencies**
```
node_modules/
package-lock.json (optional)
yarn.lock (optional)
```
**Why:** Large size, can be regenerated with `npm install`

### 3. **Build Artifacts**
```
dist/
build/
*.tsbuildinfo
```
**Why:** Generated files, can be rebuilt

### 4. **Logs and Runtime Files**
```
logs/
*.log
*.pid
```
**Why:** Runtime generated, not part of source code

### 5. **IDE/Editor Files**
```
.vscode/
.idea/
*.swp
*.swo
```
**Why:** Personal editor configurations

## ✅ Files You SHOULD Push to GitHub

### 1. **Source Code**
```
src/
├── config/
├── controllers/
├── middlewares/
├── models/
├── routes/
├── services/
├── utils/
├── validations/
├── app.ts
└── server.ts
```

### 2. **Configuration Files**
```
package.json
tsconfig.json
nodemon.json
.env.example (template only)
```

### 3. **Documentation**
```
README.md
POSTMAN_TESTING_GUIDE.md
SOCIAL_LOGIN_IMPLEMENTATION.md
```

### 4. **Postman Collection**
```
AI_Auth_Postman_Collection.json
```

### 5. **Project Setup Files**
```
.gitignore
setup.json
verify-setup.js
```

## 🔒 Security Best Practices

### Environment Variables Security
1. **Never commit `.env` files**
2. **Always provide `.env.example`** with dummy values
3. **Use different secrets for each environment**
4. **Rotate secrets regularly**

### OAuth Security
```env
# ❌ NEVER commit real values
GOOGLE_CLIENT_SECRET=GOCSPX-real-secret-here

# ✅ Use placeholders in .env.example
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Database Security
```env
# ❌ NEVER commit real credentials
DB_PASS=myRealPassword123

# ✅ Use placeholders
DB_PASS=your_database_password
```

## 📦 Before Pushing to GitHub

### 1. **Check for Sensitive Data**
```bash
# Search for potential secrets
grep -r "password\|secret\|key\|token" src/ --exclude-dir=node_modules
```

### 2. **Verify .gitignore is Working**
```bash
git status
# Should NOT show .env or node_modules
```

### 3. **Clean Commit Messages**
```bash
git add .
git commit -m "feat: implement social login with Google and GitHub OAuth"
git push origin main
```

## 🚫 What Happens if You Accidentally Push Secrets

### Immediate Actions:
1. **Change all exposed secrets immediately**
2. **Remove from git history:**
   ```bash
   git filter-branch --force --index-filter \
   'git rm --cached --ignore-unmatch .env' \
   --prune-empty --tag-name-filter cat -- --all
   ```
3. **Force push to overwrite history:**
   ```bash
   git push origin --force --all
   ```

### Update All Secrets:
- JWT secrets
- Database passwords
- OAuth client secrets
- API keys (Twilio, email)

## 📋 Safe Repository Structure

```
AI_Auth/
├── src/                          ✅ Push
├── package.json                  ✅ Push
├── tsconfig.json                 ✅ Push
├── README.md                     ✅ Push
├── .env.example                  ✅ Push (template only)
├── .gitignore                    ✅ Push
├── AI_Auth_Postman_Collection.json ✅ Push
├── POSTMAN_TESTING_GUIDE.md      ✅ Push
├── .env                          ❌ NEVER push
├── node_modules/                 ❌ NEVER push
├── logs/                         ❌ NEVER push
├── dist/                         ❌ NEVER push
└── *.log                         ❌ NEVER push
```

## 🔧 Setting Up New Environment

When someone clones your repo:

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in real values:**
   ```bash
   nano .env
   # Add real database credentials, OAuth secrets, etc.
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run the application:**
   ```bash
   npm run dev
   ```

## 📝 Repository Best Practices

### Commit Message Format
```
feat: add social login functionality
fix: resolve OAuth configuration issues
docs: update Postman testing guide
refactor: improve error handling in auth controller
```

### Branch Strategy
```bash
# Main development
git checkout -b feature/social-login
git checkout -b fix/oauth-configuration
git checkout -b docs/update-readme
```

### Pull Request Guidelines
1. **Remove all sensitive data**
2. **Test in clean environment**
3. **Update documentation**
4. **Add proper commit messages**

Remember: **Security first!** When in doubt, don't push it. You can always add files later, but removing sensitive data from git history is much harder.
