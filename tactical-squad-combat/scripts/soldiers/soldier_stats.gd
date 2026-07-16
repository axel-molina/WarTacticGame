extends Resource
class_name SoldierStats

@export var class_data: SoldierClassData

var hp: int
var max_hp: int
var shield: int
var max_shield: int
var ammo: int
var max_ammo: int
var ap: int
var max_ap: int = 2
var cooldowns: Dictionary = {}

func init_stats(data: SoldierClassData) -> void:
	class_data = data
	hp = data.max_hp
	max_hp = data.max_hp
	shield = data.max_shield
	max_shield = data.max_shield
	ammo = data.max_ammo
	max_ammo = data.max_ammo
	ap = max_ap
