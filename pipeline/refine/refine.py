# refine.py — tbg-3d 资产精修脚本（Blender 端，经 blender-mcp 执行）
#
# 用法（agent 通过 blender-mcp 的 execute_code 运行）：
#   exec(open(r"<skill>/pipeline/refine/refine.py").read())
#   运行前修改下方 CONFIG 区块参数。
#
# 执行清单（pipeline/origin-rules.md §3）：
#   1. 导入模型 → 2. 单位归一（米，Apply Transforms）→ 3. 法线重算
#   → 4. 旋转至标准朝向（可选）→ 5. 轴心移至底部中心
#   → 6. 材质槽重命名为共享材质 ref（material-map.json）→ 7. 导出 GLB
#
# 注意：Blender 为 +Z up 右手系，导出 GLB 时 +Y up 转换由导出器自动完成。
# 规范中的"-Z 朝前（glTF）" = Blender 里的"-Y 朝前"。

import bpy
import math
import os

# ---------------- CONFIG（每次运行前修改） ----------------
CONFIG = {
    "input": r"C:\path\to\raw.glb",        # 输入模型（glb；fbx 需先转 glb）
    "output": r"C:\path\to\refined.glb",   # 输出路径
    "category": "components/roof",          # 资产分类（决定轴心规则）
    "rotate_to_face_front": False,          # 模型朝向不对时设 True，绕 Z 转 180°
    "material_refs": ["roof-tile/qingwa"],  # 共享材质 ref，按槽位顺序重命名
    "decimate_ratio": 0.0,                  # >0 时减面到该比例（如 0.1 = 保留 10%）
}

FRONT_FACING_CATEGORIES = (
    "components/wall", "components/door-window", "components/railing",
    "components/bracket", "buildings/", "props/",
)


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_model(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".glb" or ext == ".gltf":
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    else:
        raise ValueError("不支持的格式: " + ext)


def apply_all_transforms():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def recalc_normals():
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")


def rotate_180_if_needed(cfg):
    if not cfg["rotate_to_face_front"]:
        return
    for obj in bpy.data.objects:
        if obj.parent is None:
            obj.rotation_euler[2] += math.radians(180)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def move_pivot_to_bottom_center():
    """把整体包围盒的中心（X/Y）与最低点（Z）移到世界原点。"""
    from mathutils import Vector
    min_x = min_y = min_z = float("inf")
    max_x = max_y = max_z = float("-inf")
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            wc = obj.matrix_world @ Vector(corner)
            min_x, max_x = min(min_x, wc.x), max(max_x, wc.x)
            min_y, max_y = min(min_y, wc.y), max(max_y, wc.y)
            min_z, max_z = min(min_z, wc.z), max(max_z, wc.z)
    cx, cy, z0 = (min_x + max_x) / 2, (min_y + max_y) / 2, min_z
    for obj in bpy.data.objects:
        if obj.parent is None:
            obj.location.x -= cx
            obj.location.y -= cy
            obj.location.z -= z0


def rename_material_slots(refs):
    """按槽位顺序把材质重命名为共享材质 ref（Godot 侧按名挂 .tres）。"""
    slots = []
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            for slot in obj.material_slots:
                if slot.material and slot.material.name not in slots:
                    slots.append(slot.material.name)
    renamed = []
    for i, name in enumerate(slots):
        if i < len(refs) and refs[i]:
            bpy.data.materials[name].name = refs[i]
            renamed.append((name, refs[i]))
        else:
            renamed.append((name, "needs-material-review"))
    return renamed


def decimate(ratio):
    if ratio <= 0 or ratio >= 1:
        return
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        mod = obj.modifiers.new("decimate", "DECIMATE")
        mod.ratio = ratio
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)


def export_glb(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
    )


def stats():
    tris = 0
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            tris += sum(len(p.vertices) - 2 for p in obj.data.polygons)
    return tris


def run(cfg):
    clean_scene()
    import_model(cfg["input"])
    apply_all_transforms()
    recalc_normals()
    rotate_180_if_needed(cfg)
    move_pivot_to_bottom_center()
    decimate(cfg["decimate_ratio"])
    renamed = rename_material_slots(cfg["material_refs"])
    export_glb(cfg["output"])
    print("=== refine 完成 ===")
    print("输出:", cfg["output"])
    print("三角面:", stats())
    print("材质映射:", renamed)
    needs_review = [r for _, r in renamed if r == "needs-material-review"]
    if needs_review:
        print("警告: 有材质槽未映射，需人工指定共享材质")


run(CONFIG)
