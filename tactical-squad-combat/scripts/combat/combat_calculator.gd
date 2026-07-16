extends RefCounted
class_name CombatCalculator

# Manhattan distance
static func get_distance(a: Vector2i, b: Vector2i) -> int:
	return abs(a.x - b.x) + abs(a.y - b.y)

# Relative direction of defender to shooter
static func get_relative_direction(shooter_pos: Vector2i, defender_pos: Vector2i) -> String:
	var dx = shooter_pos.x - defender_pos.x
	var dy = shooter_pos.y - defender_pos.y
	
	if abs(dx) >= abs(dy):
		return "E" if dx < 0 else "W"
	else:
		return "S" if dy < 0 else "N"

# Check if cover is active against a shooter
static func is_cover_active(shooter_pos: Vector2i, defender_pos: Vector2i, grid_manager: GridManager) -> Dictionary:
	var cell = grid_manager.get_cell(defender_pos)
	if not cell or not cell.cell_data or cell.cell_data.cover_type == "none":
		return {"active": false, "type": "none", "direction": ""}
		
	var relative_dir = get_relative_direction(shooter_pos, defender_pos)
	var is_active = (cell.cell_data.cover_direction == relative_dir)
	
	return {
		"active": is_active,
		"type": cell.cell_data.cover_type if is_active else "none",
		"direction": cell.cell_data.cover_direction
	}

# Calculate hit chance and damage breakdown
static func calculate_shot(shooter: SoldierController, defender: SoldierController, grid_manager: GridManager) -> Dictionary:
	var s_pos = shooter.grid_position
	var d_pos = defender.grid_position
	
	var dist = get_distance(s_pos, d_pos)
	var base_acc = shooter.class_data.accuracy
	
	var range_mod = 0
	var base_dmg = shooter.class_data.base_damage
	
	# 1. Range Modifiers
	var c_id = shooter.class_data.class_id
	if c_id == "assault":
		if dist <= 2:
			range_mod = -10
		elif dist == 3 or dist == 4:
			range_mod = 15
		elif dist >= 5:
			range_mod = -15 * (dist - 4)
	elif c_id == "snipers":
		if dist <= 2:
			range_mod = -45
		elif dist == 3 or dist == 4:
			range_mod = 0
		elif dist >= 5:
			range_mod = 20
	elif c_id == "medic":
		if dist <= 2:
			range_mod = 25
		elif dist == 3:
			range_mod = -20
		elif dist >= 4:
			range_mod = -60
	elif c_id == "enemy_trooper":
		if dist >= 5:
			range_mod = -15 * (dist - 4)
	elif c_id == "enemy_ranger":
		if dist <= 2:
			range_mod = 20
		else:
			range_mod = -25 * (dist - 2)
	elif c_id == "enemy_heavy":
		if dist <= 2:
			range_mod = -15
		elif dist >= 5:
			range_mod = -30
			
	# 2. Cover Modifiers
	var cover_check = is_cover_active(s_pos, d_pos, grid_manager)
	var cover_acc_mod = 0
	var cover_dmg_reduction = 0.0
	
	if cover_check.active:
		if cover_check.type == "full":
			cover_acc_mod = -45
			cover_dmg_reduction = 0.50 # 50% reduction
		elif cover_check.type == "half":
			cover_acc_mod = -25
			cover_dmg_reduction = 0.25 # 25% reduction
			
	# 3. Elevation Modifiers
	var shooter_cell = grid_manager.get_cell(s_pos)
	var defender_cell = grid_manager.get_cell(d_pos)
	var elev_mod = 0
	
	if shooter_cell and defender_cell:
		var s_elev = shooter_cell.cell_data.elevation
		var d_elev = defender_cell.cell_data.elevation
		if s_elev > d_elev:
			elev_mod = 15 # Uphill advantage
		elif s_elev < d_elev:
			elev_mod = -15 # Downhill penalty
			
	# 4. Hunker Down / Defending Modifier
	if defender.is_defending:
		cover_acc_mod -= 15
		cover_dmg_reduction = min(0.75, cover_dmg_reduction + 0.15)
		
	# Calculate final values
	var final_acc = clamp(base_acc + range_mod + cover_acc_mod + elev_mod, 10, 95)
	var final_dmg = round(base_dmg * (1.0 - cover_dmg_reduction))
	
	return {
		"base_accuracy": base_acc,
		"range_modifier": range_mod,
		"cover_modifier": cover_acc_mod,
		"elevation_modifier": elev_mod,
		"final_accuracy": final_acc,
		"base_damage": base_dmg,
		"damage_reduction": cover_dmg_reduction,
		"final_damage": int(final_dmg),
		"is_cover_active": cover_check.active,
		"cover_type": cover_check.type,
		"distance": dist
	}
