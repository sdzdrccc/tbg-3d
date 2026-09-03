"""
bake-lowpoly.py — tbg-3d 高模→低模烘焙（MMO 适用：低模 + 法线贴图）

思路：源若是「几千个离散小岛的细瓦高模」，直接减面会 UV 撕裂/镂空。
本脚本把高模作为烘焙源，低模用 remesh 熔成一张连续实体 + 智能展 UV，
再把高模的基色/法线烘焙到低模干净 UV 上 —— 低面数 + 实心 + 瓦纹靠法线保留。

用法（headless）：
  blender --background --python bake-lowpoly.py -- <config.json>

config.json 字段：
  {
    "input":          "模型 glb 路径",
    "output_glb":     "低模 glb 输出",
    "preview":        "preview.png 输出",
    "target_width_m": 6.0,      // 缩放：水平最大边（米），0 = 保持
    "voxel_size":     0.05,     // remesh 体素尺寸（越小越精细）
    "target_faces":   8000,     // 低模目标面数（烘焙后靠法线给细节）
    "bake_size":      1024,     // 烘焙贴图尺寸
    "preview_size":   300
  }
"""

import bpy
import bmesh
import json
import os
import sys
from mathutils import Vector


def load_config():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if args and os.path.exists(args[0]):
        with open(args[0], "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "input": r"F:\zxc\Project\tbg-assets\kits\cn-ancient\components\roof\xuanshan-single-a\model.glb",
        "output_glb": r"C:\Users\Administrator\Documents\Codex\2026-09-02\tbg\work\baked.glb",
        "preview": r"C:\Users\Administrator\Documents\Codex\2026-09-02\tbg\work\baked-preview.png",
        "target_width_m": 6.0,
        "voxel_size": 0.05,
        "target_faces": 8000,
        "bake_size": 1024,
        "preview_size": 300,
    }


def apply_transforms(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def world_bbox(objs):
    xs, ys, zs = [], [], []
    for o in objs:
        for corner in o.bound_box:
            wc = o.matrix_world @ Vector(corner)
            xs.append(wc.x); ys.append(wc.y); zs.append(wc.z)
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def normalize_scale_and_origin(obj, target_width_m):
    (x0, x1), (y0, y1), (z0, z1) = world_bbox([obj])
    x_ext = max(x1 - x0, 1e-6)
    if target_width_m and target_width_m > 0:
        s = target_width_m / x_ext
        obj.location = (obj.location.x * s, obj.location.y * s, obj.location.z * s)
        obj.scale = (obj.scale.x * s, obj.scale.y * s, obj.scale.z * s)
        apply_transforms(obj)
        (x0, x1), (y0, y1), (z0, z1) = world_bbox([obj])
    cx = (x0 + x1) / 2.0
    cy = (y0 + y1) / 2.0
    obj.location.x -= cx
    obj.location.y -= cy
    obj.location.z -= z0
    apply_transforms(obj)


def apply_modifier(obj, kind, **kw):
    m = obj.modifiers.new("m", kind)
    for k, v in kw.items():
        setattr(m, k, v)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=m.name)


def smart_uv(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def bake_maps(scene, hp, lp, lp_mat, size):
    lp_mat.use_nodes = True
    nt = lp_mat.node_tree
    nodes = nt.nodes
    links = nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs[0], out.inputs[0])
    lp.data.materials.clear()
    lp.data.materials.append(lp_mat)

    bimg = bpy.data.images.new("LP_Base", size, size)
    nimg = bpy.data.images.new("LP_Normal", size, size)
    nimg.colorspace_settings.name = "Non-Color"
    tex_b = nodes.new("ShaderNodeTexImage")
    tex_b.image = bimg
    tex_n = nodes.new("ShaderNodeTexImage")
    tex_n.image = nimg

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.cycles.device = "CPU"
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.04
    scene.render.bake.margin = 6

    bpy.ops.object.select_all(action="DESELECT")
    hp.select_set(True)
    lp.select_set(True)
    bpy.context.view_layer.objects.active = lp

    nt.nodes.active = tex_b
    try:
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_selected_to_active=True, cage_extrusion=0.04, margin=6)
        print("BAKE_DIFFUSE_OK")
    except Exception as e:
        print("BAKE_DIFFUSE_ERR", e)

    nt.nodes.active = tex_n
    try:
        bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", use_selected_to_active=True, cage_extrusion=0.04, margin=6)
        print("BAKE_NORMAL_OK")
    except Exception as e:
        print("BAKE_NORMAL_ERR", e)

    links.new(tex_b.outputs[0], bsdf.inputs["Base Color"])
    nm = nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 1.0
    links.new(tex_n.outputs[0], nm.inputs["Color"])
    links.new(nm.outputs[0], bsdf.inputs["Normal"])
    bimg.pack()
    nimg.pack()


def export_glb(path, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)


def render_preview(out_path, objs, size):
    scene = bpy.context.scene
    world = bpy.data.worlds.new("W") if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs[0].default_value = (1, 1, 1, 1)
    bg.inputs[1].default_value = 1.4
    oN = nt.nodes.get("World Output") or nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], oN.inputs[0])

    (x0, x1), (y0, y1), (z0, z1) = world_bbox(objs)
    c = Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    size_m = max(x1 - x0, y1 - y0, z1 - z0, 0.1)

    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    cam_data.lens = 50
    cam.location = c + Vector((1.0, -1.4, 1.0)).normalized() * (size_m * 2.2)
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun = bpy.data.objects.new("Sun", sun_data)
    scene.collection.objects.link(sun)
    sun.location = c + Vector((2, -3, 4)) * size_m
    sun.rotation_euler = (0.9, 0.2, 0.6)
    sun_data.energy = 4.5

    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)


def main():
    cfg = load_config()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=cfg["input"])
    hp = [o for o in bpy.data.objects if o.type == "MESH"][0]
    apply_transforms(hp)
    normalize_scale_and_origin(hp, cfg.get("target_width_m", 0))

    # 低模 = 高模副本，remesh 熔成实体，再减面，智能展 UV
    lp = hp.copy()
    lp.data = hp.data.copy()
    bpy.context.scene.collection.objects.link(lp)
    apply_modifier(lp, "REMESH", mode="VOXEL", voxel_size=cfg.get("voxel_size", 0.05))
    cur = len(lp.data.polygons)
    tf = cfg.get("target_faces", 8000)
    if cur > tf:
        apply_modifier(lp, "DECIMATE", decimate_type="COLLAPSE", ratio=tf / cur)
    smart_uv(lp)

    # 烘焙到低模
    lp_mat = bpy.data.materials.new("LP_Baked")
    bake_maps(bpy.context.scene, hp, lp, lp_mat, int(cfg.get("bake_size", 1024)))

    tris = sum(max(0, len(p.vertices) - 2) for p in lp.data.polygons)
    out_glb = cfg.get("output_glb") or cfg["input"]
    os.makedirs(os.path.dirname(out_glb) or ".", exist_ok=True)
    export_glb(out_glb, [lp])
    print(f"BAKE_DONE tris={tris} out_glb={out_glb}")

    if cfg.get("preview"):
        render_preview(cfg["preview"], [lp], int(cfg.get("preview_size", 300)))
        print(f"PREVIEW_DONE path={cfg['preview']}")


main()
