#!/bin/bash

# Set the API URL and the image file to upload
API_URL="http://localhost:8000/photos"
IMAGE_FILE="/jam.jpeg"

echo "Uploading image..."

# Upload the image and save the returned photo ID
photo_id=$(curl -s -X POST -F "image=@${IMAGE_FILE}" -F "userId=123" -F "businessId=456" $API_URL | jq -r '.id')

if [ "$photo_id" == "null" ] || [ -z "$photo_id" ]; then
  echo "Failed to upload image."
  exit 1
fi

echo "Uploaded photo ID: $photo_id"

echo "Downloading original photo..."
curl -f -o tests/downloaded.jpg "$API_URL/$photo_id" || { echo "Failed to download original photo"; exit 1; }

echo "Downloading thumbnail..."
curl -f -o tests/thumb.jpg "http://localhost:8000/thumbs/$photo_id.jpg" || { echo "Failed to download thumbnail"; exit 1; }

echo "Tests completed successfully!"
