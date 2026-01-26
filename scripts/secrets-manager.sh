#!/bin/bash
# Travel Journal - Secure Secrets Management
# Uses OpenSSL AES-256-CBC encryption with passkey

SECRETS_FILE=".env"
ENCRYPTED_FILE=".env.encrypted"
TEMP_DECRYPTED="/tmp/.env.decrypted.$$"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Cleanup on exit
trap "rm -f $TEMP_DECRYPTED" EXIT

show_help() {
  cat << EOF
Travel Journal Secrets Manager

Usage: $0 [command]

Commands:
  encrypt     Encrypt .env file with passkey (creates .env.encrypted)
  decrypt     Decrypt .env.encrypted to .env (for deployment)
  view        View decrypted secrets without writing to disk
  rotate      Re-encrypt with new passkey
  deploy      Decrypt secrets and start Docker containers
  help        Show this help message

Examples:
  $0 encrypt              # Encrypt your .env file
  $0 decrypt              # Decrypt for local use
  $0 deploy               # Decrypt and docker-compose up
  $0 view                 # Safely view secrets

Security Notes:
- Never commit .env to git (already in .gitignore)
- Share .env.encrypted with team (safe to commit)
- Passkey should be memorable but strong
- Use different passkeys for dev/staging/prod

EOF
}

encrypt_secrets() {
  if [ ! -f "$SECRETS_FILE" ]; then
    echo -e "${RED}Error: $SECRETS_FILE not found${NC}"
    echo "Copy .env.example to .env and configure it first"
    exit 1
  fi

  echo -e "${YELLOW}Encrypting secrets...${NC}"
  echo "Enter passkey (will not be displayed):"
  
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -in "$SECRETS_FILE" \
    -out "$ENCRYPTED_FILE" \
    -pass stdin
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Secrets encrypted to $ENCRYPTED_FILE${NC}"
    echo "You can now safely commit $ENCRYPTED_FILE to git"
    echo -e "${RED}Remember your passkey - it's needed for decryption!${NC}"
  else
    echo -e "${RED}✗ Encryption failed${NC}"
    exit 1
  fi
}

decrypt_secrets() {
  if [ ! -f "$ENCRYPTED_FILE" ]; then
    echo -e "${RED}Error: $ENCRYPTED_FILE not found${NC}"
    echo "Run '$0 encrypt' first or obtain the encrypted file"
    exit 1
  fi

  echo -e "${YELLOW}Decrypting secrets...${NC}"
  echo "Enter passkey:"
  
  openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
    -in "$ENCRYPTED_FILE" \
    -out "$SECRETS_FILE" \
    -pass stdin
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Secrets decrypted to $SECRETS_FILE${NC}"
    echo "You can now start the application"
  else
    echo -e "${RED}✗ Decryption failed - check your passkey${NC}"
    exit 1
  fi
}

view_secrets() {
  if [ ! -f "$ENCRYPTED_FILE" ]; then
    echo -e "${RED}Error: $ENCRYPTED_FILE not found${NC}"
    exit 1
  fi

  echo -e "${YELLOW}Viewing secrets (not writing to disk)...${NC}"
  echo "Enter passkey:"
  
  openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
    -in "$ENCRYPTED_FILE" \
    -pass stdin 2>/dev/null
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Decryption failed - check your passkey${NC}"
    exit 1
  fi
}

rotate_passkey() {
  if [ ! -f "$ENCRYPTED_FILE" ]; then
    echo -e "${RED}Error: $ENCRYPTED_FILE not found${NC}"
    exit 1
  fi

  echo -e "${YELLOW}Rotating passkey...${NC}"
  echo "Enter OLD passkey:"
  
  # Decrypt with old passkey
  openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
    -in "$ENCRYPTED_FILE" \
    -out "$TEMP_DECRYPTED" \
    -pass stdin
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Decryption failed - check your old passkey${NC}"
    exit 1
  fi

  echo "Enter NEW passkey:"
  
  # Encrypt with new passkey
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -in "$TEMP_DECRYPTED" \
    -out "$ENCRYPTED_FILE" \
    -pass stdin
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Passkey rotated successfully${NC}"
  else
    echo -e "${RED}✗ Re-encryption failed${NC}"
    exit 1
  fi
}

deploy_app() {
  echo -e "${YELLOW}Deploying Travel Journal...${NC}"
  
  # Decrypt secrets
  decrypt_secrets
  
  if [ $? -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}Starting Docker containers...${NC}"
    docker-compose down 2>/dev/null
    docker-compose up --build -d
    
    if [ $? -eq 0 ]; then
      echo ""
      echo -e "${GREEN}✓ Deployment successful!${NC}"
      echo ""
      echo "Access your app at: http://localhost:3080"
      echo ""
      echo "Check status: docker-compose ps"
      echo "View logs: docker-compose logs -f"
      echo "Stop: docker-compose down"
    else
      echo -e "${RED}✗ Docker deployment failed${NC}"
      exit 1
    fi
  fi
}

# Main command routing
case "${1:-help}" in
  encrypt)
    encrypt_secrets
    ;;
  decrypt)
    decrypt_secrets
    ;;
  view)
    view_secrets
    ;;
  rotate)
    rotate_passkey
    ;;
  deploy)
    deploy_app
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    echo ""
    show_help
    exit 1
    ;;
esac
