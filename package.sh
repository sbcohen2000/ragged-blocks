#!/usr/bin/env sh
VERSION="2.0.0"

rm -rf dist
npx tsc --declaration --emitDeclarationOnly
npx esbuild ./src/index.ts --bundle --format=esm > ./dist/index.js
cat > ./dist/package.json << EOF
{
  "name": "ragged-blocks",
  "version": "$VERSION",
  "main": "./index.js",
  "types": "./index.d.ts"
}
EOF
(cd dist; npm pack --pack-destination ..)
