extends Control
class_name HUDController

@onready var panel_info: PanelContainer = $BottomPanel/HBox/InfoPanel
@onready var label_soldier: Label = $BottomPanel/HBox/InfoPanel/Margin/VBox/LabelSoldier
@onready var label_class: Label = $BottomPanel/HBox/InfoPanel/Margin/VBox/LabelClass
@onready var label_hp: Label = $BottomPanel/HBox/InfoPanel/Margin/VBox/LabelHP
@onready var hp_bar: ProgressBar = $BottomPanel/HBox/InfoPanel/Margin/VBox/HPBar
@onready var label_shield: Label = $BottomPanel/HBox/InfoPanel/Margin/VBox/LabelShield
@onready var shield_bar: ProgressBar = $BottomPanel/HBox/InfoPanel/Margin/VBox/ShieldBar
@onready var label_stats: Label = $BottomPanel/HBox/InfoPanel/Margin/VBox/LabelStats

@onready var panel_actions: PanelContainer = $BottomPanel/HBox/ActionPanel
@onready var btn_move: Button = $BottomPanel/HBox/ActionPanel/Margin/VBox/Grid/BtnMove
@onready var btn_shoot: Button = $BottomPanel/HBox/ActionPanel/Margin/VBox/Grid/BtnShoot
@onready var btn_reload: Button = $BottomPanel/HBox/ActionPanel/Margin/VBox/Grid/BtnReload
@onready var btn_heal: Button = $BottomPanel/HBox/ActionPanel/Margin/VBox/Grid/BtnHeal
@onready var btn_grenade: Button = $BottomPanel/HBox/ActionPanel/Margin/VBox/Grid/BtnGrenade
@onready var btn_end_turn: Button = $BottomPanel/HBox/ActionPanel/Margin/VBox/Grid/BtnEndTurn

@onready var text_log: RichTextLabel = $BottomPanel/HBox/LogPanel/Margin/RichTextLabel
@onready var label_turn: Label = $TurnBannerPanel/LabelTurn
@onready var btn_turn: Button = $BottomPanel/HBox/ControlPanel/BtnTurn

@onready var label_dmg_dealt: Label = $TopPanel/Margin/HBox/StatsBox/DmgDealt/VBox/Val
@onready var label_dmg_taken: Label = $TopPanel/Margin/HBox/StatsBox/DmgTaken/VBox/Val
@onready var label_kills: Label = $TopPanel/Margin/HBox/StatsBox/Kills/VBox/Val
@onready var label_accuracy: Label = $TopPanel/Margin/HBox/StatsBox/Accuracy/VBox/Val
@onready var label_hostiles: Label = $TopPanel/Margin/HBox/RoundBox/HostilesPanel/Label

var selected_soldier: SoldierController = null

# Local stats tracking
var total_dmg_dealt: int = 0
var total_dmg_taken: int = 0
var total_kills: int = 0
var total_shots_fired: int = 0
var total_shots_hit: int = 0

func _ready() -> void:
	EventBus.soldier_selected.connect(_on_soldier_selected)
	EventBus.combat_log_added.connect(_on_combat_log_added)
	EventBus.turn_changed.connect(_on_turn_changed)
	
	# Connect buttons
	btn_move.pressed.connect(_on_btn_move_pressed)
	btn_shoot.pressed.connect(_on_btn_shoot_pressed)
	btn_reload.pressed.connect(_on_btn_reload_pressed)
	btn_heal.pressed.connect(_on_btn_heal_pressed)
	btn_grenade.pressed.connect(_on_btn_grenade_pressed)
	btn_end_turn.pressed.connect(_on_btn_end_turn_pressed)
	btn_turn.pressed.connect(_on_btn_turn_pressed)
	
	update_hud_display()

func _on_soldier_selected(soldier: SoldierController) -> void:
	selected_soldier = soldier
	update_hud_display()
	
	# Clear highlights on selection change
	var grid_manager = get_tree().current_scene.get_node("GridManager") as GridManager
	if grid_manager:
		grid_manager.clear_highlights()
		
	if is_instance_valid(selected_soldier) and not selected_soldier.is_enemy and selected_soldier.stats.hp > 0 and GameManager.turn_owner == "player" and selected_soldier.stats.ap > 0:
		_on_btn_move_pressed()

