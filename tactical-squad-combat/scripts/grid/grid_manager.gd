extends Node3D
class_name GridManager

@export var cell_scene: PackedScene = preload("res://scenes/grid/grid_cell.tscn")
@export var cover_scene: PackedScene = preload("res://scenes/grid/cover_object.tscn")

var cells_dict: Dictionary = {} # Vector2i -> GridCell
var covers_dict: Dictionary = {} # Vector2i -> CoverObject

# Tactical cover map for 12x12 grid: pos -> {type, dir}
var cover_map: Dictionary = {
	Vector2i(3, 3): {"type": "full", "dir": "S"},
	Vector2i(8, 3): {"type": "full", "dir": "S"},
	Vector2i(3, 8): {"type": "full", "dir": "N"},
	Vector2i(8, 8): {"type": "full", "dir": "N"},
	Vector2i(5, 5): {"type": "half", "dir": "E"},
	Vector2i(6, 6): {"type": "half", "dir": "W"},
	Vector2i(2, 5): {"type": "half", "dir": "W"},
	Vector2i(9, 6): {"type": "half", "dir": "E"},
	Vector2i(5, 2): {"type": "half", "dir": "S"},
	Vector2i(6, 9): {"type": "half", "dir": "N"},
	Vector2i(5, 8): {"type": "half", "dir": "N"},
	Vector2i(6, 3): {"type": "half", "dir": "S"}
}

func _ready() -> void:
	generate_grid()

func generate_grid() -> void:
	for x in range(GameManager.grid_size):
		for y in range(GameManager.grid_size):
			var data = GridCellData.new()
			data.grid_x = x
			data.grid_y = y
			
			# Configure elevation (elevated corners & sniper overlooks)
			var elevation = 0
			if (x == 0 and y == 0) or (x == GameManager.grid_size - 1 and y == 0) or \
			   (x == 0 and y == GameManager.grid_size - 1) or (x == GameManager.grid_size - 1 and y == GameManager.grid_size - 1):
				elevation = 1
			elif (x == 5 or x == 6) and (y == 0 or y == GameManager.grid_size - 1):
				elevation = 1
				
			data.elevation = elevation
			
			var grid_pos = Vector2i(x, y)
			
			# Load cover if configured
			if cover_map.has(grid_pos):
				var info = cover_map[grid_pos]
				data.cover_type = info["type"]
				data.cover_direction = info["dir"]
				data.cover_health = 50.0 if info["type"] == "full" else 30.0
			
			var cell_instance = cell_scene.instantiate() as GridCell
			add_child(cell_instance)
			cell_instance.setup(data)
			cells_dict[grid_pos] = cell_instance
			
			# Spawn 3D cover visual instance
			if data.cover_type != "none":
				var cover_instance = cover_scene.instantiate() as CoverObject
				add_child(cover_instance)
				cover_instance.setup(data.cover_type, data.cover_direction, grid_pos)
				
				# Position cover relative to cell with dir offsets
				var c_pos = cell_instance.global_position
				var offset_dist = 0.75
				if data.cover_direction == "N":
					c_pos.z -= offset_dist
				elif data.cover_direction == "S":
					c_pos.z += offset_dist
				elif data.cover_direction == "E":
					c_pos.x += offset_dist
				elif data.cover_direction == "W":
					c_pos.x -= offset_dist
					
				cover_instance.global_position = c_pos
				covers_dict[grid_pos] = cover_instance

func destroy_cover_at(grid_pos: Vector2i) -> void:
	if covers_dict.has(grid_pos):
		covers_dict.erase(grid_pos)
		
	var cell = get_cell(grid_pos)
	if cell and cell.cell_data:
		cell.cell_data.cover_type = "none"
		cell.cell_data.cover_direction = "N"
		cell.cell_data.cover_health = 0.0

func get_cell(grid_pos: Vector2i) -> GridCell:
	return cells_dict.get(grid_pos, null)

func get_world_position(grid_pos: Vector2i) -> Vector3:
	var cell = get_cell(grid_pos)
	if cell:
		# Return position above the cell floor surface
		return Vector3(
			cell.global_position.x,
			cell.global_position.y + 0.05,
			cell.global_position.z
		)
	
	# Default fallback calculation
	return Vector3(
		grid_pos.x * 2.0 - 11.0,
		0.05,
		grid_pos.y * 2.0 - 11.0
	)

func get_reachable_cells(soldier: SoldierController) -> Array[Vector2i]:
	var reachable: Array[Vector2i] = []
	if not is_instance_valid(soldier) or not soldier.stats:
		return reachable
		
	var max_range = soldier.stats.ap
	if max_range <= 0 or soldier.stats.hp <= 0:
		return reachable
		
	var start_pos = soldier.grid_position
	# Manhattan distance: loop cells in grid range
	for dx in range(-max_range, max_range + 1):
		for dy in range(-max_range, max_range + 1):
			if dx == 0 and dy == 0:
				continue
			var cost = abs(dx) + abs(dy)
			if cost > max_range:
				continue
				
			var target_pos = start_pos + Vector2i(dx, dy)
			
			# Bounds check
			if target_pos.x < 0 or target_pos.x >= GameManager.grid_size or target_pos.y < 0 or target_pos.y >= GameManager.grid_size:
				continue
				
			# Check occupancy by any alive soldier
			var is_occupied = false
			for other in GameManager.all_soldiers:
				if is_instance_valid(other) and other.stats.hp > 0 and other.grid_position == target_pos:
					is_occupied = true
					break
			if is_occupied:
				continue
				
			reachable.append(target_pos)
	return reachable

func highlight_reachable_cells(reachable: Array[Vector2i], color_type: String = "cyan") -> void:
	clear_highlights()
	for pos in reachable:
		var cell = get_cell(pos)
		if cell:
			cell.set_highlight(true, color_type)

func clear_highlights() -> void:
	for cell in cells_dict.values():
		if is_instance_valid(cell):
			cell.set_highlight(false)
