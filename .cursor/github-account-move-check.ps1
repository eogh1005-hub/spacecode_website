$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$skipDir = '\\(\.git\\(objects|refs|logs|cursor|hooks|info)|node_modules\\|__pycache__\\|\\.venv\\)'
$skipExt = @{
    ".png" = $true; ".jpg" = $true; ".jpeg" = $true; ".gif" = $true; ".webp" = $true
    ".mp4" = $true; ".woff" = $true; ".woff2" = $true; ".pdf" = $true; ".zip" = $true
    ".exe" = $true; ".dll" = $true; ".pack" = $true; ".idx" = $true; ".ico" = $true
}
$self = @(
    (Join-Path $root ".cursor\github-account-move-check.ps1"),
    (Join-Path $root ".cursor\rules\github-account-move.mdc")
)
# .git 안에서는 원격 주소가 있는 config만 본다. FETCH_HEAD 같은 임시 파일은 고칠 위치가 아니다.
$needles = @("2023011946", "connect-archtect")
Get-ChildItem -LiteralPath $root -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch $skipDir -and
        $_.Length -lt 2000000 -and
        -not $skipExt.ContainsKey($_.Extension.ToLowerInvariant()) -and
        ($self -notcontains $_.FullName) -and
        (($_.FullName -notmatch '\\.git\\') -or ($_.Name -eq "config"))
    } |
    ForEach-Object {
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        if ($bytes.Length -ge 8000) { $sample = $bytes[0..7999] } else { $sample = $bytes }
        if ($sample -contains 0) { return }
        $text = [System.Text.Encoding]::UTF8.GetString($bytes)
        if (-not ($needles | Where-Object { $text.IndexOf($_) -ge 0 })) { return }
        $n = 0
        foreach ($line in ($text -split "`r?`n", -1)) {
            $n++
            if ($needles | Where-Object { $line.IndexOf($_) -ge 0 }) {
                $rel = $_.FullName.Substring($root.Length).TrimStart("\", "/") -replace "\\", "/"
                Write-Output ("{0}({1},1): error: GitHub 저장소 연결이 이전 계정에 있습니다. 이 줄의 저장소 주소만 eogh1005-hub 경로로 바꾸세요. 새 저장소가 없으면 이 줄을 유지하세요. env, key, token 값은 출력하지 마세요." -f $rel, $n)
            }
        }
    }
exit 0
