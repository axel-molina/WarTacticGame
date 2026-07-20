extends Node

var turn_owner: String = "player"
var active_soldier: SoldierController = null
var selected_action: String = ""
var all_soldiers: Array = []
var grid_size: int = 12

signal turn_changed(new_owner: String)

func _ready() -> void:
	EventBus.soldier_selected.connect(_on_soldier_selected)
	EventBus.cell_clicked.connect(_on_cell_clicked)

func _on_soldier_selected(soldier) -> void:
	if turn_owner == "player" and soldier != null and not soldier.is_enemy:
		active_soldier = soldier
		print("GameManager: Active player soldier selected: ", soldier.soldier_name)
	elif soldier == null:
		active_soldier = null
		print("GameManager: Selection cleared")

func _on_cell_clicked(grid_pos: Vector2i) -> void:
	if active_soldier and selected_action == "move":
		# Check if cell is reachable
		var grid_manager = get_tree().current_scene.get_node("GridManager") as GridManager
		var reachable = grid_manager.get_reachable_cells(active_soldier)
		if reachable.has(grid_pos):
			execute_move(active_soldier, grid_pos)
			selected_action = ""
			grid_manager.clear_highlights()
		else:
			EventBus.combat_log_added.emit("Celda fuera de alcance.", "info")

# --- ACTION EXECUTIONS ---

func execute_move(soldier: SoldierController, target_pos: Vector2i) -> void:
	if soldier.stats.ap <= 0:
		EventBus.combat_log_added.emit("Sin puntos de acción.", "info")
		return
		
	soldier.stats.ap -= 1
	soldier.grid_position = target_pos
	
	var grid_manager = get_tree().current_scene.get_node("GridManager") as GridManager
	var target_world_pos = grid_manager.get_world_position(target_pos)
	
	var tween = create_tween()
	tween.tween_property(soldier, "global_position", target_world_pos, 0.3)
	
	EventBus.combat_log_added.emit("%s se mueve a (%d, %d)" % [soldier.soldier_name, target_pos.x, target_pos.y], "info")
	
	# Refresh UI/Selection
	EventBus.soldier_selected.emit(soldier)

func execute_shoot(shooter: SoldierController, defender: SoldierController) -> void:
	if shooter.stats.ap <= 0:
		EventBus.combat_log_added.emit("Sin puntos de acción.", "info")
		return
	if shooter.stats.ammo <= 0:
		EventBus.combat_log_added.emit("Necesita recargar.", "info")
		return
		
	shooter.stats.ap -= 1
	
	var grid_manager = get_tree().current_scene.get_node("GridManager") as GridManager
	var breakdown = CombatCalculator.calculate_shot(shooter, defender, grid_manager)
	
	var roll = randf_range(0.0, 100.0)
	var is_hit = (roll <= breakdown.final_accuracy)
	
	# Consumes ammo: Assault fires 3, others fire 1
	var ammo_consumed = 3 if shooter.class_data.class_id == "assault" else 1
	shooter.stats.ammo = max(0, shooter.stats.ammo - ammo_consumed)
	
	# Focus camera on combat location
	var camera = get_tree().current_scene.get_node("TacticalCamera") as TacticalCamera
	if camera:
		camera.target_focus = defender.global_position

	# 1. Reproducir sonido de disparo
	var is_shotgun = shooter.class_data.class_id == "assault"
	if is_shotgun:
		AudioManager.play_sfx("fire_shotgun")
	else:
		AudioManager.play_sfx("fire_rifle")
		
	# 2. Instanciar Proyectil 3D (Bala luminosa)
	var start_pos = shooter.global_position + Vector3(0, 1.2, 0)
	# Si es impacto, apunta al pecho del defensor. Si falla, desviar la trayectoria.
	var end_pos = defender.global_position + Vector3(0, 1.2, 0)
	if not is_hit:
		# Desvío aleatorio
		end_pos += Vector3(randf_range(-1.5, 1.5), randf_range(-0.5, 1.0), randf_range(-1.5, 1.5))
	
	var projectile = MeshInstance3D.new()
	var sphere = SphereMesh.new()
	sphere.radius = 0.08
	sphere.height = 0.16
	projectile.mesh = sphere
	
	var material = StandardMaterial3D.new()
	material.shading_mode = StandardMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(1.0, 0.8, 0.1) # Amarillo brillante
	projectile.material_override = material
	
	get_tree().current_scene.add_child(projectile)
	projectile.global_position = start_pos
	
	# Mover el proyectil con Tween
	var travel_duration = 0.2
	var tween = create_tween()
	tween.tween_property(projectile, "global_position", end_pos, travel_duration)
	
	# 3. Aplicar efectos al llegar al destino
	tween.tween_callback(func():
		projectile.queue_free()
		if is_hit:
			var dmg = breakdown.final_damage
			EventBus.combat_log_added.emit("🎯 ¡Impacto! %s dispara a %s (%d%% de acierto). Daño: %d" % [
				shooter.soldier_name, defender.soldier_name, breakdown.final_accuracy, dmg
			], "player_attack" if not shooter.is_enemy else "enemy_attack")
			
			# Registrar estadistica para MVP
			shooter.damage_dealt_count += dmg
			
			AudioManager.play_sfx("hit")
			
			# Si el golpe lo mata, sumamos baja al tirador
			var will_die = (defender.stats.hp - (dmg - min(defender.stats.shield, dmg))) <= 0
			if will_die:
				shooter.kills_count += 1
				
			defender.take_damage(dmg)
			check_battle_status()
		else:
			EventBus.combat_log_added.emit("❌ ¡Fallo! %s dispara a %s (%d%% de acierto) pero erra el tiro." % [
				shooter.soldier_name, defender.soldier_name, breakdown.final_accuracy
			], "info")
			defender.show_floating_text("¡FALLÓ!", Color(0.7, 0.7, 0.7))
	)
		
	EventBus.soldier_selected.emit(shooter)

