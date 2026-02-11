#!/usr/bin/env bash
# ---------------------------------------------------------------
#  Frontend deploy script
#  Syncs dist/ to S3, fixes MIME types, and invalidates CloudFront.
#  Usage:  bash frontend/scripts/deploy.sh
# ---------------------------------------------------------------
set -euo pipefail

BUCKET="s3://flexiblemorals.org"
DIST_ID="EG39CF6S0XUI4"
DIST_DIR="frontend/dist"

echo "==> Syncing $DIST_DIR to $BUCKET ..."
aws s3 sync "$DIST_DIR" "$BUCKET" --delete

echo "==> Fixing MIME types for .js files ..."
for key in $(aws s3api list-objects-v2 --bucket flexiblemorals.org --prefix assets/ --query "Contents[?ends_with(Key,'.js')].Key" --output text); do
  echo "    fixing $key -> application/javascript"
  aws s3 cp "s3://flexiblemorals.org/$key" "s3://flexiblemorals.org/$key" \
    --content-type "application/javascript" \
    --metadata-directive REPLACE
done

echo "==> Invalidating CloudFront $DIST_ID ..."
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" | head -5

echo "==> Deploy complete!"
