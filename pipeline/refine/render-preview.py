"""
render-preview.py — tbg-3d 资产精修 + 预览渲染（Blender 无头）

用法（headless）：
  blender --background --python render-preview.py -- <config.json>
  blender --background --python render-preview.py   # 用文件内 CONFIG 默认

config.json 字段：
  {
    "input":        "模型 glb 路径",
    "output_glb":   "精修后 glb 路径（可选，省略则覆盖 input）",
    "preview":      "preview.png 输出路径",
    "target_width_m": 6.0,     // 缩放使其水平最大边长（米），0 = 保持原尺寸
    "target_faces":   15000,   // 减面到 <= 该面数，0 = 不减面
    "solidify_m":     0.06,    // 给薄壳加厚（米），0 = 不加；镂空/薄屋顶建议 >0
    "preview_size":   300,     // 预览图边长（像素）
    "forward":        "-Y",    // 规范朝向；模型若朝向不对，绕 Z 旋转
    "camera_angle":   [1.0, -1.4, 1.0]  // 相机方位（未归一，相对模型中心）
  }

执行清单（pipeline/origin-rules.md）：
  导入 → 单位归一/缩放 → 轴心底部中心 → 减面 → 法线 → 导出 GLB → 渲染预览图
"""

import bpy
import json
import math
import os
import sys


def load_config():
    # 读 args 中 "--" 之后的第一个 json 文件；否则用内建 CONFIG
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if args and os.path.exists(args[0]):
        with open(args[0], "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "input": r"F:\zxc\Project\tbg-assets\kits\cn-ancient\components\roof\xuanshan-single-a\model.glb",
        "output_glb": r"C:\Users\Administrator\Documents\Codex\2026-09-02\tbg\work\roof-refined.glb",
        "preview": r"C:\Users\Administrator\Documents\Codex\2026-09-02\tbg\work\roof-preview.png",
        "target_width_m": 6.0,
        "target_faces": 15000,
        "preview_size": 300,
        "camera_angle": [1.0, -1.4, 1.0],
    }


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_model(path):
    bpy.ops.import_scene.gltf(filepath=path)


def mesh_objects():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def apply_transforms(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def world_bbox(objs):
    xs, ys, zs = [], [], []
    for o in objs:
        for corner in o.bound_box:
            wc = o.matrix_world @ __import__("mathutils").Vector(corner)
            xs.append(wc.x); ys.append(wc.y); zs.append(wc.z)
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def normalize_scale_and_origin(objs, target_width_m):
    (x0, x1), (y0, y1), (z0, z1) = world_bbox(objs)
    x_ext = max(x1 - x0, 1e-6)
    if target_width_m and target_width_m > 0:
        s = target_width_m / x_ext
        for o in objs:
            o.location = (o.location.x * s, o.location.y * s, o.location.z * s)
            o.scale = (o.scale.x * s, o.scale.y * s, o.scale.z * s)
        # 应用缩放
        for o in objs:
            apply_transforms(o)
        (x0, x1), (y0, y1), (z0, z1) = world_bbox(objs)
    # 轴心底部中心：X/Y 归零, 最低点在 z=0
    cx = (x0 + x1) / 2.0
    cy = (y0 + y1) / 2.0
    for o in objs:
        o.location.x -= cx
        o.location.y -= cy
        o.location.z -= z0
        apply_transforms(o)


def decimate(objs, target_faces):
    if not target_faces or target_faces <= 0:
        return
    for o in objs:
        cur = len(o.data.polygons)
        if cur <= target_faces:
            continue
        ratio = target_faces / cur
        mod = o.modifiers.new("dec", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = ratio
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)


def solidify(objs, thickness):
    """给薄壳网格加厚度（封底面），避免薄屋顶/瓦面从某些角度镂空。"""
    if not thickness or thickness <= 0:
        return
    for o in objs:
        m = o.modifiers.new("sol", "SOLIDIFY")
        m.thickness = thickness
        m.offset = -1.0   # 沿法线向内长厚，保留外表面
        m.use_rim = True
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    print(f"SOLIDIFY thickness={thickness}")


def downscale_textures(max_texture):
    """把内嵌贴图缩放到最大边 <= max_texture（游戏资产贴图 ≤1024）。"""
    if not max_texture or max_texture <= 0:
        return
    for img in bpy.data.images:
        if img.size[0] <= 0 or img.size[1] <= 0:
            continue
        if img.size[0] <= max_texture and img.size[1] <= max_texture:
            continue
        scale = max_texture / float(max(img.size[0], img.size[1]))
        new_w = max(1, int(img.size[0] * scale))
        new_h = max(1, int(img.size[1] * scale))
        img.scale(new_w, new_h)
        print(f"TEX_DOWNSCALE {img.name}: {img.size[0]}x{img.size[1]} -> {new_w}x{new_h}")


def export_glb(path, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)


def render_preview(out_path, objs, size):
    scene = bpy.context.scene
    # 世界背景：白
    world = bpy.data.worlds.new("W") if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (1, 1, 1, 1)
        bg.inputs[1].default_value = 1.4

    # 计算模型中心与尺寸
    (x0, x1), (y0, y1), (z0, z1) = world_bbox(objs)
    c = __import__("mathutils").Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    size_m = max(x1 - x0, y1 - y0, z1 - z0, 0.1)

    # 相机
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    ang = [1.0, -1.4, 1.0]  # 3/4 视角
    cam.location = c + __import__("mathutils").Vector(ang).normalized() * (size_m * 1.9)
    cam.rotation_euler = (__import__("mathutils").Vector(c - cam.location).to_track_quat("-Z", "Y").to_euler())
    cam_data.lens = 50
    scene.camera = cam

    # 灯光
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun = bpy.data.objects.new("Sun", sun_data)
    scene.collection.objects.link(sun)
    sun.location = c + __import__("mathutils").Vector((2, -3, 4)) * size_m
    sun.rotation_euler = (0.9, 0.2, 0.6)
    sun_data.energy = 4.5

    # 渲染设置
    scene.render.engine = "BLENDER_EEVEE_NEXT" if hasattr(bpy.app, "version") and bpy.app.version >= (4, 2) else "BLENDER_EEVEE"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)


def main():
    cfg = load_config()
    clean_scene()
    import_model(cfg["input"])
    objs = mesh_objects()
    if not objs:
        raise RuntimeError("未找到任何网格对象")

    for o in objs:
        apply_transforms(o)

    normalize_scale_and_origin(objs, cfg.get("target_width_m", 0))
    solidify(objs, cfg.get("solidify_m", 0))
    decimate(objs, cfg.get("target_faces", 0))
    downscale_textures(cfg.get("max_texture", 1024))

    out_glb = cfg.get("output_glb") or cfg["input"]
    render_only = cfg.get("render_only", False)
    out_glb_dir = os.path.dirname(out_glb)
    if out_glb_dir:
        os.makedirs(out_glb_dir, exist_ok=True)
    if not render_only:
        export_glb(out_glb, objs)

    total = sum(len(o.data.polygons) for o in objs)
    tris = sum(sum(max(0, len(p.vertices) - 2) for p in o.data.polygons) for o in objs)
    out_label = out_glb if not render_only else "(render-only)"
    print(f"REFINE_DONE polys={total} tris={tris} out_glb={out_label}")

    if cfg.get("preview"):
        render_preview(cfg["preview"], objs, int(cfg.get("preview_size", 300)))
        print(f"PREVIEW_DONE path={cfg['preview']}")


main()
