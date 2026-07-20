extends Node

# Dictionary to hold AudioStreamPlayer nodes for non-3D sounds
var _sfx_players: Array[AudioStreamPlayer] = []
var _music_player: AudioStreamPlayer = null

# Preloaded streams
var streams = {
	"menu_theme": preload("res://sounds/Turn_Order_Fury.mp3"),
	"ui_hover": preload("res://sounds/ui/hover_menu_sound.mp3"), 
	"ui_click_menu": preload("res://sounds/ui/click_menu_sound.mp3"),
	"ui_error": preload("res://sounds/ui/error_sound.mp3"),
	"ui_hover_combat": preload("res://sounds/ui/hover_combat_sound.mp3"),
	"fire_rifle": preload("res://sounds/fire.mp3"),
	"fire_shotgun": preload("res://sounds/shotgun fire.mp3"),
	"reload_rifle": preload("res://sounds/recharge.mp3"),
	"reload_shotgun": preload("res://sounds/shotgun recharge.mp3"),
	"hit": preload("res://sounds/hit.ogg"),
	"death_1": preload("res://sounds/death_1.wav"),
	"death_2": preload("res://sounds/death_2.wav"),
	"death_3": preload("res://sounds/death_3.wav"),
	"grenade_explosion": preload("res://sounds/granade_explosion.mp3"),
	"victory_sound": preload("res://sounds/victory_sound.mp3"),
}

func _ready() -> void:
	# Set up music player
	_music_player = AudioStreamPlayer.new()
	_music_player.bus = "Music"
	add_child(_music_player)
	
	# Create pool of 8 AudioStreamPlayers for SFX
	for i in range(8):
		var p = AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		_sfx_players.append(p)

func stop_music() -> void:
	if _music_player and _music_player.playing:
		_music_player.stop()

func play_music(music_key: String) -> void:
	if not streams.has(music_key) or streams[music_key] == null:
		return
	if _music_player.playing and _music_player.stream == streams[music_key]:
		return
	_music_player.stream = streams[music_key]
	_music_player.volume_db = linear_to_db(SettingsManager.music_volume)
	_music_player.play()

func stop_music() -> void:
	_music_player.stop()

func play_sfx(sfx_key: String) -> void:
	if not streams.has(sfx_key) or streams[sfx_key] == null:
		return
	
	# Find available player
	var player: AudioStreamPlayer = null
	for p in _sfx_players:
		if not p.playing:
			player = p
			break
	if not player:
		player = _sfx_players[0] # Overwrite first one if all busy
		
	player.stream = streams[sfx_key]
	player.volume_db = linear_to_db(SettingsManager.sfx_volume)
	player.play()

# Plays a 3D sound at a specific position (returns node so it can be managed)
func play_sfx_3d(sfx_key: String, global_pos: Vector3) -> AudioStreamPlayer3D:
	if not streams.has(sfx_key) or streams[sfx_key] == null:
		return null
		
	var player3d = AudioStreamPlayer3D.new()
	player3d.stream = streams[sfx_key]
	player3d.bus = "SFX"
	player3d.volume_db = linear_to_db(SettingsManager.sfx_volume)
	
	# Add to root scene so it positions correctly
	get_tree().current_scene.add_child(player3d)
	player3d.global_position = global_pos
	player3d.play()
	
	# Auto destroy on finish
	player3d.finished.connect(func(): player3d.queue_free())
	return player3d

# Updates volumes dynamically when options change
func update_volumes() -> void:
	if _music_player and _music_player.playing:
		_music_player.volume_db = linear_to_db(SettingsManager.music_volume)
	
	# We can't update active 2D SFX without tracking, but future ones will load new volume
