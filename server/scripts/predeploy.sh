#!/bin/bash
set -e
set -x
echo "installing global dependency..."
npm install -g pm2@5.3.1
echo "installing npm dependencies..."
npm run build:install
echo "running build with cli tools..."
npm run build:pre
echo "resolving local dependencies..."
npm run build:ci
echo "server deployment preparation complete..."


