extends Node
class_name EnemyAIController

const GRENADE_CLASSES = ["enemy_ranger", "enemy_heavy"]
const GRENADE_RANGE = 5

# Evaluates and executes the optimal action for an enemy soldier
static func execute_enemy_action(enemy: SoldierController, grid: GridManager) -> void:
	if not is_instance_valid(enemy) or enemy.stats.hp <= 0 or enemy.stats.ap <= 0:
		return
		
	# Ensure grenade cooldown is initialized
	if not enemy.stats.cooldowns.has("grenade"):
		enemy.stats.cooldowns["grenade"] = 0
	
	# Loop until AP is fully consumed (safeguard limits loop to max_ap + 1 iterations)
	var max_iterations = enemy.stats.max_ap + 1
	var iterations = 0
	
	while enemy.stats.ap > 0 and iterations < max_iterations:
		iterations += 1
		
		# 1. Reload if empty
		if enemy.stats.ammo <= 0:
			GameManager.execute_reload(enemy)
			await enemy.get_tree().create_timer(1.0).timeout
			continue
			
		# Get alive player targets
		var players = GameManager.all_soldiers.filter(func(s): return is_instance_valid(s) and not s.is_enemy and s.stats.hp > 0)
		if players.is_empty():
			enemy.stats.ap = 0 # No active targets, end turn
			return
			
		# 2. Evaluate Frag Grenade (if class has capability and players are bunched together)
		var c_id = enemy.class_data.class_id
		if c_id in GRENADE_CLASSES and enemy.stats.cooldowns["grenade"] <= 0 and enemy.stats.ap >= 1:
			var best_grenade_target = evaluate_grenade_target(enemy, players, grid)
			if best_grenade_target != null:
				GameManager.execute_grenade(enemy, best_grenade_target)
				enemy.stats.cooldowns["grenade"] = 3 # 3 turns cooldown
				await enemy.get_tree().create_timer(1.2).timeout
				continue
		
		# 3. Select optimal target based on health, proximity, and cover state
		var optimal_target = select_optimal_target(enemy, players, grid)
		if optimal_target == null:
			# Safeguard: if target selection failed
			enemy.stats.ap = 0
			return
			
		# 4. If has 2 AP, evaluate movement to optimal cell
		if enemy.stats.ap >= 2:
			var reachable = grid.get_reachable_cells(enemy)
			if not reachable.is_empty():
				var best_cell = enemy.grid_position
				var best_score = score_cell(enemy.grid_position, enemy, optimal_target, grid)
				
				for cell_pos in reachable:
					var score = score_cell(cell_pos, enemy, optimal_target, grid)
					# Must be a significant improvement to justify moving
					if score > best_score + 10.0:
						best_score = score
						best_cell = cell_pos
						
				if best_cell != enemy.grid_position:
					GameManager.execute_move(enemy, best_cell)
					await enemy.get_tree().create_timer(0.8).timeout
					continue
					
		# 5. Shoot target if has AP and ammo
		if enemy.stats.ap > 0 and enemy.stats.ammo > 0:
			# Check range
			var class_max_range = 8
			if c_id == "enemy_ranger":
				class_max_range = 3 # Ranger prefers close combat
			elif c_id == "enemy_heavy":
				class_max_range = 8
			
			var dist = CombatCalculator.get_distance(enemy.grid_position, optimal_target.grid_position)
			if dist <= class_max_range:
				GameManager.execute_shoot(enemy, optimal_target)
				await enemy.get_tree().create_timer(1.0).timeout
				continue
			else:
				# If target out of range and has remaining AP, Hunker Down / Defend
				hunker_down(enemy)
				return
				
		# Safeguard to avoid infinite loops if no action was executed but AP remains
		enemy.stats.ap = 0
		break

