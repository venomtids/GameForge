# Instala o Setup.exe do GORE FORGE em silencio e verifica o resultado.
#
#   pwsh -File scripts/instalar-e-verificar-goreforge.ps1 -Pacote dist/windows-goreforge
#
# Toda falha vira anotacao do GitHub (::error), com contexto suficiente para
# entender o que aconteceu sem baixar log nenhum.

[CmdletBinding()]
param(
    [string] $Pacote = "dist/windows-goreforge",
    [string] $GithubEnv = $env:GITHUB_ENV,
    [int] $Tentativas = 60
)

$ErrorActionPreference = "Continue"

function Anotar([string] $titulo, [string] $texto) {
    $limpo = ($texto -replace '%', '%25') -replace "`r?`n", ' '
    Write-Host "::error title=$titulo::$limpo"
}

function Falhar([string] $texto) {
    Anotar "Instalador GORE FORGE" $texto
    exit 1
}

function Listar([string] $caminho, [int] $limite = 20) {
    if (-not (Test-Path $caminho)) { return "(nao existe: $caminho)" }
    $itens = Get-ChildItem $caminho -ErrorAction SilentlyContinue | Select-Object -First $limite
    return ($itens | ForEach-Object { $_.Name }) -join ", "
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
                    DisplayVersion  = $propriedades.DisplayVersion
                    InstallLocation = $propriedades.InstallLocation
                    UninstallString = $propriedades.UninstallString
                }
            }
        }
    }
}

# ------------------------------------------------------------------ o pacote
if (-not (Test-Path $Pacote)) { Falhar "pasta do pacote nao encontrada: $Pacote" }
$setup = Get-ChildItem $Pacote -Filter "*-Setup.exe" | Select-Object -First 1
if (-not $setup) { Falhar "nenhum *-Setup.exe em ${Pacote} (tem: $(Listar $Pacote))" }
Write-Host "Setup: $($setup.Name) ($([math]::Round($setup.Length / 1MB, 1)) MB)"

$somas = Join-Path $Pacote "SHA256SUMS.txt"
if (-not (Test-Path $somas)) { Falhar "SHA256SUMS.txt nao encontrado em $Pacote" }
$hash = (Get-FileHash $setup.FullName -Algorithm SHA256).Hash.ToLower()
$linha = (Get-Content $somas | Where-Object { $_ -match [regex]::Escape($setup.Name) } | Select-Object -First 1)
if (-not $linha) { Falhar "SHA256SUMS.txt nao lista $($setup.Name)" }
if ($linha -notmatch $hash) { Falhar "SHA-256 do Setup.exe nao confere: arquivo $hash, publicado $linha" }
Write-Host "SHA-256 confere com SHA256SUMS.txt ($hash)"

# antes de instalar: para comparar depois
$antes = @(EntradasDeDesinstalacao | Where-Object { $_.DisplayName -eq "GORE FORGE" })
if ($antes.Count -gt 0) { Write-Host "Aviso: ja existia instalacao anterior (sera atualizada)" }

# ---------------------------------------------------------------- instalacao
Write-Host "Instalando em silencio (/S) ..."
$processo = Start-Process -FilePath $setup.FullName -ArgumentList "/S" -Wait -PassThru
$codigo = $processo.ExitCode
Write-Host "instalador retornou $codigo"

$instalado = $null
$entrada = $null
for ($i = 0; $i -lt $Tentativas -and -not $instalado; $i++) {
    $entrada = EntradasDeDesinstalacao | Where-Object { $_.DisplayName -eq "GORE FORGE" } | Select-Object -First 1
    if ($entrada -and $entrada.InstallLocation -and (Test-Path (Join-Path $entrada.InstallLocation "GORE FORGE.exe"))) {
        $instalado = $entrada.InstallLocation
    }
    if (-not $instalado) { Start-Sleep -Seconds 1 }
}

if (-not $instalado) {
    $candidatos = @(
        (Join-Path $env:LOCALAPPDATA "Programs\GORE FORGE"),
        (Join-Path $env:LOCALAPPDATA "GORE FORGE"),
        (Join-Path $env:ProgramFiles "GORE FORGE"),
        (Join-Path ${env:ProgramFiles(x86)} "GORE FORGE")
    )
    $instalado = $candidatos | Where-Object { Test-Path (Join-Path $_ "GORE FORGE.exe") } | Select-Object -First 1
}

if (-not $instalado) {
    $nomes = (EntradasDeDesinstalacao | Select-Object -ExpandProperty DisplayName) -join " | "
    Falhar ("nao achei GORE FORGE.exe (codigo do instalador: $codigo). " +
        "Programs: $(Listar (Join-Path $env:LOCALAPPDATA 'Programs')). " +
        "Entradas de desinstalacao: $nomes")
}
Write-Host "Instalado em: $instalado"

# ------------------------------------------------------------ verificacoes
$falhas = @()
$exe = Join-Path $instalado "GORE FORGE.exe"
if (-not (Test-Path $exe)) { $falhas += "sem GORE FORGE.exe" }
foreach ($relativo in @("resources\goreforge.html", "resources\LEIA-ME.txt")) {
    if (-not (Test-Path (Join-Path $instalado $relativo))) { $falhas += "sem $relativo" }
}

$areaTrabalho = [Environment]::GetFolderPath("Desktop")
$atalho = Join-Path $areaTrabalho "GORE FORGE.lnk"
if (-not (Test-Path $atalho)) { $falhas += "sem atalho na Area de Trabalho ($atalho)" }

$menu = Join-Path ([Environment]::GetFolderPath("Programs")) "GORE FORGE.lnk"
if (-not (Test-Path $menu)) { $falhas += "sem atalho no Menu Iniciar ($menu)" }

if (-not $entrada) { $falhas += "sem entrada de desinstalacao no registro" }
else {
    Write-Host "Registro: $($entrada.DisplayName) $($entrada.DisplayVersion) -> $($entrada.UninstallString)"
    if (-not $entrada.UninstallString) { $falhas += "entrada de desinstalacao sem UninstallString" }
}

if ($falhas.Count -gt 0) {
    Falhar ("instalacao incompleta (codigo $codigo): " + ($falhas -join "; ") +
        ". Conteudo de $instalado: $(Listar $instalado)")
}

if ($GithubEnv) {
    "GOREFORGE_TEST_APP=$instalado" >> $GithubEnv
    "GOREFORGE_INSTALADO=$instalado" >> $GithubEnv
}

Write-Host "OK: instalado, atalhos, registro e recursos conferidos (codigo $codigo)"
exit 0
