# Genera PNG de las tres capas del escenario (misma logica visual que game.js, parallax = 0).
# Requiere Windows + System.Drawing (habitual en .NET Framework / escritorio).

Add-Type -AssemblyName System.Drawing

function Get-LerpRgb([int]$r1, [int]$g1, [int]$b1, [int]$r2, [int]$g2, [int]$b2, [double]$t) {
    $r = [int]($r1 + ($r2 - $r1) * $t)
    $g = [int]($g1 + ($g2 - $g1) * $t)
    $b = [int]($b1 + ($b2 - $b1) * $t)
    return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

function Fill-SkyGradient([System.Drawing.Graphics]$g, [int]$w, [int]$horizonY) {
    $c0 = [System.Drawing.ColorTranslator]::FromHtml("#241a4a")
    $c1 = [System.Drawing.ColorTranslator]::FromHtml("#3a2a72")
    $c2 = [System.Drawing.ColorTranslator]::FromHtml("#151028")
    for ($y = 0; $y -lt $horizonY; $y++) {
        $t = if ($horizonY -le 1) { 0 } else { [double]$y / ($horizonY - 1) }
        $col = if ($t -le 0.42) {
            $u = $t / 0.42
            Get-LerpRgb $c0.R $c0.G $c0.B $c1.R $c1.G $c1.B $u
        }
        else {
            $u = ($t - 0.42) / 0.58
            Get-LerpRgb $c1.R $c1.G $c1.B $c2.R $c2.G $c2.B $u
        }
        $pen = New-Object System.Drawing.SolidBrush $col
        $g.FillRectangle($pen, 0, $y, $w, 1)
        $pen.Dispose()
    }
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OutDir = Join-Path $ProjectRoot "assets\background"
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

# Misma resolucion que index.html (canvas 1600x900) -> FLOOR_Y = 900 - 85
$W = 1600
$canvasH = 900
$horizonY = $canvasH - 85

# --- Capa lejana (opaca) ---
$bmpFar = New-Object System.Drawing.Bitmap $W, $horizonY, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gFar = [System.Drawing.Graphics]::FromImage($bmpFar)
$gFar.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
Fill-SkyGradient $gFar $W $horizonY

$starBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(71, 255, 255, 255))
$parallax = 0
for ($i = 0; $i -lt 70; $i++) {
    if (($i % 4) -ne 0) { continue }
    $sx = [int]((($i * 131 + $parallax * 0.12) % $W + $W) % $W)
    $sy = [int]((($i * 53) % [Math]::Max(1, [int]([Math]::Floor($horizonY * 0.5)))) + 10)
    $gFar.FillRectangle($starBrush, $sx, $sy, 2, 2)
}
$starBrush.Dispose()

$moonBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(89, 200, 188, 255))
$mx = [int]($W * 0.82 + $parallax * 0.04)
$my = [int]($horizonY * 0.22)
$gFar.FillEllipse($moonBrush, $mx - 44, $my - 44, 88, 88)
$moonBrush.Dispose()

$mtBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#1a1436"))
$pts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
$pts.Add([System.Drawing.PointF]::new(-80, $horizonY))
for ($x = -80; $x -le $W + 80; $x += 48) {
    $h = 18 + [Math]::Sin(($x + $parallax * 0.18) * 0.012) * 32
    $pts.Add([System.Drawing.PointF]::new($x, $horizonY - $h))
}
$pts.Add([System.Drawing.PointF]::new($W + 80, $horizonY))
$gFar.FillPolygon($mtBrush, $pts.ToArray())
$mtBrush.Dispose()

$pathFar = Join-Path $OutDir "stage_layer_01_far.png"
$bmpFar.Save($pathFar, [System.Drawing.Imaging.ImageFormat]::Png)
$gFar.Dispose()
$bmpFar.Dispose()
Write-Host "OK: $pathFar"

# --- Capa media (transparente fuera de edificios) ---
$bmpMid = New-Object System.Drawing.Bitmap $W, $horizonY, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gMid = [System.Drawing.Graphics]::FromImage($bmpMid)
$gMid.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
$gMid.Clear([System.Drawing.Color]::Transparent)

$base = 0
$bldBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#2d2458"))
for ($i = -2; $i -lt 22; $i++) {
    $rw = 62 + (($i * 17) % 48)
    $rh = 85 + (($i * 29) % 95)
    $rx = [int]($base + $i * 88 + ($i % 3) * 14)
    $gMid.FillRectangle($bldBrush, $rx, $horizonY - $rh, $rw - 6, $rh)
}
$bldBrush.Dispose()

$winBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(56, 255, 214, 150))
for ($i = 0; $i -lt 36; $i++) {
    $wx = [int]((($base * 1.4 + $i * 43 + $parallax * 0.2) % ($W + 30)) - 15)
    $wy = [int]($horizonY - 35 - (($i * 23) % 130))
    $gMid.FillRectangle($winBrush, $wx, $wy, 4, 6)
}
$winBrush.Dispose()

$pathMid = Join-Path $OutDir "stage_layer_02_mid.png"
$bmpMid.Save($pathMid, [System.Drawing.Imaging.ImageFormat]::Png)
$gMid.Dispose()
$bmpMid.Dispose()
Write-Host "OK: $pathMid"

# --- Capa cercana (transparente) ---
$bmpNear = New-Object System.Drawing.Bitmap $W, $horizonY, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gNear = [System.Drawing.Graphics]::FromImage($bmpNear)
$gNear.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gNear.Clear([System.Drawing.Color]::Transparent)

$nearBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#120c22"))
for ($i = -1; $i -lt 16; $i++) {
    $nw = 78 + (($i * 19) % 72)
    $nh = 48 + (($i * 11) % 62)
    $nx = [int]($i * 108)
    $gNear.FillRectangle($nearBrush, $nx, $horizonY - $nh, $nw - 10, $nh)
}
$nearBrush.Dispose()

$fencePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(26, 255, 255, 255), 2)
for ($x = -40; $x -lt $W + 40; $x += 20) {
    $rx = [int]($x - $parallax * 0.72)
    $gNear.DrawLine($fencePen, $rx, $horizonY - 6, $rx + 12, $horizonY - 22)
}
$fencePen.Dispose()

$shadeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(64, 0, 0, 0))
$gNear.FillRectangle($shadeBrush, 0, $horizonY - 28, $W, 28)
$shadeBrush.Dispose()

$pathNear = Join-Path $OutDir "stage_layer_03_near.png"
$bmpNear.Save($pathNear, [System.Drawing.Imaging.ImageFormat]::Png)
$gNear.Dispose()
$bmpNear.Dispose()
Write-Host "OK: $pathNear"

Write-Host "Exportacion terminada."
