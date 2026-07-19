extends CharacterBody3D
class_name SoldierController

@export var soldier_name: String = "Soldado"
@export var class_data: SoldierClassData
@export var is_enemy: bool = false

var stats: SoldierStats
var grid_position: Vector2i
var is_defending: bool = false

@onready var selection_ring: MeshInstance3D = $SelectionRing
@onready var label_name: Label3D = $Label3D

func _ready() -> void:
	# Configure stats
	stats = SoldierStats.new()
	if class_data:
		stats.init_stats(class_data)
	
	# Add to game manager
	GameManager.all_soldiers.append(self)
	
	# Setup visual indicators
	set_selected(false)
	if label_name:
		label_name.text = "%s\nHP: %d/%d" % [soldier_name, stats.hp, stats.max_hp]
		if is_enemy:
			label_name.modulate = Color.RED
		else:
			label_name.modulate = Color.DEEP_SKY_BLUE

func set_selected(value: bool) -> void:
	if selection_ring:
		selection_ring.visible = value

func _input_event(_camera: Camera3D, event: InputEvent, _event_position: Vector3, _normal: Vector3, _shape_idx: int) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		get_viewport().set_input_as_handled()
		EventBus.soldier_selected.emit(self)

func take_damage(amount: int) -> void:
	if not stats:
		return
	var shield_damage = min(stats.shield, amount)
	stats.shield -= shield_damage
	var hp_damage = amount - shield_damage
	stats.hp = max(0, stats.hp - hp_damage)
	
	EventBus.combat_log_added.emit("%s recibe %d de daño (%d al escudo, %d a la vida)." % [soldier_name, amount, shield_damage, hp_damage], "damage")
	
	# 1. Efecto Visual de Destello Rojo en Body
	var body = get_node_or_null("Body") as CSGBox3D
	if body and body.material_override:
		var orig_mat = body.material_override as StandardMaterial3D
		if orig_mat:
			var flash_mat = orig_mat.duplicate() as StandardMaterial3D
			flash_mat.albedo_color = Color.RED
			body.material_override = flash_mat
			get_tree().create_timer(0.15).timeout.connect(func():
				body.material_override = orig_mat
			)
			
	# 2. Spawnear Texto Flotante de Daño
	var damage_label = Label3D.new()
	damage_label.text = "-%d HP" % amount
	damage_label.billboard = LabeledTextBillboard.BILLBOARD_ENABLED # Billboard 1 en Godot 4 es enabled
	damage_label.modulate = Color(1.0, 0.2, 0.2) if hp_damage > 0 else Color(0.2, 0.7, 1.0)
	damage_label.font_size = 28
	damage_label.outline_size = 8
	add_child(damage_label)
	damage_label.global_position = global_position + Vector3(0, 1.8, 0)
	
	var tween = create_tween()
	tween.tween_property(damage_label, "global_position:y", global_position.y + 2.8, 0.6)
	tween.parallel().tween_property(damage_label, "modulate:a", 0.0, 0.6)
	tween.tween_callback(damage_label.queue_free)
	
	# Update label visually if it exists
	if label_name:
		label_name.text = "%s\nHP: %d/%d" % [soldier_name, stats.hp, stats.max_hp]
		
	if stats.hp <= 0:
		die()

func die() -> void:
	EventBus.combat_log_added.emit("💀 %s ha sido incapacitado." % [soldier_name], "death")
	GameManager.all_soldiers.erase(self)
	
	# Sonido de muerte aleatorio
	var death_sounds = ["death_1", "death_2", "death_3"]
	var random_death_sfx = death_sounds[randi() % death_sounds.size()]
	AudioManager.play_sfx(random_death_sfx)
	
	# Simple death animation
	var tween = create_tween()
	tween.tween_property(self, "position:y", -2.0, 0.4)
	tween.tween_callback(queue_free)
