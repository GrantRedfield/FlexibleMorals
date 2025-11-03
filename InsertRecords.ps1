Write-Host "🪶 Seeding DynamoDB Table: FlexibleTable" -ForegroundColor Yellow

$items = @(
    @{ PK = "POST#1"; SK = "META"; title = "Thou shalt be chill"; votes = 5 },
    @{ PK = "POST#2"; SK = "META"; title = "Honor thy memes"; votes = 7 },
    @{ PK = "POST#3"; SK = "META"; title = "Thou shalt not ghost"; votes = 3 },
    @{ PK = "POST#4"; SK = "META"; title = "Blessed are the flexible"; votes = 9 },
    @{ PK = "POST#5"; SK = "META"; title = "Thou shalt share Wi-Fi"; votes = 4 }
)

foreach ($item in $items) {
    # Build item as JSON string (PowerShell-safe)
    $json = @"
{
    \"PK\": {\"S\": \"$($item.PK)\"},
    \"SK\": {\"S\": \"$($item.SK)\"},
    \"title\": {\"S\": \"$($item.title)\"},
    \"votes\": {\"N\": \"$($item.votes)\"}
}
"@

    # Run AWS CLI with proper escaping
    aws dynamodb put-item `
      --table-name FlexibleTable `
      --item $json `
      --endpoint-url http://localhost:8000 | Out-Null

    Write-Host "✅ Added: $($item.title)" -ForegroundColor Green
}

Write-Host "🎉 Done! All sample commandments added successfully." -ForegroundColor Cyan

# Verify at the end
aws dynamodb scan --table-name FlexibleTable --endpoint-url http://localhost:8000