# Evaluates all potential grenade target positions within range
static func evaluate_grenade_target(enemy: SoldierController, _players: Array, _grid: GridManager) -> Variant:
	var best_pos = null
	var best_score = -9999
	
	# Evaluate all cells in range of the enemy
	for x in range(GameManager.grid_size):
		for y in range(GameManager.grid_size):
			var target_cell_pos = Vector2i(x, y)
			var dist_to_cell = CombatCalculator.get_distance(enemy.grid_position, target_cell_pos)
			if dist_to_cell > GRENADE_RANGE:
				continue
				
			# Count targets caught in 1-cell radius splash (Manhattan distance <= 1)
			var players_hit = 0
			var enemies_hit = 0
			
			for soldier in GameManager.all_soldiers:
				if is_instance_valid(soldier) and soldier.stats.hp > 0:
					var d = CombatCalculator.get_distance(soldier.grid_position, target_cell_pos)
					if d <= 1:
						if soldier.is_enemy:
							enemies_hit += 1
						else:
							players_hit += 1
							
			# We want to hit at least 2 players (bunched together) and avoid friendly fire
			if players_hit >= 2 and enemies_hit < players_hit:
				var score = players_hit * 10 - enemies_hit * 15
				if score > best_score:
					best_score = score
					best_pos = target_cell_pos
					
	return best_pos

# Selects optimal player target based on health, proximity, and cover state
static func select_optimal_target(enemy: SoldierController, players: Array, grid: GridManager) -> SoldierController:
	var best_target = null
	var best_score = -9999.0
	
	for p in players:
		var score = 100.0
		var dist = CombatCalculator.get_distance(enemy.grid_position, p.grid_position)
		
		# Proximity factor
		score += (15.0 - dist) * 2.0
		
		# Low health priority (easy kills)
		score += (p.stats.max_hp - p.stats.hp) * 1.5
		if p.stats.shield <= 0:
			score += 20.0 # Shield is down, high damage potential
			
		# Cover state check
		var cover_check = CombatCalculator.is_cover_active(enemy.grid_position, p.grid_position, grid)
		if not cover_check.active:
			score += 50.0 # Flanked / exposed target is high priority!
			
		if score > best_score:
			best_score = score
			best_target = p
			
	return best_target

# Score a potential movement cell for the enemy AI
static func score_cell(cell_pos: Vector2i, enemy: SoldierController, target: SoldierController, grid: GridManager) -> float:
	var score = 0.0
	
	# Cover and elevation score
	var cell_node = grid.get_cell(cell_pos)
	if cell_node and cell_node.cell_data:
		var c_type = cell_node.cell_data.cover_type
		if c_type == "full":
			score += 50.0
		elif c_type == "half":
			score += 25.0
			
		if cell_node.cell_data.elevation > 0:
			score += 20.0
		
	# Distance score based on class profiles
	var dist = CombatCalculator.get_distance(cell_pos, target.grid_position)
	var c_id = enemy.class_data.class_id
	
	if c_id == "enemy_ranger":
		# Rangers love close combat
		score += (15.0 - dist) * 4.0
	elif c_id == "enemy_heavy":
		# Heavy units prefer medium distance (3-5)
		if dist >= 3 and dist <= 5:
			score += 30.0
		else:
			score += (6.0 - dist) * 2.0
	else:
		# Trooper/others prefer medium distance (3-4)
		if dist >= 3 and dist <= 4:
			score += 30.0
		else:
			score += (8.0 - dist) * 2.0
			
	# Flanking bonus: If from cell_pos the target's cover is not active
	var cover_check = CombatCalculator.is_cover_active(cell_pos, target.grid_position, grid)
	if not cover_check.active:
		score += 40.0 # Flanking opportunity!
		
	# Avoid cells occupied by other soldiers
	for s in GameManager.all_soldiers:
		if is_instance_valid(s) and s != enemy and s.stats.hp > 0 and s.grid_position == cell_pos:
			score -= 9999.0
			
	return score

static func hunker_down(enemy: SoldierController) -> void:
	enemy.is_defending = true
	EventBus.combat_log_added.emit("🛡️ %s se trinchera (Hunker Down)." % [enemy.soldier_name], "info")
	enemy.stats.ap = 0
