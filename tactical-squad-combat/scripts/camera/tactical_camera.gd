extends Camera3D
class_name TacticalCamera

@export var pan_speed: float = 15.0
@export var rotation_speed: float = 3.0
@export var zoom_speed: float = 5.0
@export var lerp_weight: float = 8.0

var target_focus: Vector3 = Vector3(0, 0, 0)
var current_focus: Vector3 = Vector3(0, 0, 0)

var yaw: float = -45.0 # Angle in degrees
var target_yaw: float = -45.0
var pitch: float = 35.0 # Incline down (above ground)
var target_pitch: float = 35.0

var zoom_distance: float = 16.0
var target_zoom: float = 16.0
var min_zoom: float = 6.0
var max_zoom: float = 24.0

var is_dragging: bool = false
var is_rotating: bool = false
@export var mouse_rotation_speed: float = 0.25

func _ready() -> void:
	# Position camera initially
	update_camera_transform(1.0)
	EventBus.soldier_selected.connect(_on_soldier_selected)

func _process(delta: float) -> void:
	handle_inputs(delta)
	
	# Smoothly interpolate position and orientation values
	current_focus = current_focus.lerp(target_focus, lerp_weight * delta)
	yaw = lerp(yaw, target_yaw, lerp_weight * delta)
	pitch = lerp(pitch, target_pitch, lerp_weight * delta)
	zoom_distance = lerp(zoom_distance, target_zoom, lerp_weight * delta)
	
	update_camera_transform(delta)

func handle_inputs(delta: float) -> void:
	# Camera horizontal movement vector based on current rotation
	var forward = -transform.basis.z
	forward.y = 0
	forward = forward.normalized()
	
	var right = transform.basis.x
	right.y = 0
	right = right.normalized()
	
	var move_dir = Vector3.ZERO
	if Input.is_action_pressed("ui_up") or Input.is_key_pressed(KEY_W):
		move_dir += forward
	if Input.is_action_pressed("ui_down") or Input.is_key_pressed(KEY_S):
		move_dir -= forward
	if Input.is_action_pressed("ui_left") or Input.is_key_pressed(KEY_A):
		move_dir -= right
	if Input.is_action_pressed("ui_right") or Input.is_key_pressed(KEY_D):
		move_dir += right
		
	if move_dir != Vector3.ZERO:
		target_focus += move_dir.normalized() * pan_speed * delta
		
	# Camera horizontal rotation
	if Input.is_key_pressed(KEY_Q):
		target_yaw += rotation_speed * 15.0 * delta
	if Input.is_key_pressed(KEY_E):
		target_yaw -= rotation_speed * 15.0 * delta

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			target_zoom = clamp(target_zoom - zoom_speed * 0.2, min_zoom, max_zoom)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			target_zoom = clamp(target_zoom + zoom_speed * 0.2, min_zoom, max_zoom)
		elif event.button_index == MOUSE_BUTTON_MIDDLE:
			is_dragging = event.pressed
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			# El click derecho siempre rota la cámara
			is_rotating = event.pressed
		elif event.button_index == MOUSE_BUTTON_LEFT:
			# El click izquierdo hace la acción contraria del arrastre táctico
			is_dragging = event.pressed
			
	elif event is InputEventMouseMotion:
		if is_dragging:
			var right = transform.basis.x
			right.y = 0
			right = right.normalized()
			
			var forward = -transform.basis.z
			forward.y = 0
			forward = forward.normalized()
			
			# Drag panning scaling with zoom level
			var drag_scale = 0.0015 * zoom_distance
			var drag_vector = -right * event.relative.x * drag_scale + forward * event.relative.y * drag_scale
			target_focus += drag_vector
		elif is_rotating:
			target_yaw += event.relative.x * mouse_rotation_speed
			target_pitch = clamp(target_pitch + event.relative.y * mouse_rotation_speed, 15.0, 75.0)

func update_camera_transform(_delta: float) -> void:
	# Calculate camera position based on current_focus, yaw, pitch, and zoom_distance
	var yaw_rad = deg_to_rad(yaw)
	var pitch_rad = deg_to_rad(pitch)
	
	var offset = Vector3(
		cos(yaw_rad) * cos(pitch_rad),
		sin(pitch_rad),
		sin(yaw_rad) * cos(pitch_rad)
	) * zoom_distance
	
	global_position = current_focus + offset
	look_at(current_focus)

func _on_soldier_selected(soldier) -> void:
	if soldier:
		target_focus = soldier.global_position