func execute_reload(soldier: SoldierController) -> void:
	if soldier.stats.ap <= 0:
		return
	soldier.stats.ap -= 1
	soldier.stats.ammo = soldier.stats.max_ammo
	
	# Sonido de recarga
	var is_shotgun = soldier.class_data.class_id == "assault"
	if is_shotgun:
		AudioManager.play_sfx("reload_shotgun")
	else:
		AudioManager.play_sfx("reload_rifle")
		
	EventBus.combat_log_added.emit("🔄 %s recarga su arma." % [soldier.soldier_name], "info")
	EventBus.soldier_selected.emit(soldier)

func execute_heal(medic: SoldierController, target: SoldierController) -> void:
	if medic.stats.ap <= 0:
		return
	medic.stats.ap -= 1
	target.stats.hp = min(target.stats.max_hp, target.stats.hp + 45)
	EventBus.combat_log_added.emit("💉 %s aplica medicina a %s (+45 HP)." % [medic.soldier_name, target.soldier_name], "heal")
	EventBus.soldier_selected.emit(medic)

func execute_grenade(thrower: SoldierController, target_pos: Vector2i) -> void:
	if thrower.stats.ap < 2:
		return
	thrower.stats.ap -= 2
	
	var grid_manager = get_tree().current_scene.get_node("GridManager") as GridManager
	var target_world_pos = grid_manager.get_world_position(target_pos)
	EventBus.combat_log_added.emit("💣 %s lanza una granada frag en (%d, %d)." % [thrower.soldier_name, target_pos.x, target_pos.y], "player_attack")
	
	# Focus camera on grenade location
	var camera = get_tree().current_scene.get_node("TacticalCamera") as TacticalCamera
	if camera:
		camera.target_focus = target_world_pos
		
	# Play explosion sound 3D
	AudioManager.play_sfx_3d("grenade_explosion", target_world_pos)
	
	# --- VFX de Explosión de Granada (CPUParticles3D) ---
	var particles = CPUParticles3D.new()
	particles.emitting = false
	particles.one_shot = true
	particles.amount = 40
	particles.lifetime = 0.6
	particles.explosiveness = 1.0
	particles.direction = Vector3(0, 1, 0)
	particles.spread = 180.0
	particles.gravity = Vector3(0, -5, 0)
	particles.initial_velocity_min = 4.0
	particles.initial_velocity_max = 8.0
	
	# Malla para cada partícula (pequeñas esferas)
	var sphere = SphereMesh.new()
	sphere.radius = 0.15
	sphere.height = 0.3
	particles.mesh = sphere
	
	# Material de partícula emisor de calor
	var material = StandardMaterial3D.new()
	material.shading_mode = StandardMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color(1.0, 0.4, 0.1) # Naranja fuego
	particles.material_override = material
	
	get_tree().current_scene.add_child(particles)
	particles.global_position = target_world_pos
	particles.emitting = true
	
	# Autodestrucción del emisor tras la animación
	get_tree().create_timer(1.0).timeout.connect(particles.queue_free)
	
	# Splash damage in 1-cell radius (Manhattan dist <= 1)
	var targets_to_damage = []
	var distances = {}
	for soldier in all_soldiers:
		if is_instance_valid(soldier) and soldier.stats.hp > 0:
			var dist = CombatCalculator.get_distance(soldier.grid_position, target_pos)
			if dist <= 1:
				targets_to_damage.append(soldier)
				distances[soldier] = dist
				
	for target in targets_to_damage:
		var dist = distances[target]
		var dmg = 50 if dist == 0 else 25
		
		# Registrar estadisticas de MVP
		thrower.damage_dealt_count += dmg
		var will_die = (target.stats.hp - (dmg - min(target.stats.shield, dmg))) <= 0
		if will_die:
			thrower.kills_count += 1
			
		target.take_damage(dmg)
		
	# Destroy cover at target and adjacent cells
	for dx in range(-1, 2):
		for dy in range(-1, 2):
			var check_pos = target_pos + Vector2i(dx, dy)
			grid_manager.destroy_cover_at(check_pos)
			
	EventBus.soldier_selected.emit(thrower)
	check_battle_status()

