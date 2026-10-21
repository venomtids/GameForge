-- ===========================================================================
--  VIGIA · script em Lua que roda junto do jogo (a engine aceita JavaScript
--  e Lua 5.3 no mesmo projeto). Ele não conhece as regras do hotel: só olha
--  o estado da cena (nós que existem, vida do jogador e distâncias) e cuida
--  do rádio de perigo, do alarme de vida baixa e das estatísticas da corrida.
-- ===========================================================================
local AMEACAS = { "ent.rush", "ent.ambush", "ent.seek", "ent.figure" }
local NOMES = {
  ["ent.rush"] = "RUSH", ["ent.ambush"] = "AMBUSH",
  ["ent.seek"] = "SEEK", ["ent.figure"] = "FIGURA",
}
local estado = {
  maisPerto = 999, nome = "", avisou = false, batidas = 0,
  melhor = 999, sustos = 0, ultimoAlarme = -9,
}

local function distancia(a, b)
  return engine.distance(a.x, a.y, a.z, b.x, b.y, b.z)
end

function start()
  engine.log("VIGIA (Lua 5.3) ativo: radio de perigo e estatisticas.")
end

function update(dt, time, input)
  local eu = engine.get("jogador")
  if not eu then return end
  local vivo = eu.health > 0
  local perto, nome = 999, ""
  for _, id in ipairs(AMEACAS) do
    local c = engine.get(id)
    if c then
      local d = distancia(eu, c)
      if d < perto then perto, nome = d, id end
    end
  end
  if nome ~= "" and perto < estado.melhor then estado.melhor = perto end

  -- radio: mostra a ameaca mais proxima e a distancia
  if vivo and nome ~= "" then
    local rotulo = NOMES[nome] or "ALGO"
    local nivel = perto < 8 and "COLADO" or (perto < 16 and "PERTO" or "LONGE")
    engine.ui("hud.radio", {
      text = "RADIO  " .. rotulo .. "  " .. string.format("%.0f", perto) .. " m  [" .. nivel .. "]",
      visible = true,
      color = perto < 8 and "#ff5d4a" or (perto < 16 and "#ffb066" or "#cfe0d0"),
    })
    if perto < 3.2 and time - estado.ultimoAlarme > 1.2 then
      estado.ultimoAlarme = time
      estado.sustos = estado.sustos + 1
      engine.sound("coracao", 0.8, 1.1)
      if engine.shake then engine.shake(0.35, 0.3) end
    end
  else
    engine.ui("hud.radio", { text = "", visible = false })
  end

  -- alarme de vida baixa: batimento + piscada nas luzes
  if vivo and eu.health <= 35 and time - estado.ultimoAlarme > 4 then
    estado.ultimoAlarme = time
    engine.loop("coracao", 0.55)
    engine.flicker("*", 0.5, 0.35)
  end
  if not vivo then
    engine.loop("coracao", 0)
    engine.ui("hud.radio", { text = "", visible = false })
    -- guarda as estatisticas da corrida no save deste nó (Lua tem store próprio)
    if estado.batidas == 0 then
      estado.batidas = 1
      engine.store({
        melhorDistancia = string.format("%.1f", estado.melhor),
        sustos = estado.sustos,
      })
    end
  end
  if vivo then estado.batidas = 0 end
end
