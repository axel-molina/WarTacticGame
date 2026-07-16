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
	
	# Update label visually if it exists
	if label_name:
		label_name.text = "%s\nHP: %d/%d" % [soldier_name, stats.hp, stats.max_hp]
		
	if stats.hp <= 0:
		die()

func die() -> void:
	EventBus.combat_log_added.emit("💀 %s ha sido incapacitado." % [soldier_name], "death")
	GameManager.all_soldiers.erase(self)
	
	# Simple death animation
	var tween = create_tween()
	tween.tween_property(self, "position:y", -2.0, 0.4)
	tween.tween_callback(queue_free)
