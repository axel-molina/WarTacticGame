extends Control

# --- Node References ---
@onready var btn_new_campaign: Button = $MenuContainer/BtnNewCampaign
@onready var btn_load_game: Button = $MenuContainer/BtnLoadGame
@onready var btn_skirmish: Button = $MenuContainer/BtnSkirmish
@onready var btn_customize: Button = $MenuContainer/BtnCustomize
@onready var btn_options: Button = $MenuContainer/BtnOptions
@onready var btn_credits: Button = $MenuContainer/BtnCredits
@onready var btn_quit: Button = $MenuContainer/BtnQuit

# Campaign setup panel
@onready var campaign_setup_panel: PanelContainer = $CampaignSetupPanel
@onready var btn_start_operation: Button = $CampaignSetupPanel/Margin/VBox/BtnStartOperation
@onready var btn_cancel_setup: Button = $CampaignSetupPanel/Margin/VBox/BtnCancelSetup

# Options panel
@onready var options_panel: PanelContainer = $OptionsPanel
@onready var slider_music: HSlider = $OptionsPanel/Margin/VBox/HBoxMusic/SliderMusic
@onready var slider_sfx: HSlider = $OptionsPanel/Margin/VBox/HBoxSFX/SliderSFX
@onready var check_fullscreen: CheckBox = $OptionsPanel/Margin/VBox/CheckFullscreen
@onready var opt_resolution: OptionButton = $OptionsPanel/Margin/VBox/HBoxRes/OptResolution
@onready var check_right_drag: CheckBox = $OptionsPanel/Margin/VBox/CheckRightDrag
@onready var check_auto_center: CheckBox = $OptionsPanel/Margin/VBox/CheckAutoCenter
@onready var btn_save_options: Button = $OptionsPanel/Margin/VBox/BtnSaveOptions

# Bottom buttons
@onready var btn_discord: Button = $BottomRightButtons/BtnDiscord
@onready var btn_manual: Button = $BottomRightButtons/BtnManual
@onready var btn_noticias: Button = $BottomRightButtons/BtnNoticias

func _ready() -> void:
	# Button connections
	btn_new_campaign.pressed.connect(_on_new_campaign)
	btn_load_game.pressed.connect(func(): EventBus.combat_log_added.emit("Cargar partida no disponible en MVP.", "info"))
	btn_skirmish.pressed.connect(_on_skirmish)
	btn_customize.pressed.connect(func(): EventBus.combat_log_added.emit("Personalización no disponible en MVP.", "info"))
	btn_options.pressed.connect(_on_options_pressed)
	btn_credits.pressed.connect(func(): EventBus.combat_log_added.emit("Créditos no disponibles en MVP.", "info"))
	btn_quit.pressed.connect(func(): get_tree().quit())
	
	btn_start_operation.pressed.connect(_on_start_operation)
	btn_cancel_setup.pressed.connect(func(): campaign_setup_panel.visible = false)
	
	# Options panel connections
	btn_save_options.pressed.connect(_on_save_options)
	slider_music.value_changed.connect(func(val):
		SettingsManager.music_volume = val
		AudioManager.update_volumes()
	)
	slider_sfx.value_changed.connect(func(val):
		SettingsManager.sfx_volume = val
		# Reproducir sonido corto de feedback para que el jugador escuche el nuevo volumen
		AudioManager.play_sfx("ui_hover")
	)
	
	# Hover and Click sounds for all buttons, plus color highlight for main menu options
	var main_menu_buttons = [btn_new_campaign, btn_load_game, btn_skirmish, btn_customize, btn_options, btn_credits, btn_quit]
	var all_buttons = main_menu_buttons + [btn_start_operation, btn_cancel_setup, btn_save_options]
	
	for btn in all_buttons:
		if btn:
			btn.mouse_entered.connect(func():
				if not btn.disabled:
					AudioManager.play_sfx("ui_hover")
					
					# Highlight text if it is a main menu option
					if btn in main_menu_buttons:
						var label = btn.get_node_or_null("Margin/HBox/VBox/LabelTitle")
						if label:
							label.add_theme_color_override("font_color", Color(0, 0.941, 1, 1))
			)
			btn.mouse_exited.connect(func():
				if not btn.disabled and btn in main_menu_buttons:
					var label = btn.get_node_or_null("Margin/HBox/VBox/LabelTitle")
					if label:
						label.add_theme_color_override("font_color", Color(0.7, 0.75, 0.8, 1))
			)
			btn.pressed.connect(func():
				if not btn.disabled:
					AudioManager.play_sfx("ui_click_menu")
			)
	
	# Disable buttons not available in MVP
	btn_load_game.disabled = true
	btn_customize.disabled = true
	btn_credits.disabled = true
	
	# Hide panels initially
	campaign_setup_panel.visible = false
	options_panel.visible = false
	
	# Play background music
	AudioManager.play_music("menu_theme")

func _on_new_campaign() -> void:
	campaign_setup_panel.visible = true
	options_panel.visible = false

func _on_options_pressed() -> void:
	# Load current settings into UI elements
	slider_music.value = SettingsManager.music_volume
	slider_sfx.value = SettingsManager.sfx_volume
	check_fullscreen.button_pressed = SettingsManager.fullscreen
	check_right_drag.button_pressed = SettingsManager.drag_with_right_click
	check_auto_center.button_pressed = SettingsManager.auto_center_camera
	
	# Asegurar que el selector de resolucion marque la resolucion cargada en disco
	if SettingsManager.resolution.x == 1280 and SettingsManager.resolution.y == 720:
		opt_resolution.selected = 0
	elif SettingsManager.resolution.x == 1920 and SettingsManager.resolution.y == 1080:
		opt_resolution.selected = 1
	else:
		# Si es otra resolucion nativa, no forzar item incorrecto
		opt_resolution.selected = -1
		
	options_panel.visible = true
	campaign_setup_panel.visible = false

func _on_save_options() -> void:
	# Read UI values into SettingsManager
	SettingsManager.fullscreen = check_fullscreen.button_pressed
	SettingsManager.drag_with_right_click = check_right_drag.button_pressed
	SettingsManager.auto_center_camera = check_auto_center.button_pressed
	
	# Guardar resolucion solo si el selector tiene un indice valido asignado
	if opt_resolution.selected == 0:
		SettingsManager.resolution = Vector2i(1280, 720)
	elif opt_resolution.selected == 1:
		SettingsManager.resolution = Vector2i(1920, 1080)
		
	# Apply and save config
	SettingsManager.apply_video_settings()
	SettingsManager.save_settings()
	
	options_panel.visible = false

func _on_skirmish() -> void:
	# Quick battle with default settings
	SceneTransition.change_scene("res://scenes/main/battle_scene.tscn")

func _on_start_operation() -> void:
	# Start campaign battle
	SceneTransition.change_scene("res://scenes/main/battle_scene.tscn")
