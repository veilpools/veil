Add-Type -AssemblyName System.Drawing

$srcPath = "D:\Project\wealthypeople\veil\public\veil-logo.png"
if (-not (Test-Path $srcPath)) {
    $srcPath = "C:\Users\sifaq\Downloads\veil-halftone-logo-1920 (1).png"
}

$src = [System.Drawing.Image]::FromFile($srcPath)

# 32x32 favicon
$bmp32 = New-Object System.Drawing.Bitmap 32, 32
$g32 = [System.Drawing.Graphics]::FromImage($bmp32)
$g32.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g32.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g32.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g32.DrawImage($src, 0, 0, 32, 32)
$bmp32.Save("D:\Project\wealthypeople\veil\public\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 180x180 apple touch icon
$bmp180 = New-Object System.Drawing.Bitmap 180, 180
$g180 = [System.Drawing.Graphics]::FromImage($bmp180)
$g180.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g180.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g180.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g180.DrawImage($src, 0, 0, 180, 180)
$bmp180.Save("D:\Project\wealthypeople\veil\public\apple-touch-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Clean up
$g32.Dispose()
$bmp32.Dispose()
$g180.Dispose()
$bmp180.Dispose()
$src.Dispose()

Write-Host "Generated favicon.png and apple-touch-icon.png successfully."
