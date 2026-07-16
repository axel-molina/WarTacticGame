@warning_ignore("unused_signal")
extends Node

# Global signals for decoupling systems
signal soldier_selected(soldier)
signal action_selected(action_name)
signal cell_hovered(grid_pos)
signal cell_clicked(grid_pos)
signal turn_changed(new_owner) # "player" or "enemy"
signal combat_log_added(message, type)
