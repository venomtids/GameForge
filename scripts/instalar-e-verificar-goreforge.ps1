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
    Write-Host ("::error title=" + $titulo + "::" + $limpo)
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
    # varre as tres raizes possiveis: o instalador assistido do electron-builder grava
    # a chave no contexto do shell (HKCU na instalacao por usuario) e o nome de
    # DisplayName vem do productName.
    $chaves = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    )
    foreach ($chave in $chaves) {
        foreach ($filho in (Get-ChildItem $chave -ErrorAction SilentlyContinue)) {
            $propriedades = Get-ItemProperty $filho.PSPath -ErrorAction SilentlyContinue
            [pscustomobject]@{
                Chave           = $chave
                NomeChave       = $filho.PSChildName
                DisplayName     = if ($propriedades) { $propriedades.DisplayName } else { $null }
                DisplayVersion  = if ($propriedades) { $propriedades.DisplayVersion } else { $null }
                InstallLocation = if ($propriedades) { $propriedades.InstallLocation } else { $null }
                UninstallString = if ($propriedades) { $propriedades.UninstallString } else { $null }
            }
        }
    }
}

function ProcurarEntradaGoreForge {
    EntradasDeDesinstalacao | Where-Object { $_.DisplayName -like "GORE FORGE*" } | Select-Object -First 1
}

function ResumoDoRegistro {
    $todas = @(EntradasDeDesinstalacao | Where-Object { $_.DisplayName })
    if (-not $todas.Count) { return "(nenhuma entrada de desinstalacao na maquina)" }
    return (($todas | Select-Object -First 30 | ForEach-Object { "$($_.Chave.Split(':')[0])\$($_.NomeChave)=$($_.DisplayName)" }) -join " | ")
}

# ------------------------------------------------------------------- execucao
# Tudo roda dentro de try/catch: qualquer excecao (inclusive Start-Process recusando
# o instalador) vira anotacao com a mensagem real, em vez de um "exit code 1" mudo.
try {

# ------------------------------------------------------------------ o pacote
Write-Host "[1/5] Procurando o Setup.exe em $Pacote"
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
$antes = @(EntradasDeDesinstalacao | Where-Object { $_.DisplayName -like "GORE FORGE*" })
if ($antes.Count -gt 0) { Write-Host "Aviso: ja existia instalacao anterior (sera atualizada)" }
Write-Host "Entradas GORE FORGE antes: $($antes.Count)"

# ---------------------------------------------------------------- instalacao
Write-Host "[2/5] Instalando em silencio (/S) ..."
$processo = Start-Process -FilePath $setup.FullName -ArgumentList "/S" -Wait -PassThru
$codigo = $processo.ExitCode
Write-Host "instalador retornou $codigo"

Write-Host "[3/5] Procurando a pasta instalada"
$instalado = $null
$entrada = $null
for ($i = 0; $i -lt $Tentativas -and -not $instalado; $i++) {
    $entrada = ProcurarEntradaGoreForge
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
    $nomes = ResumoDoRegistro
    Falhar ("nao achei GORE FORGE.exe (codigo do instalador: $codigo). " +
        "Programs: $(Listar (Join-Path $env:LOCALAPPDATA 'Programs')). " +
        "Entradas de desinstalacao: $nomes")
}
Write-Host "Instalado em: $instalado"

# ------------------------------------------------- [4/5] verificacoes
$falhas = @()
$exe = Join-Path $instalado "GORE FORGE.exe"
if (-not (Test-Path $exe)) { $falhas += "sem GORE FORGE.exe" }
foreach ($relativo in @("resources\goreforge.html", "resources\LEIA-ME.txt")) {
    if (-not (Test-Path (Join-Path $instalado $relativo))) { $falhas += "sem $relativo" }
}

$areaTrabalho = [Environment]::GetFolderPath("Desktop")
$atalho = Join-Path $areaTrabalho "GORE FORGE.lnk"
if (-not (Test-Path $atalho)) { $falhas += "sem atalho na Area de Trabalho ($atalho)" }

# o instalador assistido (oneClick: false) cria uma pasta no Menu Iniciar com o
# atalho dentro; procuramos em qualquer nivel abaixo de Programas
$programas = [Environment]::GetFolderPath("Programs")
$menu = Get-ChildItem $programas -Recurse -Filter "GORE FORGE*.lnk" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $menu) { $falhas += "sem atalho no Menu Iniciar (procurei em $programas)" }
else { Write-Host "Atalho no Menu Iniciar: $($menu.FullName)" }

if (-not $entrada) { $falhas += "sem entrada de desinstalacao (registro: $(ResumoDoRegistro))" }
else {
    Write-Host "Registro: $($entrada.DisplayName) $($entrada.DisplayVersion) -> $($entrada.UninstallString)"
    if (-not $entrada.UninstallString) { $falhas += "entrada de desinstalacao sem UninstallString" }
}

if ($falhas.Count -gt 0) {
    Falhar ("instalacao incompleta (codigo $codigo): " + ($falhas -join "; ") +
        ". Conteudo de ${instalado}: $(Listar $instalado)")
}

Write-Host "[5/5] Exportando o caminho para os proximos passos"
if ($GithubEnv) {
    # o teste do Electron abre o app pelo EXECUTAVEL: a pasta instalada sozinha nao
    # e carregavel (nao tem package.json na raiz; o jogo vive em resources\app.asar)
    "GOREFORGE_TEST_APP=$instalado" >> $GithubEnv
    "GOREFORGE_INSTALADO=$instalado" >> $GithubEnv
    "GOREFORGE_TEST_EXE=$exe" >> $GithubEnv
}

Write-Host "OK: instalado, atalhos, registro e recursos conferidos (codigo $codigo)"
exit 0

}
catch {
    Anotar "Instalador GORE FORGE (excecao)" ("$($_.Exception.GetType().Name): $($_.Exception.Message) | linha: $($_.InvocationInfo.ScriptLineNumber)")
    if ($_.ScriptStackTrace) { Anotar "Instalador GORE FORGE (pilha)" $_.ScriptStackTrace }
    exit 1
}
