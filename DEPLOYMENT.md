# 🔐 Secure Deployment Guide

## Quick Start

```bash
# 1. Encrypt your secrets (first time only)
./scripts/secrets-manager.sh encrypt

# 2. Deploy application (decrypts + starts Docker)
./scripts/secrets-manager.sh deploy
```

## Commands

| Command | Description |
|---------|-------------|
| `encrypt` | Encrypt `.env` → `.env.encrypted` |
| `decrypt` | Decrypt `.env.encrypted` → `.env` |
| `view` | View secrets without writing to disk |
| `rotate` | Change passkey |
| `deploy` | One-command deployment |

## Deployment Workflow

### Initial Setup (Developer Machine)
```bash
# Configure secrets
cp .env.example .env
nano .env  # Edit with your values

# Encrypt for sharing
./scripts/secrets-manager.sh encrypt
# Enter a strong passkey when prompted

# Commit encrypted file
git add .env.encrypted
git commit -m "Add encrypted secrets"
git push
```

### Deploying to Server
```bash
# SSH to server
ssh user@100.105.31.42

# Clone repo (or pull updates)
git clone https://github.com/yourusername/travel-journal.git
cd travel-journal

# Deploy (will prompt for passkey)
./scripts/secrets-manager.sh deploy

# App is now running at http://localhost:3080
```

### View Secrets (Without Decrypting to File)
```bash
./scripts/secrets-manager.sh view
```

## Security Notes

- ✅ **Safe to commit**: `.env.encrypted`
- ❌ **Never commit**: `.env` (already in .gitignore)
- 🔑 **Passkey**: Share securely via Signal/1Password
- 🔄 **Rotate**: Change passkey periodically with `rotate` command

## How It Works

Uses **OpenSSL AES-256-CBC** encryption with:
- PBKDF2 key derivation
- 100,000 iterations
- Salt for unique encryption each time

Encryption is military-grade. Your passkey is the only way to decrypt.

## Troubleshooting

**"Decryption failed"**
- Check your passkey (case-sensitive)
- Ensure `.env.encrypted` file is not corrupted

**"No such file"**
- Run `encrypt` command first
- Or obtain `.env.encrypted` from team

**Permission denied**
- Run `chmod +x scripts/secrets-manager.sh`
