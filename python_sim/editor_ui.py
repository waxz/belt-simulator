import pygame
import pygame_gui
from config_parser import Belt, Sensor, Source, Sink

class EditorUI:
    def __init__(self, manager: pygame_gui.UIManager, width: int, height: int):
        self.manager = manager
        self.width = width
        self.height = height
        
        # Save Button
        self.save_btn = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(10, 10, 100, 30),
            text='Save Layout',
            manager=self.manager
        )
        
        # Toolbar (Left)
        self.toolbar_panel = pygame_gui.elements.UIPanel(
            relative_rect=pygame.Rect(10, 50, 120, 200),
            manager=self.manager
        )
        self.add_linear_btn = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(10, 10, 100, 30),
            text='+ Linear Belt',
            manager=self.manager,
            container=self.toolbar_panel
        )
        self.add_curved_btn = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(10, 50, 100, 30),
            text='+ Curved Belt',
            manager=self.manager,
            container=self.toolbar_panel
        )
        self.add_sensor_btn = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(10, 90, 100, 30),
            text='+ Sensor',
            manager=self.manager,
            container=self.toolbar_panel
        )
        self.add_source_btn = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(10, 130, 100, 30),
            text='+ Source',
            manager=self.manager,
            container=self.toolbar_panel
        )
        self.add_sink_btn = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(10, 170, 100, 30),
            text='+ Sink',
            manager=self.manager,
            container=self.toolbar_panel
        )
        
        # Properties Panel (Right)
        self.prop_panel = pygame_gui.elements.UIPanel(
            relative_rect=pygame.Rect(self.width - 250, 0, 250, self.height),
            manager=self.manager
        )
        
        self.prop_labels = {}
        self.prop_inputs = {}
        
        # Extended list of all possible properties across all components
        all_props = [
            "id", "x", "y","speed" ,"rotation", "length", "beltWidth", 
            "radius", "startAngle", "endAngle", "directionAngle", 
            "width", "height", "sensorType", "laserCount", "beamDistance",
            "interval", "minWidth", "maxWidth", "minHeight", "maxHeight", "label","beltShape","beltVertexs"
        ]
        
        # Short display names to keep labels from overflowing
        display_names = {
            "directionAngle": "DirectionAngle",
            "beltWidth": "Width",
            "startAngle": "StartAng",
            "endAngle": "EndAng",
            "sensorType": "Type",
            "laserCount": "Beams",
            "beamDistance": "BeamDist",
            "minWidth": "MinW",
            "maxWidth": "MaxW",
            "minHeight": "MinH",
            "maxHeight": "MaxH",
            "beltVertexs":"BeltVertexs",
            "beltShape":"BeltShape",
            "speed":"Speed"
        }
        
        y_offset = 10
        for prop in all_props:
            disp = display_names.get(prop, prop.capitalize())
            lbl = pygame_gui.elements.UILabel(
                relative_rect=pygame.Rect(5, y_offset, 100, 28),
                text=disp + ":",
                manager=self.manager,
                container=self.prop_panel
            )
            if prop == "sensorType":
                inp = pygame_gui.elements.UIDropDownMenu(
                    options_list=["ir", "laser_banner"],
                    starting_option="ir",
                    relative_rect=pygame.Rect(108, y_offset, 127, 28),
                    manager=self.manager,
                    container=self.prop_panel
                )
            elif prop == "beltShape":
                inp = pygame_gui.elements.UIDropDownMenu(
                    options_list=["rectangle", "quadrilateral"],
                    starting_option="rectangle",
                    relative_rect=pygame.Rect(108, y_offset, 127, 28),
                    manager=self.manager,
                    container=self.prop_panel
                )
            else:
                inp = pygame_gui.elements.UITextEntryLine(
                    relative_rect=pygame.Rect(108, y_offset, 127, 28),
                    manager=self.manager,
                    container=self.prop_panel
                )
            self.prop_labels[prop] = lbl
            self.prop_inputs[prop] = inp
            y_offset += 33
            
        self.selected_item = None
        self.hide_all_props()
        
        # Sensor state read-only display (bottom of props panel)
        self.sensor_state_lbl = pygame_gui.elements.UILabel(
            relative_rect=pygame.Rect(5, y_offset + 5, 235, 28),
            text="State: --",
            manager=self.manager,
            container=self.prop_panel
        )
        self.sensor_state_lbl.hide()

    def hide_all_props(self):
        for lbl in self.prop_labels.values():
            lbl.hide()
        for inp in self.prop_inputs.values():
            inp.hide()
        # Guard: sensor_state_lbl is created after hide_all_props is first called in __init__
        lbl = getattr(self, 'sensor_state_lbl', None)
        if lbl:
            lbl.hide()

    def show_props_for(self, item):
        self.selected_item = item
        self.hide_all_props()
        if not item:
            return
            
        props_to_show = ["id", "x", "y", "rotation","speed"]
        if isinstance(item, Belt):
            props_to_show.append("directionAngle")
            if item.type == "linear":
                props_to_show += ["length", "beltWidth", "beltShape"]
                if getattr(item, "shape", "rectangle") == "quadrilateral":
                    props_to_show.append("beltVertexs")
            elif item.type == "curved":
                props_to_show += ["radius", "beltWidth", "startAngle", "endAngle"]
        elif isinstance(item, Sensor):
            props_to_show += ["width", "height", "sensorType", "label"]
            if item.sensorType == "laser_banner":
                props_to_show += ["laserCount", "beamDistance"]
            # Show the live state label
            self.sensor_state_lbl.set_text("State: --")
            self.sensor_state_lbl.show()
        elif isinstance(item, Source):
            props_to_show = ["id", "x", "y", "rotation","interval", "minWidth", "maxWidth", "minHeight", "maxHeight", "label"]
        elif isinstance(item, Sink):
            props_to_show = ["id", "x", "y", "width", "height", "label"]
            
        for p in props_to_show:
            if p in self.prop_inputs:
                self.prop_labels[p].show()
                self.prop_inputs[p].show()
                
                # Map UI property names to model attributes
                attr_name = p
                if p == "beltShape":
                    attr_name = "shape"
                elif p == "beltVertexs":
                    attr_name = "trianglePoints"
                
                val = getattr(item, attr_name, "")
                
                if p == "beltVertexs":
                    if not val:
                        # Default points if not set
                        hw = getattr(item, 'length', 2.0) / 2.0
                        hh = getattr(item, 'beltWidth', 1.0) / 2.0
                        val = [{'x': -hw, 'y': -hh}, {'x': hw, 'y': -hh}, {'x': hw, 'y': hh}, {'x': -hw, 'y': hh}]
                    val_str = "; ".join(f"{pt['x']:.2f},{pt['y']:.2f}" for pt in val)
                elif isinstance(val, float):
                    val_str = str(round(val, 3))
                else:
                    val_str = str(val)
                
                if p == "sensorType":
                    self.prop_inputs[p].kill()
                    self.prop_inputs[p] = pygame_gui.elements.UIDropDownMenu(
                        options_list=["ir", "laser_banner"],
                        starting_option=val_str,
                        relative_rect=pygame.Rect(108, self.prop_labels[p].relative_rect.top, 127, 28),
                        manager=self.manager,
                        container=self.prop_panel
                    )
                elif p == "beltShape":
                    self.prop_inputs[p].kill()
                    self.prop_inputs[p] = pygame_gui.elements.UIDropDownMenu(
                        options_list=["rectangle", "quadrilateral"],
                        starting_option=val_str,
                        relative_rect=pygame.Rect(108, self.prop_labels[p].relative_rect.top, 127, 28),
                        manager=self.manager,
                        container=self.prop_panel
                    )
                else:
                    self.prop_inputs[p].set_text(val_str)

    def handle_event(self, event) -> str:
        """Returns commands or None."""
        if event.type == pygame_gui.UI_BUTTON_PRESSED:
            if event.ui_element == self.save_btn:
                return "SAVE_DIALOG"
            elif event.ui_element == self.add_linear_btn:
                return "ADD_LINEAR"
            elif event.ui_element == self.add_curved_btn:
                return "ADD_CURVED"
            elif event.ui_element == self.add_sensor_btn:
                return "ADD_SENSOR"
            elif event.ui_element == self.add_source_btn:
                return "ADD_SOURCE"
            elif event.ui_element == self.add_sink_btn:
                return "ADD_SINK"
                
        if event.type == pygame_gui.UI_DROP_DOWN_MENU_CHANGED and self.selected_item:
            if event.ui_element == self.prop_inputs.get("sensorType"):
                val_str = event.text
                setattr(self.selected_item, "sensorType", val_str)
                self.show_props_for(self.selected_item)
            elif event.ui_element == self.prop_inputs.get("beltShape"):
                val_str = event.text
                setattr(self.selected_item, "shape", val_str)
                # Auto-initialize default vertices if switched to quadrilateral
                if val_str == "quadrilateral" and not getattr(self.selected_item, "trianglePoints", None):
                    hw = getattr(self.selected_item, 'length', 2.0) / 2.0
                    hh = getattr(self.selected_item, 'beltWidth', 1.0) / 2.0
                    self.selected_item.trianglePoints = [
                        {'x': -hw, 'y': -hh}, {'x': hw, 'y': -hh}, {'x': hw, 'y': hh}, {'x': -hw, 'y': hh}
                    ]
                self.show_props_for(self.selected_item)
                
        if event.type == pygame_gui.UI_TEXT_ENTRY_CHANGED and self.selected_item:
            # Find which input changed
            for prop, inp in self.prop_inputs.items():
                if event.ui_element == inp:
                    val_str = inp.get_text()
                    try:
                        attr_name = prop
                        if prop == "beltShape":
                            attr_name = "shape"
                        elif prop == "beltVertexs":
                            attr_name = "trianglePoints"
                        
                        if attr_name == "trianglePoints":
                            # Parse string of format "x0,y0; x1,y1; x2,y2; x3,y3"
                            parts = val_str.split(';')
                            pts = []
                            for part in parts:
                                part = part.strip()
                                if not part: continue
                                coords = part.split(',')
                                if len(coords) == 2:
                                    pts.append({'x': float(coords[0]), 'y': float(coords[1])})
                            if len(pts) == 4:
                                setattr(self.selected_item, attr_name, pts)
                        else:
                            existing_val = getattr(self.selected_item, attr_name, "")
                            if isinstance(existing_val, float):
                                setattr(self.selected_item, attr_name, float(val_str))
                            elif isinstance(existing_val, int):
                                setattr(self.selected_item, attr_name, int(val_str))
                            else:
                                setattr(self.selected_item, attr_name, val_str)
                        
                        # Trigger UI refresh if layout-altering property changes
                        if prop in ["sensorType", "beltShape"]:
                            self.show_props_for(self.selected_item)
                            
                    except ValueError:
                        pass # Ignore invalid numbers
                        
        return None

    def update_sensor_state(self, sensor_states: dict):
        """Call every frame with the physics engine sensor_states dict to refresh display."""
        if not isinstance(self.selected_item, Sensor):
            return
        state = sensor_states.get(self.selected_item.id)
        if state is None:
            return
        if isinstance(state, bool):
            text = f"State: {'TRIGGERED' if state else 'clear'}"
            color = "#ff4444" if state else "#aaaaaa"
        else:
            # laser banner bit string
            text = f"Beams: {state}"
            color = "#44aaff"
        self.sensor_state_lbl.set_text(text)
