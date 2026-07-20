extends Node3D

@export var soldier_scene: PackedScene = preload("res://scenes/soldiers/soldier.tscn")

@onready var grid_manager: GridManager = $GridManager
@onready var camera: TacticalCamera = $TacticalCamera

# Preload class resources
var class_assault = preload("res://resources/classes/assault.tres")
var class_sniper = preload("res://resources/classes/sniper.tres")
var class_medic = preload("res://resources/classes/medic.tres")
var class_trooper = preload("res://resources/classes/enemy_trooper.tres")
var class_ranger = preload("res://resources/classes/enemy_ranger.tres")
var class_heavy = preload("res://resources/classes/enemy_heavy.tres")

func _ready() -> void:
	EventBus.soldier_selected.connect(_on_soldier_selected)
	EventBus.cell_clicked.connect(_on_cell_clicked)
	
	# Reproducir música de batalla en bucle
	AudioManager.play_music("battle_music")
	
	# Wait for grid to be generated
	await get_tree().process_frame
	spawn_squads()

func spawn_squads() -> void:
	# Player squad (Close/Near zone in a 12x12 grid)
	spawn_soldier("Asalto (Gunnar)", class_assault, Vector2i(2, 2), false)
	spawn_soldier("Sniper (Keira)", class_sniper, Vector2i(1, 1), false)
	spawn_soldier("Medico (Dr. Aris)", class_medic, Vector2i(3, 1), false)
	
	# Enemy squad (Far/Front zone in a 12x12 grid)
	spawn_soldier("Plasma Trooper", class_trooper, Vector2i(8, 9), true)
	spawn_soldier("Ranger Enemigo", class_ranger, Vector2i(9, 10), true)
	spawn_soldier("Dreadnought Enemigo", class_heavy, Vector2i(7, 10), true)
	
	# Focus camera on the first player soldier
	if GameManager.all_soldiers.size() > 0:
		var first_soldier = GameManager.all_soldiers[0]
		camera.target_focus = first_soldier.global_position
		EventBus.soldier_selected.emit(first_soldier)

func spawn_soldier(unit_name: String, class_res: SoldierClassData, grid_pos: Vector2i, is_enemy: bool) -> void:
	var soldier = soldier_scene.instantiate() as SoldierController
	soldier.soldier_name = unit_name
	soldier.class_data = class_res
	soldier.is_enemy = is_enemy
	soldier.grid_position = grid_pos
	
	add_child(soldier)
	
	# Place in 3D world position
	soldier.global_position = grid_manager.get_world_position(grid_pos)
	
	# If enemy, face South; if player, face North
	if is_enemy:
		soldier.rotation.y = deg_to_rad(180)
		# Make CSG box red for enemy, blue/green for players
		var body = soldier.get_node("Body") as CSGBox3D
		if body:
			var mat = StandardMaterial3D.new()
			mat.albedo_color = Color.RED
			body.material_override = mat
	else:
		soldier.rotation.y = deg_to_rad(0)
		var body = soldier.get_node("Body") as CSGBox3D
		if body:
			var mat = StandardMaterial3D.new()
			if class_res.class_id == "assault":
				mat.albedo_color = Color.DEEP_SKY_BLUE
			elif class_res.class_id == "snipers":
				mat.albedo_color = Color.MEDIUM_SPRING_GREEN
			else:
				mat.albedo_color = Color.LIGHT_CORAL
			body.material_override = mat

func _on_soldier_selected(selected_soldier: SoldierController) -> void:
	for soldier in GameManager.all_soldiers:
		if is_instance_valid(soldier):
			soldier.set_selected(soldier == selected_soldier)

func _on_cell_clicked(grid_pos: Vector2i) -> void:
	var active_soldier = GameManager.active_soldier
	var action = GameManager.selected_action
	
	# Handle specialized targeting actions
	if active_soldier and is_instance_valid(active_soldier) and active_soldier.stats.ap > 0:
		if action == "shoot":
			# Find enemy at grid_pos
			var target_enemy = null
			for soldier in GameManager.all_soldiers:
				if is_instance_valid(soldier) and soldier.is_enemy and soldier.stats.hp > 0 and soldier.grid_position == grid_pos:
					target_enemy = soldier
					break
			if target_enemy:
				GameManager.execute_shoot(active_soldier, target_enemy)
				GameManager.selected_action = ""
				return
		elif action == "heal":
			# Find ally at grid_pos
			var target_ally = null
			for soldier in GameManager.all_soldiers:
				if is_instance_valid(soldier) and not soldier.is_enemy and soldier.stats.hp > 0 and soldier.grid_position == grid_pos:
					target_ally = soldier
					break
			if target_ally:
				GameManager.execute_heal(active_soldier, target_ally)
				GameManager.selected_action = ""
				return
		elif action == "grenade":
			var dist = CombatCalculator.get_distance(active_soldier.grid_position, grid_pos)
			if dist <= 5:
				GameManager.execute_grenade(active_soldier, grid_pos)
				GameManager.selected_action = ""
				return
			else:
				EventBus.combat_log_added.emit("Granada fuera de rango.", "info")
				return

	# Default selection check
	var clicked_on_soldier = false
	for soldier in GameManager.all_soldiers:
		if is_instance_valid(soldier) and soldier.stats.hp > 0 and soldier.grid_position == grid_pos:
			clicked_on_soldier = true
			EventBus.soldier_selected.emit(soldier)
			break
			
	if not clicked_on_soldier:
		# If we click an empty cell and we are not doing an action, clear selection
		if GameManager.selected_action == "":
			EventBus.soldier_selected.emit(null)
