# Serves the BillKul preview from the "site" folder next to this script and opens it in your browser.
# It only listens on this computer (localhost). Close the window to stop it.
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'site'))
$port = 8765
$address = "http://localhost:$port/"

if (-not (Test-Path (Join-Path $root 'index.html'))) {
    Write-Host "The preview files are missing from: $root"
    exit 1
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($address)
try {
    $listener.Start()
} catch {
    Write-Host "Could not start the preview on port $port. It may already be running in another window."
    Write-Host "Opening $address in your browser."
    try { Start-Process $address } catch { }
    exit 1
}

$types = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.ico'  = 'image/x-icon'
    '.ttf'  = 'font/ttf'
    '.svg'  = 'image/svg+xml'
    '.css'  = 'text/css; charset=utf-8'
}

Write-Host ""
Write-Host "  BillKul preview is running at $address"
Write-Host "  Keep this window open while you test. Close it to stop."
Write-Host ""
try { Start-Process $address } catch { Write-Host "  Open that address in your browser." }

while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
        $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/')
        if ([string]::IsNullOrEmpty($relative)) { $relative = 'index.html' }
        $file = [IO.Path]::GetFullPath((Join-Path $root $relative))
        $inside = $file.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
        # A folder such as privacy/ shows its own index.html.
        if ($inside -and (Test-Path $file -PathType Container)) { $file = Join-Path $file 'index.html' }
        if (-not $inside -or -not (Test-Path $file -PathType Leaf)) {
            $file = Join-Path $root 'index.html'
        }
        $bytes = [IO.File]::ReadAllBytes($file)
        $extension = [IO.Path]::GetExtension($file).ToLowerInvariant()
        if ($types.ContainsKey($extension)) {
            $context.Response.ContentType = $types[$extension]
        } else {
            $context.Response.ContentType = 'application/octet-stream'
        }
        $context.Response.Headers.Add('Cache-Control', 'no-store')
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
        try { $context.Response.StatusCode = 500 } catch { }
    } finally {
        try { $context.Response.Close() } catch { }
    }
}
