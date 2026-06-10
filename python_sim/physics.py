import math
import random
import pymunk
from typing import List, Tuple, Optional
from config_parser import SimulatorConfig
from math_utils import point_in_polygon, point_in_arc, get_rect_vertices, rotate_point

class Parcel:
    def __init__(self, id: str, body: pymunk.Body, shape: pymunk.Poly, label: str, color: str):
        self.id = id
        self.body = body
        self.shape = shape
        self.label = label
        self.color = color
        self.max_extent = max(math.hypot(v.x, v.y) for v in shape.get_vertices()) if hasattr(shape, 'get_vertices') else 0.5

class PhysicsEngine:
    # ShapeFilter category bitmasks
    CATEGORY_WALL   = 0b01
    CATEGORY_PARCEL = 0b10
    # collision_type integers used by space.on_collision()
    COLLISION_TYPE_WALL   = 1
    COLLISION_TYPE_PARCEL = 2

    def __init__(self, config: SimulatorConfig):
        self.config = config
        self.space = pymunk.Space()
        self.space.gravity = (0, 0)
        self.space.damping = 0.1 # High damping for top-down
        
        self.parcels: List[Parcel] = []
        self.static_walls: List[pymunk.Shape] = []
        self.parcel_id_counter = 0
        self.sensor_states = {}  # {sensor.id: bool | str}
        
        # Sources timing — new sources added at runtime will be lazily initialised
        self.source_timers = {source.id: 0.0 for source in self.config.sources}
        
        # self.build_walls()
        self._setup_collision_handlers()

    def _setup_collision_handlers(self):
        """Install a parcel-parcel collision handler that eliminates bouncing.
        
        Uses space.on_collision(type_a, type_b) — the correct API for this
        pymunk version. Parcel shapes must have collision_type=COLLISION_TYPE_PARCEL.
        """
        def _pre_solve_parcel_parcel(arbiter: pymunk.Arbiter, space, data):
            # Zero restitution — no bounce between parcel bodies.
            # Low friction so touching parcels don’t spin each other.
            arbiter.restitution = 0.0
            arbiter.friction    = 0.1
            # process_collision=True keeps the physical separation response
            # (prevents overlap), but with zero bounce.
            arbiter.process_collision = True

        self.space.on_collision(
            self.COLLISION_TYPE_PARCEL,
            self.COLLISION_TYPE_PARCEL,
            pre_solve=_pre_solve_parcel_parcel
        )

    def _is_point_on_belt(self, px: float, py: float, belt) -> bool:
        """Returns True if the point (px, py) is physically on the given belt."""
        if belt.type == "linear":
            if getattr(belt, 'shape', 'rectangle') == 'quadrilateral':
                pts = belt.trianglePoints
                if not pts:
                    hw = belt.length / 2.0
                    hh = belt.beltWidth / 2.0
                    pts = [{'x': -hw, 'y': -hh}, {'x': hw, 'y': -hh}, {'x': hw, 'y': hh}, {'x': -hw, 'y': hh}]
                verts = []
                for pt in pts:
                    rx, ry = rotate_point(0, 0, belt.rotation, pt['x'], pt['y'])
                    verts.append((belt.x + rx, belt.y + ry))
            else:
                verts = get_rect_vertices(belt.x, belt.y, belt.length, belt.beltWidth, belt.rotation)
            return point_in_polygon(px, py, verts)
        elif belt.type == "curved":
            return point_in_arc(px, py, belt.x, belt.y, belt.radius, belt.beltWidth, belt.startAngle, belt.endAngle)
        return False

    def build_walls(self):
        # Remove old walls if any
        if self.static_walls:
            self.space.remove(*self.static_walls)
            self.static_walls.clear()
            
        static_body = self.space.static_body
        
        def add_clipped_segment(p1, p2, current_belt):
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            length = math.hypot(dx, dy)
            if length < 1e-5: return
            
            step = 0.2
            num_steps = max(1, int(length / step))
            
            prev_pt = p1
            for i in range(1, num_steps + 1):
                t = i / num_steps
                curr_pt = (p1[0] + dx * t, p1[1] + dy * t)
                
                mid_x = (prev_pt[0] + curr_pt[0]) / 2.0
                mid_y = (prev_pt[1] + curr_pt[1]) / 2.0
                
                inside_other = False
                for other_belt in self.config.belts:
                    if other_belt.id == current_belt.id: continue
                    if self._is_point_on_belt(mid_x, mid_y, other_belt):
                        inside_other = True
                        break
                
                if not inside_other:
                    edge = pymunk.Segment(static_body, prev_pt, curr_pt, 0.0)
                    edge.elasticity = 0.0
                    edge.friction   = 0.0
                    edge.filter = pymunk.ShapeFilter(
                        categories=self.CATEGORY_WALL,
                        mask=self.CATEGORY_PARCEL
                    )
                    self.static_walls.append(edge)
                    self.space.add(edge)
                
                prev_pt = curr_pt

        for belt in self.config.belts:
            if belt.type == "linear":
                if getattr(belt, 'shape', 'rectangle') == 'quadrilateral':
                    pts = belt.trianglePoints
                    if not pts:
                        hw = belt.length / 2.0
                        hh = belt.beltWidth / 2.0
                        pts = [{'x': -hw, 'y': -hh}, {'x': hw, 'y': -hh}, {'x': hw, 'y': hh}, {'x': -hw, 'y': hh}]
                    verts = []
                    for pt in pts:
                        rx, ry = rotate_point(0, 0, belt.rotation, pt['x'], pt['y'])
                        verts.append((belt.x + rx, belt.y + ry))
                else:
                    verts = get_rect_vertices(belt.x, belt.y, belt.length, belt.beltWidth, belt.rotation)
                # v0 to v1 is length (top wall), v2 to v3 is bottom wall.
                add_clipped_segment(verts[0], verts[1], belt)
                add_clipped_segment(verts[2], verts[3], belt)
                    
            elif belt.type == "curved":
                # Generate segments for inner and outer arcs
                angle_diff = belt.endAngle - belt.startAngle
                if angle_diff <= 0:
                    angle_diff += 360
                    
                segments = max(10, int(belt.radius * math.radians(angle_diff) / 5))
                inner_r = belt.radius - belt.beltWidth / 2.0
                outer_r = belt.radius + belt.beltWidth / 2.0
                
                s_rad = math.radians(belt.startAngle)
                e_rad = math.radians(belt.startAngle + angle_diff)
                
                for r in [inner_r, outer_r]:
                    prev_pt = None
                    for i in range(segments + 1):
                        angle = s_rad + (e_rad - s_rad) * (i / segments)
                        px = belt.x + r * math.cos(angle)
                        py = belt.y + r * math.sin(angle)
                        if prev_pt:
                            add_clipped_segment(prev_pt, (px, py), belt)
                        prev_pt = (px, py)

    def _get_belt_velocity_at(self, px: float, py: float):
        """Returns (vx, vy) of the belt under point (px, py), or None if not on any belt."""
        vs = []
        hit = False
        for belt in self.config.belts:
            if self._is_point_on_belt(px, py, belt):
                hit = True
                if belt.type == "linear":
                    rad = math.radians(belt.rotation + belt.directionAngle)
                    vs.append((belt.speed * math.cos(rad), belt.speed * math.sin(rad)))

                elif belt.type == "curved":
                    dx = px - belt.x
                    dy = py - belt.y
                    dist = math.hypot(dx, dy)
                    if dist < 1e-6:
                        continue
                    # Tangent velocity proportional to radius (v = w * r)
                    # This ensures parcels rotate correctly without slipping
                    speed_at_dist = belt.speed * (dist / belt.radius)
                    
                    direction = 1 if getattr(belt, 'directionAngle', 0) > 0 else -1
                    tx = -dy / dist * direction
                    ty =  dx / dist * direction
                    vs.append((speed_at_dist * tx, speed_at_dist * ty))

        if hit:
            vx = sum(v[0] for v in vs) / len(vs)
            vy = sum(v[1] for v in vs) / len(vs)
            return (vx, vy)
        return None

    def handle_sources(self, dt: float):
        for source in self.config.sources:
            # Lazy-init timer for sources added at runtime via the editor
            self.source_timers[source.id] = self.source_timers.get(source.id, 0.0) + dt
            if self.source_timers[source.id] >= source.interval:
                # Time to spawn!
                w = random.uniform(
                    getattr(source, 'minWidth', 0.3),
                    getattr(source, 'maxWidth', 0.5)
                )
                h = random.uniform(
                    getattr(source, 'minHeight', 0.3),
                    getattr(source, 'maxHeight', 0.5)
                )
                
                # Check if spawn area is clear using exact shape overlap query
                sx, sy = source.x, source.y
                
                temp_body = pymunk.Body(body_type=pymunk.Body.STATIC)
                temp_body.position = (sx, sy)
                temp_shape = pymunk.Poly.create_box(temp_body, (w, h))
                
                query_results = self.space.shape_query(temp_shape)
                
                conflict = False
                for info in query_results:
                    if info.shape.filter.categories & self.CATEGORY_PARCEL:
                        conflict = True
                        break
                        
                if not conflict:
                    # Spawn
                    mass = 1.0
                    moment = pymunk.moment_for_box(mass, (w, h))
                    body = pymunk.Body(mass, moment)
                    body.position = (sx, sy)
                    # body.angle = random.uniform(0, 2 * math.pi)
                    body.angle = math.radians(source.rotation)
                    shape = pymunk.Poly.create_box(body, (w, h))
                    shape.friction       = 0.3
                    shape.elasticity     = 0.0   # no parcel-parcel bounce
                    shape.collision_type = self.COLLISION_TYPE_PARCEL
                    shape.filter = pymunk.ShapeFilter(
                        categories=self.CATEGORY_PARCEL,
                        mask=self.CATEGORY_WALL | self.CATEGORY_PARCEL
                    )
                    
                    self.space.add(body, shape)
                    self.parcel_id_counter += 1
                    parcel = Parcel(
                        id=f"p_{self.parcel_id_counter}",
                        body=body,
                        shape=shape,
                        label=getattr(source, 'label', 'PKG'),
                        color="#ffaa00"
                    )
                    self.parcels.append(parcel)
                    self.source_timers[source.id] = 0.0 # reset timer only if spawned

    def handle_sinks(self):
        to_remove = []
        for parcel in self.parcels:
            px, py = parcel.body.position
            for sink in self.config.sinks:
                verts = get_rect_vertices(sink.x, sink.y, sink.width, sink.height, 0)
                if point_in_polygon(px, py, verts):
                    to_remove.append(parcel)
                    break
                    
        for p in to_remove:
            self.space.remove(p.body, p.shape)
            self.parcels.remove(p)

    def apply_conveyor_kinematics(self):
        """Drive each parcel using the belt velocity sampled at its center + 4 corners.
        Applies forces/impulses at each vertex to naturally induce rotation and handle transitions.
        """
        for parcel in self.parcels:
            pos = parcel.body.position

            # Build sample points: center (weight 2) + 4 corners (weight 1 each)
            sample_pts = [(pos.x, pos.y)] #(pos.x, pos.y)
            for v in parcel.shape.get_vertices():
                wv = pos + v.rotated(parcel.body.angle)
                sample_pts.append((wv.x, wv.y))

            belt_vels = [ self._get_belt_velocity_at(sp[0], sp[1]) for sp in sample_pts ]

            belt_vels_minx = 0.0
            belt_vels_miny = 0.0
            belt_vels_maxx = 0.0
            belt_vels_maxy = 0.0
            
            if belt_vels:
                vx = [bv[0] for bv in belt_vels if bv is not None]
                vy = [bv[1] for bv in belt_vels if bv is not None]
                if vx and vy:
                    belt_vels_minx = min(vx)
                    belt_vels_miny = min(vy)
                    belt_vels_maxx = max(vx)
                    belt_vels_maxy = max(vy)
            belt_vels[0] = (0.5*(belt_vels_minx + belt_vels_maxx), 0.5*(belt_vels_miny + belt_vels_maxy))
        

            # print(f"MinX: {belt_vels_minx}, MaxX: {belt_vels_maxx}, MinY: {belt_vels_miny}, MaxY: {belt_vels_maxy}")
            

            # smooth the velocity
            # smooth_factor = 0.1
            # for idx, belt_vel in enumerate(belt_vels):
            #     if belt_vel is not None:
            #         belt_vels[idx] = (belt_vel[0] * (1-smooth_factor) + belt_vels_minx * smooth_factor, belt_vel[1] * (1-smooth_factor) + belt_vels_miny * smooth_factor)
            # print(f"SmoothVels: {belt_vels}")
            
            any_hit = False
            for idx, belt_vel in enumerate(belt_vels):
                sp = sample_pts[idx]
                if belt_vel is not None:
                    any_hit = True
                    # Current velocity of the parcel at this specific world point
                    pt_vel = parcel.body.velocity_at_world_point(sp)
                    
                    # Difference between desired belt velocity and current velocity
                    dvx = belt_vel[0] - pt_vel.x
                    dvy = belt_vel[1] - pt_vel.y


                        
                    
                    # Apply a corrective impulse proportional to the difference.
                    # grip_factor: how strongly the belt grips the parcel (0=no grip, 1=instant lock)
                    # Kept < 1.0 to avoid over-correction oscillation when parcels touch each other.
                    grip_factor = 0.8
                    if idx == 0:
                        grip_factor = 0.3


                    friction_ratio = 0.2

                    if math.fabs(belt_vel[0]) < 0.01 and math.fabs(dvx) > 0.01:
                        dvx = friction_ratio * dvx
                    if math.fabs(belt_vel[1]) < 0.01 and math.fabs(dvy) > 0.01:
                        dvy = friction_ratio * dvy
                        
                    mass_per_pt = parcel.body.mass / len(sample_pts)
                    ix = dvx * mass_per_pt * grip_factor
                    iy = dvy * mass_per_pt * grip_factor

                    # Cap impulse magnitude to avoid violent snapping
                    MAX_IMPULSE = 0.5 * parcel.body.mass / len(sample_pts)
                    imp_mag = math.hypot(ix, iy)
                    if imp_mag > MAX_IMPULSE:
                        scale = MAX_IMPULSE / imp_mag
                        ix *= scale
                        iy *= scale

                    parcel.body.apply_impulse_at_world_point((ix, iy), sp)
                    # parcel.body.velocity_at_world_point(belt_vel,sp)
                    
                


            if not any_hit:
                # Completely off all belts — damp velocities so it doesn't coast forever
                parcel.body.velocity *= 0.9
                parcel.body.angular_velocity *= 0.9

    def evaluate_sensors(self):
        """Compute sensor states based on current parcel positions using efficient Pymunk queries."""
        import math
        
        # Get set of all shapes belonging to active parcels
        parcel_shapes = {shape for p in self.parcels for shape in p.body.shapes}
        
        for sensor in self.config.sensors:
            if sensor.sensorType == "ir":
                # Sensor diagonal extent
                sensor_max_extent = math.hypot(sensor.width / 2.0, sensor.height / 2.0)
                
                # Pre-filter close parcels
                close_parcels = []
                for p in self.parcels:
                    dx = p.body.position.x - sensor.x
                    dy = p.body.position.y - sensor.y
                    if math.hypot(dx, dy) <= (sensor_max_extent + p.max_extent):
                        close_parcels.append(p)
                
                if not close_parcels:
                    self.sensor_states[sensor.id] = False
                    continue
                
                # Query the space using a temporary static sensor shape
                temp_body = pymunk.Body(body_type=pymunk.Body.STATIC)
                temp_body.position = (sensor.x, sensor.y)
                temp_body.angle = math.radians(sensor.rotation)
                
                sensor_shape = pymunk.Poly.create_box(temp_body, (sensor.width, sensor.height))
                query_results = self.space.shape_query(sensor_shape)
                
                triggered = False
                for info in query_results:
                    if info.shape in parcel_shapes:
                        triggered = True
                        break
                self.sensor_states[sensor.id] = triggered

            elif sensor.sensorType == "laser_banner":
                laser_count_val = getattr(sensor, 'laserCount', 16)
                laser_count = int(laser_count_val) if laser_count_val is not None else 16
                beam_dist_val = getattr(sensor, 'beamDistance', 0.05)
                beam_dist = float(beam_dist_val) if beam_dist_val is not None else 0.05
                
                angle = sensor.rotation
                rad = math.radians(angle)
                cos_a = math.cos(rad)
                sin_a = math.sin(rad)
                
                # Pre-filter using distance checks
                sensor_max_extent = math.hypot(sensor.width / 2.0, (laser_count - 1) * beam_dist / 2.0)
                close_parcels = []
                for p in self.parcels:
                    dx = p.body.position.x - sensor.x
                    dy = p.body.position.y - sensor.y
                    if math.hypot(dx, dy) <= (sensor_max_extent + p.max_extent):
                        close_parcels.append(p)
                
                if not close_parcels:
                    self.sensor_states[sensor.id] = "0" * laser_count
                    continue
                
                # Only check shapes of parcels that are close
                close_shapes = {shape for p in close_parcels for shape in p.body.shapes}
                
                bits = []
                for i in range(laser_count):
                    by = (i - (laser_count - 1) / 2.0) * beam_dist
                    
                    # Local points of the horizontal beam segment (spanning sensor width)
                    lx_start, ly_start = -sensor.width / 2.0, by
                    lx_end, ly_end = sensor.width / 2.0, by
                    
                    # Transform to World coordinates
                    x_start = sensor.x + lx_start * cos_a - ly_start * sin_a
                    y_start = sensor.y + lx_start * sin_a + ly_start * cos_a
                    x_end = sensor.x + lx_end * cos_a - ly_end * sin_a
                    y_end = sensor.y + lx_end * sin_a + ly_end * cos_a
                    
                    # Segment query to check intersection with the beam line
                    hits = self.space.segment_query((x_start, y_start), (x_end, y_end), radius=0, shape_filter=pymunk.ShapeFilter())
                    
                    blocked = False
                    for hit in hits:
                        if hit.shape in close_shapes:
                            blocked = True
                            break
                    bits.append("1" if blocked else "0")
                self.sensor_states[sensor.id] = "".join(bits)

    def update(self, dt: float):
        sub_steps = getattr(self.config, 'simulationSteps', 4)
        if sub_steps <= 0: sub_steps = 1
        
        sub_dt = dt / sub_steps
        
        for _ in range(sub_steps):
            self.handle_sources(sub_dt)
            self.apply_conveyor_kinematics()
            self.space.step(sub_dt)
            self.handle_sinks()
            
        # Sensor evaluation once per frame (not per sub-step)
        self.evaluate_sensors()
