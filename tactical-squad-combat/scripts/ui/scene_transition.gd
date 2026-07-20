extends CanvasLayer

@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var color_rect: ColorRect = $ColorRect

func _ready() -> void:
	# Asegurar que el barrido comience invisible
	color_rect.material.set_shader_parameter("progress", 0.0)

func change_scene(target_scene_path: String) -> void:
	# 1. Reproducir sonido de clic si aplica
	AudioManager.play_sfx("ui_click_menu")
	
	# 2. Transición de entrada (el barrido cubre la pantalla)
	animation_player.play("fade_in")
	await animation_player.animation_finished
	
	# 3. Cambiar de escena
	get_tree().change_scene_to_file(target_scene_path)
	
	# 4. Esperar un frame a que se dibuje la nueva escena
	await get_tree().process_frame
	
	# 5. Transición de salida (el barrido se retira revelando la escena)
	animation_player.play("fade_out")
