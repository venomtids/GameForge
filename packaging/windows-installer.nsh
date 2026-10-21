; Do not depend on PowerShell/tasklist or force-kill applications during install.
; A fresh installation has no executable in its target directory to lock.
!macro customCheckAppRunning
  ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    nsProcess::_FindProcess "${APP_EXECUTABLE_FILENAME}"
    Pop $R0
    ${If} $R0 == 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "Feche o GameForge Studio antes de instalar, atualizar ou desinstalar. Depois, execute este assistente novamente." /SD IDOK
      SetErrorLevel 2
      Quit
    ${EndIf}
  ${EndIf}
!macroend
