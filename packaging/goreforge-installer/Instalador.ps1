<#
    GORE FORGE - Instalador e Desinstalador (Windows 10/11 x64)
    Versao @@VERSAO@@

    Uso normal (pelo pacote):
        powershell -ExecutionPolicy Bypass -File Instalador.ps1

    Instalar em outra pasta:
        powershell -ExecutionPolicy Bypass -File Instalador.ps1 -Destino "D:\Jogos\GORE FORGE"

    Desinstalar (o instalador tambem e copiado como Desinstalar.ps1):
        powershell -ExecutionPolicy Bypass -File Desinstalar.ps1 -Desinstalar -Destino "C:\...\GORE FORGE"

    Nada de administrador: a instalacao e por usuario (%LOCALAPPDATA%) e o
    registro de desinstalacao fica em HKCU (aparece em "Aplicativos instalados").
#>
[CmdletBinding()]
param(
    [string] $Destino,
    [switch] $Desinstalar,
    [switch] $NaoAbrir
)

$ErrorActionPreference = "Stop"

# ------------------------------------------------------------------ constantes
$Versao         = "@@VERSAO@@"
$NomeApp        = "GORE FORGE"
$ArquivoJogo    = "goreforge.html"
$ArquivoIcone   = "gameforge.ico"
$ArquivoUninstall = "Desinstalar GORE FORGE.cmd"
$ArquivoUninstallPs = "Desinstalar.ps1"
$ChaveRegistro  = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GORE FORGE"
$TamanhoMinimo  = 200KB

if ($env:LOCALAPPDATA) { $PastaPadrao = Join-Path $env:LOCALAPPDATA "GORE FORGE" }
elseif ($env:USERPROFILE) { $PastaPadrao = Join-Path $env:USERPROFILE "GORE FORGE" }
else { $PastaPadrao = Join-Path $env:TEMP "GORE FORGE" }

# --------------------------------------------------------------------- apoio
function Escrever-Titulo([string] $texto) {
    Write-Host ""
    Write-Host "  $texto" -ForegroundColor Cyan
    Write-Host ("  " + ("-" * $texto.Length)) -ForegroundColor DarkCyan
}
function Escrever-Ok([string] $texto)    { Write-Host "  [ok]    $texto" -ForegroundColor Green }
function Escrever-Passo([string] $texto) { Write-Host "  [...]   $texto" -ForegroundColor Gray }
function Escrever-Aviso([string] $texto) { Write-Host "  [aviso] $texto" -ForegroundColor Yellow }
function Escrever-Erro([string] $texto)  { Write-Host "  [erro]  $texto" -ForegroundColor Red }

function Normalizar-Pasta([string] $caminho) {
    if (-not $caminho) { return "" }
    $cheio = [System.IO.Path]::GetFullPath($caminho)
    return $cheio.TrimEnd([char]92)
}

function Novo-Atalho {
    param(
        [string] $caminhoLnk,
        [string] $alvo,
        [string] $argumentos = "",
        [string] $icone = "",
        [string] $descricao = "",
        [string] $pastaTrabalho = ""
    )
    $shell  = New-Object -ComObject WScript.Shell
    $atalho = $shell.CreateShortcut($caminhoLnk)
    $atalho.TargetPath = $alvo
    if ($argumentos)    { $atalho.Arguments        = $argumentos }
    if ($icone)         { $atalho.IconLocation     = $icone }
    if ($descricao)     { $atalho.Description      = $descricao }
    if ($pastaTrabalho) { $atalho.WorkingDirectory = $pastaTrabalho }
    $atalho.Save()
}

function Remover-Caminho([string] $caminho) {
    if (Test-Path -LiteralPath $caminho) {
        try { Remove-Item -LiteralPath $caminho -Recurse -Force -ErrorAction Stop } catch { }
    }
}

function Obter-Navegador {
    $bases = @()
    if ($env:LOCALAPPDATA)         { $bases += $env:LOCALAPPDATA }
    if ($env:ProgramFiles)         { $bases += $env:ProgramFiles }
    if (${env:ProgramFiles(x86)})  { $bases += ${env:ProgramFiles(x86)} }
    $relativos = @(
        "Microsoft\Edge\Application\msedge.exe",
        "Google\Chrome\Application\chrome.exe",
        "Chromium\Application\chrome.exe"
    )
    foreach ($base in $bases) {
        foreach ($relativo in $relativos) {
            $caminho = Join-Path $base $relativo
            if (Test-Path -LiteralPath $caminho) { return $caminho }
        }
    }
    return $null
}

