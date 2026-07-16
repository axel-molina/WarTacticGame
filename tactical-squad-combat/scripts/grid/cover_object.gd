extends StaticBody3D
class_name CoverObject

@onready var mesh: CSGBox3D = $Mesh

var cover_type: String = "none" # "half" or "full"
var cover_direction: String = "N"
var health: float = 0.0
var grid_position: Vector2i

func setup(type: String, dir: String, pos: Vector2i) -> void:
	cover_type = type
	cover_direction = dir
	grid_position = pos
	
	health = 50.0 if type == "full" else 30.0
	
	# Visual scaling based on cover type
	if mesh:
		if type == "full":
			mesh.size = Vector3(1.6, 1.8, 0.4)
			mesh.position.y = 0.9
			# Gray material for full cover
			var mat = StandardMaterial3D.new()
			mat.albedo_color = Color(0.3, 0.3, 0.35)
			mesh.material_override = mat
		else:
			mesh.size = Vector3(1.6, 0.9, 0.4)
			mesh.position.y = 0.45
			# Brown/wooden material for half cover
			var mat = StandardMaterial3D.new()
			mat.albedo_color = Color(0.45, 0.35, 0.25)
			mesh.material_override = mat
			
		# Rotate cover to face the specified direction
		# Default orientation (facing North / South along X/Z axis)
		if dir == "E" or dir == "W":
			rotation.y = deg_to_rad(90)

func take_damage(amount: float) -> void:
	health -= amount
	if health <= 0:
		# Notify GridManager that cover is destroyed
		var gm = get_node_or_null("../../GridManager")
		if gm and gm.has_method("destroy_cover_at"):
			gm.destroy_cover_at(grid_position)
		queue_free()
