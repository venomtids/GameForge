# Desinstala o GORE FORGE (silencioso) e prova que saiu do sistema.
#
#   pwsh -File scripts/desinstalar-e-verificar-goreforge.ps1
#
# Usa GOREFORGE_INSTALADO (definido pelo script de instalacao) ou -Pasta.

[CmdletBinding()]
param(
    [string] $Pasta = $env:GOREFORGE_INSTALADO,
    [int] $Tentativas = 60
)

$ErrorActionPreference = "Continue"

function Anotar([string] $titulo, [string] $texto) {
    $limpo = ($texto -replace '%', '%25') -replace "`r?`n", ' '
    Write-Host "::error title=$titulo::$limpo"
}

function Falhar([string] $texto) {
    Anotar "Desinstalador GORE FORGE" $texto
    exit 1
}

function EntradasDeDesinstalacao {
    $chaves = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    )
    foreach ($chave in $chaves) {
        Get-ChildItem $chave -ErrorAction SilentlyContinue | ForEach-Object {
            $propriedades = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
            if ($propriedades -and $propriedades.DisplayName) {
                [pscustomobject]@{
                    Chave           = $_.PSPath
                    DisplayName     = $propriedades.DisplayName
                    InstallLocation = $propriedades.InstallLocation
                    UninstallString = $propriedades.UninstallString
                }
            }
        }
    }
}

if (-not $Pasta) {
    $entrada = EntradasDeDesinstalacao | Where-Object { $_.DisplayName -eq "GORE FORGE" } | Select-Object -First 1
    if ($entrada) { $Pasta = $entrada.InstallLocation }
}
if (-not $Pasta) { Falhar "nao sei onde o GORE FORGE foi instalado (GOREFORGE_INSTALADO vazio e sem registro)" }
Write-Host "Desinstalando de: $Pasta"

$desinstalador = Get-ChildItem $Pasta -Filter "Uninstall*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $desinstalador) {
    Falhar "desinstalador nao encontrado em $Pasta (tem: $((Get-ChildItem $Pasta -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }) -join ', '))"
}

Write-Host "Rodando $($desinstalador.Name) /S ..."
$processo = Start-Process -FilePath $desinstalador.FullName -ArgumentList "/S" -Wait -PassThru
$codigo = $processo.ExitCode
Write-Host "desinstalador retornou $codigo"

$exe = Join-Path $Pasta "GORE FORGE.exe"
for ($i = 0; $i -lt $Tentativas -and (Test-Path $exe); $i++) { Start-Sleep -Seconds 1 }

$falhas = @()
if (Test-Path $exe) { $falhas += "o executavel continua instalado em $Pasta" }
$entrada = EntradasDeDesinstalacao | Where-Object { $_.DisplayName -eq "GORE FORGE" } | Select-Object -First 1
if ($entrada) { $falhas += "a entrada de desinstalacao ficou no registro ($($entrada.Chave))" }

$atalho = Join-Path ([Environment]::GetFolderPath("Desktop")) "GORE FORGE.lnk"
if (Test-Path $atalho) { $falhas += "o atalho da Area de Trabalho ficou" }

if ($falhas.Count -gt 0) { Falhar ("desinstalacao incompleta (codigo $codigo): " + ($falhas -join "; ")) }

Write-Host "OK: desinstalacao limpa (codigo $codigo)"
exit 0
