extends Node

# Global signals for decoupling systems
@warning_ignore("unused_signal")
signal soldier_selected(soldier)
@warning_ignore("unused_signal")
signal action_selected(action_name)
@warning_ignore("unused_signal")
signal cell_hovered(grid_pos)
@warning_ignore("unused_signal")
signal cell_clicked(grid_pos)
@warning_ignore("unused_signal")
signal turn_changed(new_owner) # "player" or "enemy"
@warning_ignore("unused_signal")
signal combat_log_added(message, type)
