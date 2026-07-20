shader_type canvas_item;

uniform float progress : hint_range(0.0, 1.0) = 0.0;
uniform color_glow : source_color = Color(0.0, 0.94, 1.0, 1.0);
uniform float grid_size = 40.0;

void fragment() {
	vec2 uv = SCREEN_UV;
	
	// Crear un efecto de barrido de izquierda a derecha
	float sweep = step(uv.x, progress);
	
	// Si el barrido está activo, pintar el color base oscuro con una rejilla táctica holográfica
	if (sweep > 0.0) {
		// Color de fondo oscuro (combinando con el cian)
		vec4 bg_color = Color(0.007, 0.047, 0.078, 1.0);
		
		// Crear líneas de cuadrícula digital
		float grid_line_x = step(0.95, fract(uv.x * grid_size));
		float grid_line_y = step(0.95, fract(uv.y * (grid_size * 0.5625))); // Proporcion 16:9 aprox
		float grid = max(grid_line_x, grid_line_y);
		
		// Tinte de borde del barrido (holograma brillante)
		float edge = smoothstep(progress - 0.05, progress, uv.x) * (1.0 - step(progress, uv.x));
		
		vec4 final_color = mix(bg_color, color_glow, grid * 0.25);
		final_color = mix(final_color, color_glow, edge * 0.8);
		
		COLOR = final_color;
	} else {
		COLOR = vec4(0.0);
	}
}