function Converter-ParaUrl([string] $caminho) {
    $url = "file:///" + ($caminho -replace "\\", "/")
    $url = $url -replace " ", "%20"
    return $url
}

# .NET primeiro (deterministico) e o shell como reserva, para o caso de perfis
# com pastas redirecionadas (OneDrive, dominio).
function Obter-PastaUsuario {
    param([string] $Nome)
    $tipo = [Environment+SpecialFolder]::Desktop
    if ($Nome -eq "Programs") { $tipo = [Environment+SpecialFolder]::Programs }
    $caminho = ""
    try { $caminho = [Environment]::GetFolderPath($tipo) } catch { $caminho = "" }
    if (-not $caminho) {
        try {
            $shell = New-Object -ComObject WScript.Shell
            $caminho = $shell.SpecialFolders.Item($Nome)
        } catch { $caminho = "" }
    }
    return $caminho
}

# ---------------------------------------------------------------- instalacao
function Instalar-GoreForge {
    param([string] $PastaDestino)

    $pacote       = $PSScriptRoot
    $origemJogo   = Join-Path $pacote $ArquivoJogo
    $origemIcone  = Join-Path $pacote $ArquivoIcone

    Escrever-Titulo "GORE FORGE $Versao - instalacao"

    if (-not (Test-Path -LiteralPath $origemJogo)) {
        Escrever-Erro "Nao encontrei o arquivo do jogo em: $origemJogo"
        Escrever-Erro "Extraia TODOS os arquivos do ZIP na mesma pasta antes de instalar."
        return 2
    }
    $bytesJogo = (Get-Item -LiteralPath $origemJogo).Length
    if ($bytesJogo -lt $TamanhoMinimo) {
        Escrever-Erro ("O arquivo do jogo parece incompleto ({0:N0} bytes)." -f $bytesJogo)
        Escrever-Erro "Baixe/extraia o pacote novamente."
        return 3
    }
    Escrever-Ok ("Arquivo do jogo: {0:N2} MB" -f ($bytesJogo / 1MB))

    if (-not $PastaDestino) { $PastaDestino = $PastaPadrao }
    $PastaDestino = Normalizar-Pasta $PastaDestino
    $PastaDestino = $PastaDestino.TrimEnd("\")
    if (-not $PastaDestino) {
        Escrever-Erro "Destino invalido."
        return 4
    }
    Escrever-Passo "Destino: $PastaDestino"

    if (Test-Path -LiteralPath $ChaveRegistro) { Escrever-Passo "Atualizando a instalacao anterior." }

    # 1) arquivos
    if (-not (Test-Path -LiteralPath $PastaDestino)) {
        New-Item -ItemType Directory -Path $PastaDestino -Force | Out-Null
    }
    $caminhoJogo  = Join-Path $PastaDestino $ArquivoJogo
    $caminhoIcone = Join-Path $PastaDestino $ArquivoIcone
    Copy-Item -LiteralPath $origemJogo -Destination $caminhoJogo -Force
    if (Test-Path -LiteralPath $origemIcone) {
        Copy-Item -LiteralPath $origemIcone -Destination $caminhoIcone -Force
    } else {
        $caminhoIcone = ""
    }
    Escrever-Ok "Jogo copiado para a pasta de instalacao."

    # 2) desinstalador (fica junto do jogo: comandos em ASCII de proposito)
    $caminhoUninstall = Join-Path $PastaDestino $ArquivoUninstall
    $linhas = @(
        "@echo off",
        "rem Desinstalador do $NomeApp $Versao",
        "chcp 65001 >nul 2>&1",
        "title Desinstalar $NomeApp",
        'set "PASTA=%~dp0"',
        'copy /y "%~dp0' + $ArquivoUninstallPs + '" "%TEMP%\goreforge-desinstalar.ps1" >nul 2>&1',
        'powershell -NoProfile -ExecutionPolicy Bypass -NoLogo -File "%TEMP%\goreforge-desinstalar.ps1" -Desinstalar -Destino "%PASTA%."',
        "exit /b %ERRORLEVEL%"
    )
    Set-Content -LiteralPath $caminhoUninstall -Value $linhas -Encoding ASCII
    Copy-Item -LiteralPath (Join-Path $pacote "Instalador.ps1") -Destination (Join-Path $PastaDestino $ArquivoUninstallPs) -Force
    Escrever-Ok "Desinstalador criado (atalho no Menu Iniciar e em Aplicativos instalados)."

    # 3) leia-me dentro da pasta instalada
    $aviso = @(
        "$NomeApp $Versao",
        "Instalado em: $PastaDestino",
        "",
        "Abra pelo atalho 'GORE FORGE' na Area de Trabalho ou no Menu Iniciar.",
        "O jogo roda offline, direto no navegador (arquivo $ArquivoJogo).",
        "Para remover: Menu Iniciar > GORE FORGE > Desinstalar GORE FORGE,",
        "ou Configuracoes > Aplicativos instalados > $NomeApp."
    )
    Set-Content -LiteralPath (Join-Path $PastaDestino "LEIA-ME.txt") -Value $aviso -Encoding ASCII

    # 4) atalhos
    $areaTrabalho = Obter-PastaUsuario -Nome "Desktop"
    $menuIniciar  = Obter-PastaUsuario -Nome "Programs"
    $navegador    = Obter-Navegador

    if ($navegador) {
        $alvoPrincipal = $navegador
        $argsPrincipal = '--app="' + (Converter-ParaUrl $caminhoJogo) + '" --window-size=1280,800'
        $nomeNavegador = Split-Path -Leaf $navegador
        Escrever-Ok "Atalho em modo janela de aplicativo ($nomeNavegador)."
    } else {
        $alvoPrincipal = $caminhoJogo
        $argsPrincipal = ""
        Escrever-Aviso "Nenhum Edge/Chrome encontrado: o atalho abrira o navegador padrao."
    }

    if ($areaTrabalho) {
        Novo-Atalho -caminhoLnk (Join-Path $areaTrabalho "GORE FORGE.lnk") -alvo $alvoPrincipal -argumentos $argsPrincipal -icone $caminhoIcone -descricao "$NomeApp - sandbox de fisica e gore" -pastaTrabalho $PastaDestino
    }
    if ($menuIniciar) {
        $pastaMenu = Join-Path $menuIniciar $NomeApp
        if (-not (Test-Path -LiteralPath $pastaMenu)) { New-Item -ItemType Directory -Path $pastaMenu -Force | Out-Null }
        Novo-Atalho -caminhoLnk (Join-Path $pastaMenu "$NomeApp.lnk") -alvo $alvoPrincipal -argumentos $argsPrincipal -icone $caminhoIcone -descricao "$NomeApp - sandbox de fisica e gore" -pastaTrabalho $PastaDestino
        Novo-Atalho -caminhoLnk (Join-Path $pastaMenu "Abrir no navegador.lnk") -alvo $caminhoJogo -icone $caminhoIcone -descricao "$NomeApp no navegador padrao" -pastaTrabalho $PastaDestino
        Novo-Atalho -caminhoLnk (Join-Path $pastaMenu "Pasta de instalacao.lnk") -alvo $PastaDestino -icone $caminhoIcone -descricao "Onde o $NomeApp foi instalado"
        Novo-Atalho -caminhoLnk (Join-Path $pastaMenu "Desinstalar $NomeApp.lnk") -alvo $caminhoUninstall -icone $caminhoIcone -descricao "Remover o $NomeApp"
    }
    Escrever-Ok "Atalhos criados (Area de Trabalho e Menu Iniciar)."

    # 5) registro de desinstalacao (HKCU -> nao precisa de administrador)
    if (-not (Test-Path $ChaveRegistro)) { New-Item -Path $ChaveRegistro -Force | Out-Null }
    $totalKb = [int](($bytesJogo / 1KB) + 8)
    Set-ItemProperty -Path $ChaveRegistro -Name "DisplayName"     -Value $NomeApp
    Set-ItemProperty -Path $ChaveRegistro -Name "DisplayVersion"  -Value $Versao
    Set-ItemProperty -Path $ChaveRegistro -Name "Publisher"       -Value "GameForge Studio"
    Set-ItemProperty -Path $ChaveRegistro -Name "InstallLocation" -Value $PastaDestino
    Set-ItemProperty -Path $ChaveRegistro -Name "InstallDate"     -Value (Get-Date -Format "yyyyMMdd")
    New-ItemProperty -Path $ChaveRegistro -Name "NoModify"      -PropertyType DWord -Value 1 -Force | Out-Null
    New-ItemProperty -Path $ChaveRegistro -Name "NoRepair"      -PropertyType DWord -Value 1 -Force | Out-Null
    New-ItemProperty -Path $ChaveRegistro -Name "EstimatedSize" -PropertyType DWord -Value $totalKb -Force | Out-Null
    if ($caminhoIcone) { Set-ItemProperty -Path $ChaveRegistro -Name "DisplayIcon" -Value $caminhoIcone }
    Set-ItemProperty -Path $ChaveRegistro -Name "UninstallString" -Value ('cmd.exe /c ""' + $caminhoUninstall + '""')
    Set-ItemProperty -Path $ChaveRegistro -Name "QuietUninstallString" -Value ('cmd.exe /c ""' + $caminhoUninstall + '""')
    Escrever-Ok "Registrado em 'Aplicativos instalados' (painel de controle do Windows)."

    Escrever-Titulo "Instalacao concluida"
    Write-Host "  Pasta .....: $PastaDestino"
    Write-Host "  Atalhos ...: Area de Trabalho e Menu Iniciar > $NomeApp"
    Write-Host "  Desinstalar: Menu Iniciar > $NomeApp > Desinstalar $NomeApp"
    Write-Host "  Extra ......: o jogo tambem abre com dois cliques em $ArquivoJogo"
    Write-Host ""

    if (-not $NaoAbrir) {
        Escrever-Passo "Abrindo o jogo..."
        try {
            if ($argsPrincipal) { Start-Process -FilePath $alvoPrincipal -ArgumentList $argsPrincipal }
            else                { Start-Process -FilePath $caminhoJogo }
        } catch {
            Escrever-Aviso "Nao consegui abrir automaticamente. Use o atalho 'GORE FORGE'."
        }
    }
    return 0
}

# -------------------------------------------------------------- desinstalacao
function Desinstalar-GoreForge {
    param([string] $PastaDestino)

    Escrever-Titulo "GORE FORGE - desinstalacao"

    if (-not $PastaDestino) { $PastaDestino = $PastaPadrao }
    $PastaDestino = (Normalizar-Pasta $PastaDestino).TrimEnd("\")
    Escrever-Passo "Pasta: $PastaDestino"

    # 1) atalhos
    $areaTrabalho = Obter-PastaUsuario -Nome "Desktop"
    $menuIniciar  = Obter-PastaUsuario -Nome "Programs"
    if ($areaTrabalho) { Remover-Caminho (Join-Path $areaTrabalho "GORE FORGE.lnk") }
    if ($menuIniciar)  { Remover-Caminho (Join-Path $menuIniciar "GORE FORGE") }
    Escrever-Ok "Atalhos removidos."

    # 2) registro
    if (Test-Path -LiteralPath $ChaveRegistro) {
        Remove-Item -LiteralPath $ChaveRegistro -Recurse -Force
        Escrever-Ok "Registro de desinstalacao removido."
    }

    # 3) arquivos (tudo menos este .cmd, que ainda esta em execucao)
    $bloqueados = 0
    if (Test-Path -LiteralPath $PastaDestino) {
        $itens = Get-ChildItem -LiteralPath $PastaDestino -Force -ErrorAction SilentlyContinue
        foreach ($item in $itens) {
            if ($item.Name -eq $ArquivoUninstall) { continue }
            try { Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop }
            catch { $bloqueados++ }
        }
    }
    if ($bloqueados -gt 0) {
        Escrever-Aviso "Alguns arquivos estavam em uso (jogo aberto no navegador?)."
    }
    Escrever-Ok "Arquivos do jogo removidos."

    # 4) a pasta (com algumas tentativas) ou uma limpeza agendada
    $removida = $false
    for ($tentativa = 1; $tentativa -le 6; $tentativa++) {
        try {
            if (Test-Path -LiteralPath $PastaDestino) {
                Remove-Item -LiteralPath $PastaDestino -Recurse -Force -ErrorAction Stop
            }
            $removida = $true
            break
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    if ($removida) {
        Escrever-Ok "Pasta de instalacao apagada."
    } else {
        Escrever-Aviso "A pasta sera apagada em alguns segundos (janela minimizada)."
        $limpeza = Join-Path $env:TEMP "goreforge-limpar.cmd"
        $linhas = @(
            "@echo off",
            "ping -n 5 127.0.0.1 >nul",
            'rmdir /s /q "' + $PastaDestino + '"',
            'del /f /q "%~f0"'
        )
        Set-Content -LiteralPath $limpeza -Value $linhas -Encoding ASCII
        Start-Process -FilePath $limpeza -WindowStyle Minimized
    }

    Escrever-Titulo "Desinstalacao concluida"
    Write-Host "  O $NomeApp foi removido deste usuario."
    Write-Host ""
    return 0
}

# ------------------------------------------------------------------ execucao
$codigo = 0
try {
    if ($Desinstalar) {
        $codigo = Desinstalar-GoreForge -PastaDestino $Destino
    } else {
        $codigo = Instalar-GoreForge -PastaDestino $Destino
    }
} catch {
    Escrever-Erro "Falha inesperada: $($_.Exception.Message)"
    $codigo = 1
}

if ($Desinstalar) {
    # some com a copia temporaria usada pelo desinstalador
    try { Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue } catch { }
}

exit $codigo
