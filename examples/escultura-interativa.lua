-- Estado customizado em self persiste durante a execução.
function start()
  self.baseY = self.y
  self.alternate = false
  engine.log("Ateliê: WASD, Shift, Espaço; E muda a cor da escultura.")
end

function update(dt, time, input)
  self.ry = self.ry + 50 * dt
  self.y = self.baseY + math.sin(time * 2) * 0.25
  if input.pressed.e then
    self.alternate = not self.alternate
    self.color = self.alternate and "#edac80" or "#79d8bf"
    engine.log("Cor alterada!")
  end
end