func _on_combat_log_added(message: String, type: String) -> void:
	var color_str = "white"
	if type == "player_attack": 
		color_str = "green"
		# Update global stats on hit/attack
		if "Impacto" in message:
			total_shots_fired += 1
			total_shots_hit += 1
			# Parse damage from log text: "Daño: 45"
			var regex = RegEx.new()
			regex.compile("Daño:\\s*(\\d+)")
			var result = regex.search(message)
			if result:
				total_dmg_dealt += int(result.get_string(1))
		elif "Fallo" in message:
			total_shots_fired += 1
	elif type == "enemy_attack": 
		color_str = "red"
		if "Impacto" in message:
			var regex = RegEx.new()
			regex.compile("Daño:\\s*(\\d+)")
			var result = regex.search(message)
			if result:
				total_dmg_taken += int(result.get_string(1))
	elif type == "damage" and not "recibe" in message:
		pass
	elif type == "heal": 
		color_str = "pink"
	elif type == "death": 
		color_str = "orange"
		if "Alien" in message or "Plasma" in message:
			total_kills += 1
	elif type == "system": 
		color_str = "cyan"
	
	text_log.append_text("[color=%s]%s[/color]\n" % [color_str, message])
	update_global_stats_labels()

func update_global_stats_labels() -> void:
	if label_dmg_dealt: label_dmg_dealt.text = "%d HP" % total_dmg_dealt
	if label_dmg_taken: label_dmg_taken.text = "%d HP" % total_dmg_taken
	if label_kills: label_kills.text = "%d" % total_kills
	if label_accuracy and total_shots_fired > 0:
		var avg_acc = int(float(total_shots_hit) / total_shots_fired * 100.0)
		label_accuracy.text = "%d%%" % avg_acc
		
	# Update active enemy hostiles count
	var enemies_count = 0
	for soldier in GameManager.all_soldiers:
		if is_instance_valid(soldier) and soldier.is_enemy and soldier.stats.hp > 0:
			enemies_count += 1
	if label_hostiles:
		label_hostiles.text = "ENEMIGOS: %d" % enemies_count

func _on_turn_changed(new_owner: String) -> void:
	if label_turn:
		if new_owner == "player":
			label_turn.text = "TU TURNO"
			label_turn.modulate = Color.GREEN
		else:
			label_turn.text = "TURNO ALIENÍGENA"
			label_turn.modulate = Color.RED
	update_hud_display()

func update_hud_display() -> void:
	var is_player_turn = (GameManager.turn_owner == "player")
	
	# Show/Hide actions depending on selection and turn
	if is_player_turn and is_instance_valid(selected_soldier) and selected_soldier.stats.hp > 0:
		panel_info.visible = true
		panel_actions.visible = true
		
		# Set text and progress bar status
		label_soldier.text = selected_soldier.soldier_name.to_upper()
		label_class.text = "%s          NVL 1" % selected_soldier.class_data.class_name_label.to_upper()
		
		label_hp.text = "❤️ VIDA: %d/%d" % [selected_soldier.stats.hp, selected_soldier.stats.max_hp]
		hp_bar.max_value = selected_soldier.stats.max_hp
		hp_bar.value = selected_soldier.stats.hp
		
		label_shield.text = "🛡️ ESCUDO: %d/%d" % [selected_soldier.stats.shield, selected_soldier.stats.max_shield]
		shield_bar.max_value = selected_soldier.stats.max_shield
		shield_bar.value = selected_soldier.stats.shield
		
		var ap_str = ""
		for i in range(selected_soldier.stats.max_ap):
			ap_str += "🔶 " if i < selected_soldier.stats.ap else "◇ "
			
		label_stats.text = "AP: %s             MUNICIÓN: %d/%d" % [
			ap_str, selected_soldier.stats.ammo, selected_soldier.stats.max_ammo
		]
		
		# Show/Hide class actions
		var c_id = selected_soldier.class_data.class_id
		btn_heal.visible = (c_id == "medic")
		btn_grenade.visible = (c_id == "medic" or c_id == "snipers" or c_id == "assault")
		
		# Disable/Enable actions based on AP/Ammo y asegurar visibilidad
		var has_ap = (selected_soldier.stats.ap > 0)
		btn_move.visible = true
		btn_move.disabled = not has_ap
		btn_shoot.visible = true
		btn_shoot.disabled = not has_ap or (selected_soldier.stats.ammo <= 0)
		btn_reload.visible = true
		btn_reload.disabled = not has_ap or (selected_soldier.stats.ammo == selected_soldier.stats.max_ammo)
		btn_heal.disabled = not has_ap
		btn_grenade.disabled = not has_ap
	else:
		panel_info.visible = false
		panel_actions.visible = is_player_turn # show end turn even with no unit selected
		if panel_actions.visible:
			btn_move.visible = false
			btn_shoot.visible = false
			btn_reload.visible = false
			btn_heal.visible = false
			btn_grenade.visible = false
			
	if btn_turn:
		btn_turn.disabled = not is_player_turn

