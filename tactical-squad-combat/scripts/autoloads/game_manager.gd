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
	
	if is_hit:
		var dmg = breakdown.final_damage
		EventBus.combat_log_added.emit("🎯 ¡Impacto! %s dispara a %s (%d%% de acierto). Daño: %d" % [
			shooter.soldier_name, defender.soldier_name, breakdown.final_accuracy, dmg
		], "player_attack" if not shooter.is_enemy else "enemy_attack")
		
		# Sonido de disparo e impacto
		var is_shotgun = shooter.class_data.class_id == "assault"
		if is_shotgun:
			AudioManager.play_sfx("fire_shotgun")
		else:
			AudioManager.play_sfx("fire_rifle")
		
		# Pequeño delay para el sonido del impacto
		get_tree().create_timer(0.15).timeout.connect(func():
			AudioManager.play_sfx("hit")
		)
		
		defender.take_damage(dmg)
	else:
		EventBus.combat_log_added.emit("❌ ¡Fallo! %s dispara a %s (%d%% de acierto) pero erra el tiro." % [
			shooter.soldier_name, defender.soldier_name, breakdown.final_accuracy
		], "info")
		
		# Sonido de disparo (fallido)
		var is_shotgun = shooter.class_data.class_id == "assault"
		if is_shotgun:
			AudioManager.play_sfx("fire_shotgun")
		else:
			AudioManager.play_sfx("fire_rifle")
		
	# Focus camera on combat location
	var camera = get_tree().current_scene.get_node("TacticalCamera") as TacticalCamera
	if camera:
		camera.target_focus = defender.global_position
		
	EventBus.soldier_selected.emit(shooter)
	check_battle_status()

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
	if thrower.stats.ap <= 0:
		return
	thrower.stats.ap -= 1
	
	var grid_manager = get_tree().current_scene.get_node("GridManager") as GridManager
	var target_world_pos = grid_manager.get_world_position(target_pos)
	EventBus.combat_log_added.emit("💣 %s lanza una granada frag en (%d, %d)." % [thrower.soldier_name, target_pos.x, target_pos.y], "player_attack")
	
	# Focus camera on grenade location
	var camera = get_tree().current_scene.get_node("TacticalCamera") as TacticalCamera
	if camera:
		camera.target_focus = target_world_pos
		
	# Play explosion sound 3D
	AudioManager.play_sfx_3d("grenade_explosion", target_world_pos)
	
	# Splash damage in 1-cell radius (Manhattan dist <= 1)
	var targets_to_damage = []
	for soldier in all_soldiers:
		if is_instance_valid(soldier) and soldier.stats.hp > 0:
			var dist = CombatCalculator.get_distance(soldier.grid_position, target_pos)
			if dist <= 1:
				targets_to_damage.append(soldier)
				
	for target in targets_to_damage:
		target.take_damage(35)
		
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
		EventBus.combat_log_added.emit("🚨 Turno de la Inteligencia Alienígena.", "system")
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
		EventBus.combat_log_added.emit("🏆 ¡VICTORIA! Escuadrón alienígena aniquilado.", "system")
	elif players_alive == 0:
		EventBus.combat_log_added.emit("💀 ¡DERROTA! Todo tu escuadrón ha caído.", "system")
