extends Control
class_name HUDController

@onready var panel_info: PanelContainer = $InfoPanel
@onready var label_soldier: Label = $InfoPanel/Margin/HBox/VBox/HBoxHeader/LabelSoldier
@onready var label_class: Label = $InfoPanel/Margin/HBox/VBox/HBoxHeader/LabelClass
@onready var label_hp: Label = $InfoPanel/Margin/HBox/VBox/HBoxHP/LabelHP
@onready var hp_bar: ProgressBar = $InfoPanel/Margin/HBox/VBox/HPBar
@onready var label_shield: Label = $InfoPanel/Margin/HBox/VBox/HBoxShield/LabelShield
@onready var shield_bar: ProgressBar = $InfoPanel/Margin/HBox/VBox/ShieldBar
@onready var label_ammo: Label = $InfoPanel/Margin/HBox/VBox/HBoxStats/LabelAmmo
@onready var ap_icons_container: HBoxContainer = $InfoPanel/Margin/HBox/VBox/HBoxStats/ApIconsContainer

@onready var panel_actions: PanelContainer = $ActionPanel
@onready var btn_move: Button = $ActionPanel/Margin/HBox/BtnMove
@onready var btn_shoot: Button = $ActionPanel/Margin/HBox/BtnShoot
@onready var btn_reload: Button = $ActionPanel/Margin/HBox/BtnReload
@onready var btn_heal: Button = $ActionPanel/Margin/HBox/BtnHeal
@onready var btn_grenade: Button = $ActionPanel/Margin/HBox/BtnGrenade
@onready var btn_end_turn: Button = $ActionPanel/Margin/HBox/BtnEndTurn

@onready var text_log: RichTextLabel = $LogPanel/Margin/RichTextLabel
@onready var label_turn: Label = null # No longer present as a separate banner
@onready var btn_turn: Button = $BtnTurn

@onready var label_dmg_dealt: Label = $RightHeader/Margin/StatsBox/DmgDealt/VBox/Val
@onready var label_dmg_taken: Label = $RightHeader/Margin/StatsBox/DmgTaken/VBox/Val
@onready var label_kills: Label = $RightHeader/Margin/StatsBox/Kills/VBox/Val
@onready var label_accuracy: Label = $RightHeader/Margin/StatsBox/Accuracy/VBox/Val
@onready var label_hostiles: Label = $LeftHeader/HostilesPanel/Label

# Referencias a VictoryPanel
@onready var victory_panel: ColorRect = $VictoryPanel
@onready var label_mvp: Label = $VictoryPanel/Center/Card/Margin/VBox/MVPBox/LabelMVP
@onready var label_mvp_stats: Label = $VictoryPanel/Center/Card/Margin/VBox/MVPBox/LabelStats
@onready var btn_main_menu: Button = $VictoryPanel/Center/Card/Margin/VBox/HBoxButtons/BtnMainMenu
@onready var btn_continue: Button = $VictoryPanel/Center/Card/Margin/VBox/HBoxButtons/BtnContinue

# Referencias a ConfirmTurnPanel
@onready var confirm_turn_panel: ColorRect = $ConfirmTurnPanel
@onready var label_confirm_desc: Label = $ConfirmTurnPanel/Center/Card/Margin/VBox/LabelDesc
@onready var btn_confirm_end_turn: Button = $ConfirmTurnPanel/Center/Card/Margin/VBox/HBoxButtons/BtnConfirmEndTurn
@onready var btn_cancel_end_turn: Button = $ConfirmTurnPanel/Center/Card/Margin/VBox/HBoxButtons/BtnCancelEndTurn

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
	
	# Connect signal of victory
	EventBus.mission_victory.connect(_on_mission_victory)
	
	# Connect buttons
	btn_move.pressed.connect(_on_btn_move_pressed)
	btn_shoot.pressed.connect(_on_btn_shoot_pressed)
	btn_reload.pressed.connect(_on_btn_reload_pressed)
	btn_heal.pressed.connect(_on_btn_heal_pressed)
	btn_grenade.pressed.connect(_on_btn_grenade_pressed)
	btn_end_turn.pressed.connect(_on_btn_end_turn_pressed)
	btn_turn.pressed.connect(_on_btn_turn_pressed)
	
	# Victory buttons
	btn_main_menu.pressed.connect(func():
		SceneTransition.change_scene("res://scenes/menu/menu_scene.tscn")
	)
	
	btn_continue.pressed.connect(func():
		AudioManager.play_sfx("ui_click_menu")
		victory_panel.visible = false
	)
	
	# Confirm turn buttons
	btn_confirm_end_turn.pressed.connect(func():
		AudioManager.play_sfx("ui_click_menu")
		confirm_turn_panel.visible = false
		GameManager.end_turn()
	)
	
	btn_cancel_end_turn.pressed.connect(func():
		AudioManager.play_sfx("ui_click_menu")
		confirm_turn_panel.visible = false
	)
	
	# Connect hover sounds
	var action_buttons = [
		btn_move, btn_shoot, btn_reload, btn_heal, btn_grenade, btn_end_turn, btn_turn, 
		btn_main_menu, btn_continue, btn_confirm_end_turn, btn_cancel_end_turn
	]
	for btn in action_buttons:
		if btn:
			btn.mouse_entered.connect(func():
				if not btn.disabled:
					AudioManager.play_sfx("ui_hover_combat")
			)
	
	update_hud_display()