# --- BUTTON ACTIONS ---

func _on_btn_move_pressed() -> void:
	if not is_instance_valid(selected_soldier): return
	GameManager.selected_action = "move"
	EventBus.combat_log_added.emit("Selecciona una casilla para moverte.", "info")
	
	var grid_manager = get_tree().current_scene.get_node("GridManager") as GridManager
	if grid_manager:
		var cells = grid_manager.get_reachable_cells(selected_soldier)
		grid_manager.highlight_reachable_cells(cells)

func _on_btn_shoot_pressed() -> void:
	if not is_instance_valid(selected_soldier): return
	GameManager.selected_action = "shoot"
	EventBus.combat_log_added.emit("Selecciona un enemigo para disparar.", "info")
	
	var grid_manager = get_tree().current_scene.get_node("GridManager") as GridManager
	if grid_manager:
		grid_manager.clear_highlights()
		# Resaltar en rojo las celdas de los enemigos vivos
		var enemy_cells: Array[Vector2i] = []
		for s in GameManager.all_soldiers:
			if is_instance_valid(s) and s.is_enemy and s.stats.hp > 0:
				enemy_cells.append(s.grid_position)
		grid_manager.highlight_reachable_cells(enemy_cells, "red")

func _on_btn_reload_pressed() -> void:
	if not is_instance_valid(selected_soldier): return
	GameManager.execute_reload(selected_soldier)

func _on_btn_heal_pressed() -> void:
	if not is_instance_valid(selected_soldier): return
	var target = null
	var min_hp_lost = -1
	for soldier in GameManager.all_soldiers:
		if is_instance_valid(soldier) and not soldier.is_enemy and soldier.stats.hp > 0:
			var hp_lost = soldier.stats.max_hp - soldier.stats.hp
			if hp_lost > min_hp_lost:
				min_hp_lost = hp_lost
				target = soldier
				
	if target:
		GameManager.execute_heal(selected_soldier, target)
	else:
		EventBus.combat_log_added.emit("Todos los aliados tienen vida al máximo.", "info")

func _on_btn_grenade_pressed() -> void:
	if not is_instance_valid(selected_soldier): return
	GameManager.selected_action = "grenade"
	EventBus.combat_log_added.emit("Selecciona una casilla para lanzar la granada (Rango: 5 celdas).", "info")
	
	var grid_manager = get_tree().current_scene.get_node("GridManager") as GridManager
	if grid_manager:
		grid_manager.clear_highlights()
		# Encontrar todas las celdas en un radio Manhattan de 5
		var grenade_cells: Array[Vector2i] = []
		var start_pos = selected_soldier.grid_position
		for dx in range(-5, 6):
			for dy in range(-5, 6):
				if abs(dx) + abs(dy) <= 5:
					var target_pos = start_pos + Vector2i(dx, dy)
					# Comprobar limites de la cuadricula
					if target_pos.x >= 0 and target_pos.x < GameManager.grid_size and target_pos.y >= 0 and target_pos.y < GameManager.grid_size:
						grenade_cells.append(target_pos)
		grid_manager.highlight_reachable_cells(grenade_cells, "red")

func _on_btn_end_turn_pressed() -> void:
	if not is_instance_valid(selected_soldier): return
	# Buscar el siguiente soldado aliado vivo en el escuadron de forma ciclica
	var player_soldiers = GameManager.all_soldiers.filter(func(s): return is_instance_valid(s) and not s.is_enemy and s.stats.hp > 0)
	if player_soldiers.size() > 1:
		var current_idx = player_soldiers.find(selected_soldier)
		var next_idx = (current_idx + 1) % player_soldiers.size()
		var next_soldier = player_soldiers[next_idx]
		EventBus.soldier_selected.emit(next_soldier)
		EventBus.combat_log_added.emit("Cambiado a: %s." % next_soldier.soldier_name, "info")
	else:
		EventBus.combat_log_added.emit("No hay otros soldados aliados disponibles.", "info")

func _on_btn_turn_pressed() -> void:
	GameManager.end_turn()