# --- TURN SYSTEM ---

func end_turn() -> void:
	if turn_owner == "player":
		# Hunker down player units with remaining AP
		for soldier in all_soldiers:
			if is_instance_valid(soldier) and not soldier.is_enemy and soldier.stats.hp > 0:
				if soldier.stats.ap > 0:
					soldier.is_defending = true
					EventBus.combat_log_added.emit("🛡️ %s se trinchera (Hunker Down)." % [soldier.soldier_name], "info")
		
		turn_owner = "enemy"
		EventBus.combat_log_added.emit("🚨 Turno de los Enemigos.", "system")
		turn_changed.emit(turn_owner)
		EventBus.turn_changed.emit(turn_owner)
		
		# AI Action phase (simple direct sequential execution placeholder for Hito 2)
		get_tree().create_timer(1.0).timeout.connect(execute_enemy_turns)
	else:
		# Reset units AP for player
		for soldier in all_soldiers:
			if is_instance_valid(soldier) and soldier.stats.hp > 0:
				soldier.stats.ap = soldier.stats.max_ap
				soldier.is_defending = false
				
		turn_owner = "player"
		EventBus.combat_log_added.emit("📋 Turno de la Resistencia.", "system")
		turn_changed.emit(turn_owner)
		EventBus.turn_changed.emit(turn_owner)
		
		# Select first player unit
		for soldier in all_soldiers:
			if is_instance_valid(soldier) and not soldier.is_enemy and soldier.stats.hp > 0:
				EventBus.soldier_selected.emit(soldier)
				break

func execute_enemy_turns() -> void:
	var grid_manager = get_tree().current_scene.get_node("GridManager") as GridManager
	# Execute tactical AI for each alive enemy
	for enemy in all_soldiers:
		if is_instance_valid(enemy) and enemy.is_enemy and enemy.stats.hp > 0:
			enemy.stats.ap = enemy.stats.max_ap # Reset enemy AP at start of their action phase
			await EnemyAIController.execute_enemy_action(enemy, grid_manager)
			
	# Return turn to player
	end_turn()

func check_battle_status() -> void:
	var players_alive = 0
	var enemies_alive = 0
	for soldier in all_soldiers:
		if is_instance_valid(soldier) and soldier.stats.hp > 0:
			if soldier.is_enemy:
				enemies_alive += 1
			else:
				players_alive += 1
				
	if enemies_alive == 0:
		EventBus.combat_log_added.emit("🏆 ¡VICTORIA! Escuadrón enemigo eliminado.", "system")
		
		# 1. Detener musica y reproducir sonido de victoria
		AudioManager.stop_music()
		AudioManager.play_music("victory_sound")
		
		# 2. Calcular Soldado MVP de la escuadra
		var mvp_soldier: SoldierController = null
		var best_kills = -1
		var best_dmg = -1
		
		for soldier in all_soldiers:
			if is_instance_valid(soldier) and not soldier.is_enemy:
				# Prioridad a bajas, luego desempatar por daño
				if soldier.kills_count > best_kills:
					best_kills = soldier.kills_count
					best_dmg = soldier.damage_dealt_count
					mvp_soldier = soldier
				elif soldier.kills_count == best_kills:
					if soldier.damage_dealt_count > best_dmg:
						best_dmg = soldier.damage_dealt_count
						mvp_soldier = soldier
						
		var mvp_name = "Nadie"
		var mvp_kills = 0
		var mvp_dmg = 0
		if mvp_soldier:
			mvp_name = mvp_soldier.soldier_name
			mvp_kills = mvp_soldier.kills_count
			mvp_dmg = mvp_soldier.damage_dealt_count
			
		var stats_dict = {
			"mvp_kills": mvp_kills,
			"mvp_dmg": mvp_dmg
		}
		
		# 3. Emitir evento de victoria táctica tras un breve retraso para la visualizacion
		get_tree().create_timer(1.2).timeout.connect(func():
			EventBus.mission_victory.emit(mvp_name, stats_dict)
		)
		
	elif players_alive == 0:
		EventBus.combat_log_added.emit("💀 ¡DERROTA! Todo tu escuadrón ha caído.", "system")