func _on_mission_victory(mvp_name: String, stats_dict: Dictionary) -> void:
	if label_mvp:
		label_mvp.text = "JUGADOR MVP: %s" % mvp_name.to_upper()
	if label_mvp_stats:
		label_mvp_stats.text = "BAJAS: %d      DAÑO REGISTRADO: %d HP" % [
			stats_dict.get("mvp_kills", 0),
			stats_dict.get("mvp_dmg", 0)
		]
	if victory_panel:
		victory_panel.visible = true

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
		if "Enemigo" in message or "Plasma" in message:
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
			label_turn.text = "TURNO DE LOS ENEMIGOS"
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
		
		label_hp.text = "VIDA: %d/%d" % [selected_soldier.stats.hp, selected_soldier.stats.max_hp]
		hp_bar.max_value = selected_soldier.stats.max_hp
		hp_bar.value = selected_soldier.stats.hp
		
		label_shield.text = "ESCUDO: %d/%d" % [selected_soldier.stats.shield, selected_soldier.stats.max_shield]
		shield_bar.max_value = selected_soldier.stats.max_shield
		shield_bar.value = selected_soldier.stats.shield
		
		# Limpiar iconos anteriores de AP
		for child in ap_icons_container.get_children():
			child.queue_free()
			
		# Cargar textura de ap_icon dinamicamente
		var ap_tex = preload("res://images/battleicons/ap_icon.png")
		for i in range(selected_soldier.stats.max_ap):
			var ap_rect = TextureRect.new()
			ap_rect.custom_minimum_size = Vector2(10, 10)
			ap_rect.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			ap_rect.texture = ap_tex
			ap_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			ap_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			# AP gastados se verán translúcidos/opacos
			if i >= selected_soldier.stats.ap:
				ap_rect.modulate = Color(1.0, 1.0, 1.0, 0.2)
			ap_icons_container.add_child(ap_rect)
			
		label_ammo.text = "MUNICIÓN: %d/%d" % [
			selected_soldier.stats.ammo, selected_soldier.stats.max_ammo
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
		
		# La granada cuesta 2 AP, por lo que requiere al menos 2 AP
		btn_grenade.disabled = (selected_soldier.stats.ap < 2)
		
		# --- GESTIÓN DE BRILLOS TÁCTICOS (GLOW) ---
		# 1. Brillo de Recarga: si el soldado tiene 0 balas Y AP disponibles
		var should_glow_reload = (selected_soldier.stats.ammo <= 0 and selected_soldier.stats.ap > 0)
		_set_button_glow(btn_reload, should_glow_reload, Color(1.0, 0.5, 0.1))
		
		# Obtener soldados aliados del jugador
		var player_soldiers = GameManager.all_soldiers.filter(func(s): return is_instance_valid(s) and not s.is_enemy and s.stats.hp > 0)
		
		# 2. Brillo de Siguiente (Pasar): si el soldado actual tiene 0 AP, pero hay otros soldados aliados con AP > 0
		var other_allies_have_ap = false
		for ally in player_soldiers:
			if ally != selected_soldier and ally.stats.ap > 0:
				other_allies_have_ap = true
				break
		var should_glow_next = (selected_soldier.stats.ap <= 0 and other_allies_have_ap)
		_set_button_glow(btn_end_turn, should_glow_next, Color(1.0, 0.5, 0.1))
		
		# 3. Brillo de Finalizar Turno: si NINGÚN soldado propio tiene AP disponibles
		var any_soldier_has_ap = false
		for ally in player_soldiers:
			if ally.stats.ap > 0:
				any_soldier_has_ap = true
				break
		var should_glow_turn = (not any_soldier_has_ap)
		_set_button_glow(btn_turn, should_glow_turn, Color(0.0, 0.94, 1.0))
		
		# --- ACTUALIZAR OPACIDAD Y COLOR DE BOTONES DESHABILITADOS ---
		_update_button_visual_states(btn_move)
		_update_button_visual_states(btn_shoot)
		_update_button_visual_states(btn_reload)
		_update_button_visual_states(btn_heal)
		_update_button_visual_states(btn_grenade)
		_update_button_visual_states(btn_end_turn)
		
	else:
		panel_info.visible = false
		panel_actions.visible = false # Ocultar completamente el panel de acciones si no hay soldado seleccionado
		
		# Detener brillos si no hay seleccion
		_set_button_glow(btn_reload, false, Color.WHITE)
		_set_button_glow(btn_end_turn, false, Color.WHITE)
		_set_button_glow(btn_turn, false, Color.WHITE)
		
	if btn_turn:
		btn_turn.disabled = not is_player_turn
		_update_button_visual_states(btn_turn)

# Almacena los Tweens activos de brillo para evitar colisiones
var _glow_tweens: Dictionary = {}

func _update_button_visual_states(btn: Button) -> void:
	if not btn: return
	
	var icon_rect = btn.get_node_or_null("VBox/Icon") as TextureRect
	var name_label = btn.get_node_or_null("VBox/Label") as Label
	var cost_label = btn.get_node_or_null("VBox/Cost") as Label
	
	if btn.disabled:
		# Opacar icono a gris oscuro/translúcido
		if icon_rect:
			icon_rect.modulate = Color(0.3, 0.35, 0.4, 0.5)
		# Grisear textos
		if name_label:
			name_label.add_theme_color_override("font_color", Color(0.3, 0.35, 0.4, 0.6))
		if cost_label:
			cost_label.add_theme_color_override("font_color", Color(0.3, 0.35, 0.4, 0.4))
	else:
		# Restaurar color de icono
		if icon_rect:
			icon_rect.modulate = Color.WHITE
		# Restaurar colores por defecto de textos
		if name_label:
			name_label.remove_theme_color_override("font_color")
		if cost_label:
			cost_label.remove_theme_color_override("font_color")

func _set_button_glow(btn: Button, should_glow: bool, glow_color: Color) -> void:
	if not btn: return
	
	if should_glow:
		# Si ya está brillando, no reiniciar el Tween
		if _glow_tweens.has(btn):
			return
			
		# Configurar tinte inicial del botón
		btn.self_modulate = glow_color
		
		# Crear un Tween en bucle infinito que haga parpadear la opacidad del color del botón
		var tween = btn.create_tween().set_loops()
		tween.tween_property(btn, "self_modulate:a", 0.4, 0.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		tween.tween_property(btn, "self_modulate:a", 1.0, 0.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		_glow_tweens[btn] = tween
	else:
		# Detener e interrumpir el parpadeo si existía
		if _glow_tweens.has(btn):
			var tween = _glow_tweens[btn]
			if tween:
				tween.kill()
			_glow_tweens.erase(btn)
		btn.self_modulate = Color.WHITE

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
	# Filtrar los soldados aliados vivos con AP > 0
	var allies_with_ap = GameManager.all_soldiers.filter(
		func(s): return is_instance_valid(s) and not s.is_enemy and s.stats.hp > 0 and s.stats.ap > 0
	)
	
	if allies_with_ap.size() == 0:
		# Si nadie tiene AP, finalizar turno directamente
		GameManager.end_turn()
	else:
		# Si hay AP disponibles, abrir el modal de advertencia
		if allies_with_ap.size() == 1:
			label_confirm_desc.text = "El soldado %s todavía tiene puntos de habilidad disponibles para utilizar." % allies_with_ap[0].soldier_name.to_upper()
		else:
			label_confirm_desc.text = "Algunos soldados todavía pueden realizar acciones en este turno."
			
		confirm_turn_panel.visible = true
