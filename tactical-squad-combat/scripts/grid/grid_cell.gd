extends Area3D
class_name GridCell

@export var hover_material: Material
@export var default_material: Material
@export var path_material: Material

var cell_data: GridCellData
var grid_position: Vector2i

@onready var mesh: CSGBox3D = $Mesh
@onready var highlight_border: CSGBox3D = $HighlightBorder
@onready var hover_border: CSGBox3D = $HoverBorder

func _ready() -> void:
	mouse_entered.connect(_on_mouse_entered)
	mouse_exited.connect(_on_mouse_exited)
	set_highlight(false)
	if hover_border:
		hover_border.visible = false

func setup(data: GridCellData) -> void:
	cell_data = data
	grid_position = Vector2i(data.grid_x, data.grid_y)
	
	# Apply elevation: offset height of the cell
	# 1 elevation step = 1 meter height
	global_position = Vector3(
		data.grid_x * 2.0 - 11.0, # Centering a 12x12 grid (2m size cells, offset is (12-1)/2 * 2 = 11.0)
		data.elevation * 1.0,
		data.grid_y * 2.0 - 11.0
	)
	
	# If elevated, make it slightly different visually or thicker so it reaches down to the floor
	if data.elevation > 0:
		mesh.size.y = data.elevation * 1.0 + 0.1
		mesh.position.y = -mesh.size.y / 2.0 + 0.05
	else:
		mesh.size.y = 0.1
		mesh.position.y = -0.05


func set_highlight(value: bool, color_type: String = "cyan") -> void:
	if highlight_border:
		highlight_border.visible = value
		if value:
			var mat = highlight_border.material_override as StandardMaterial3D
			if mat:
				# Duplicar el material para no afectar a todas las celdas simultaneamente
				var dup_mat = mat.duplicate() as StandardMaterial3D
				if color_type == "red":
					dup_mat.albedo_color = Color(1.0, 0.1, 0.1, 0.45) # Rojo traslucido para combate
				else:
					dup_mat.albedo_color = Color(0.0, 0.8, 1.0, 0.4)  # Celeste original para movimiento
				highlight_border.material_override = dup_mat

func _on_mouse_entered() -> void:
	if hover_border:
		hover_border.visible = true
	EventBus.cell_hovered.emit(grid_position)

func _on_mouse_exited() -> void:
	if hover_border:
		hover_border.visible = false

func _input_event(_camera: Camera3D, event: InputEvent, _event_position: Vector3, _normal: Vector3, _shape_idx: int) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		get_viewport().set_input_as_handled()
		EventBus.cell_clicked.emit(grid_position)
