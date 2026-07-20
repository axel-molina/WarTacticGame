extends Node

const SAVE_PATH = "user://settings.cfg"

# Default configurations
var music_volume: float = 0.8  # 0.0 to 1.0
var sfx_volume: float = 0.8    # 0.0 to 1.0
var fullscreen: bool = false
var resolution: Vector2i = Vector2i(1280, 720)
var drag_with_right_click: bool = true

func _ready() -> void:
	load_settings()
	apply_video_settings()

func save_settings() -> void:
	var config = ConfigFile.new()
	config.set_value("audio", "music_volume", music_volume)
	config.set_value("audio", "sfx_volume", sfx_volume)
	config.set_value("video", "fullscreen", fullscreen)
	config.set_value("video", "resolution", resolution)
	config.set_value("controls", "drag_with_right_click", drag_with_right_click)
	config.save(SAVE_PATH)

func load_settings() -> void:
	var config = ConfigFile.new()
	if config.load(SAVE_PATH) == OK:
		music_volume = config.get_value("audio", "music_volume", music_volume)
		sfx_volume = config.get_value("audio", "sfx_volume", sfx_volume)
		fullscreen = config.get_value("video", "fullscreen", fullscreen)
		resolution = config.get_value("video", "resolution", resolution)
		drag_with_right_click = config.get_value("controls", "drag_with_right_click", drag_with_right_click)

func apply_video_settings() -> void:
	var current_mode = DisplayServer.window_get_mode()
	
	if fullscreen:
		if current_mode != DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN and current_mode != DisplayServer.WINDOW_MODE_FULLSCREEN:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN)
	else:
		if current_mode != DisplayServer.WINDOW_MODE_WINDOWED:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
			DisplayServer.window_set_size(resolution)
			# Center the window on the current screen (float division to avoid INTEGER_DIVISION warning)
			var screen = DisplayServer.window_get_current_screen()
			var screen_size = DisplayServer.screen_get_size(screen)
			var target_pos = Vector2(screen_size - resolution) / 2.0
			DisplayServer.window_set_position(Vector2i(target_pos))
		else:
			# Si ya es modo ventana, solo cambiar tamaño si la resolución difiere
			var current_size = DisplayServer.window_get_size()
			if current_size != resolution:
				DisplayServer.window_set_size(resolution)
				var screen = DisplayServer.window_get_current_screen()
				var screen_size = DisplayServer.screen_get_size(screen)
				var target_pos = Vector2(screen_size - resolution) / 2.0
				DisplayServer.window_set_position(Vector2i(target_pos))
