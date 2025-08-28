$API="http://localhost:4100/api/v1"
$PHONE="+821022227777"
$CARRIER="SKT"

Write-Host "=== API Test Start ===" -ForegroundColor Green

# 1) send-sms
Write-Host "`n1) send-sms test..." -ForegroundColor Yellow
try {
    $send = Invoke-RestMethod -Method Post -Uri "$API/auth/send-sms" -ContentType "application/json" `
        -Body (@{ phone=$PHONE; carrier=$CARRIER; context="signup" } | ConvertTo-Json)
    Write-Host "send-sms success:" -ForegroundColor Green
    $send | ConvertTo-Json -Depth 10
    
    # 2) Get OTP code from console
    Write-Host "`n2) Enter OTP code..." -ForegroundColor Yellow
    $CODE = Read-Host "Enter dev OTP code"
    
    # 3) verify-code
    Write-Host "`n3) verify-code test..." -ForegroundColor Yellow
    $verify = Invoke-RestMethod -Method Post -Uri "$API/auth/verify-code" -ContentType "application/json" `
        -Body (@{ phone=$PHONE; code=$CODE; context="signup" } | ConvertTo-Json)
    Write-Host "verify-code success:" -ForegroundColor Green
    $verify | ConvertTo-Json -Depth 10
    
    # 4) signup (OTP 재검증을 위해 code와 context 포함)
    Write-Host "`n4) signup test..." -ForegroundColor Yellow
    $signup = Invoke-RestMethod -Method Post -Uri "$API/auth/signup" -ContentType "application/json" `
        -Body (@{
            phone=$PHONE; code=$CODE; context="signup"; name="Hong Gil Dong"; birth="1970-01-01"; gender="M";
            agreements=@(@{id="tos"; v="1.0"; agreed=$true}, @{id="privacy"; v="1.0"; agreed=$true})
        } | ConvertTo-Json)
    Write-Host "signup success:" -ForegroundColor Green
    $signup | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body:" -ForegroundColor Red
        Write-Host $responseBody -ForegroundColor Red
    }
}

Write-Host "`n=== API Test Complete ===" -ForegroundColor Green
