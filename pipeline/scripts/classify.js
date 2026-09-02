/**
 * classify.js — 根据 glb 文件名自动识别资产分类（CLI 与 Web 工具共用）
 *
 * classifyFileName("xieshan-double-a.glb")
 *   → { kit, top, sub, tier, credits, nameHint, matched, confidence }
 *
 * 规则：中英文关键词命中文件名（不区分大小写），长关键词优先；
 * 命中多个分类时取关键词更长者；未命中时返回 null 字段，由用户手选。
 */

/** 分类中文名，供界面展示 */
const LABELS = {
  top: {
    components: "构件（拼装积木）",
    buildings: "建筑（整栋）",
    props: "道具陈设",
    nature: "自然（树石植物）",
    terrain: "地形地貌",
  },
  sub: {
    roof: "屋顶", wall: "墙体", pillar: "柱子", base: "台基台阶",
    "door-window": "门窗", railing: "栏杆", bracket: "斗拱",
    residential: "民居", commercial: "商业建筑", palace: "宫殿府邸",
    garden: "园林景观", religious: "寺塔宗门", infrastructure: "基础设施",
    lighting: "灯具照明", street: "街道物件", ritual: "祭祀礼器",
    furniture: "家具", cultivation: "修仙器物",
    tree: "树木", rock: "岩石假山", plant: "花草植物",
    "ground-tile": "地面铺装", cliff: "山崖岩壁", water: "水面水体",
  },
  tier: {
    primitive: "手工基础件（0 积分）",
    component: "构件/小件（约 30 积分）",
    mass: "量产建筑（约 40 积分）",
    hero: "英雄件/地标（约 50-60 积分）",
  },
};

/**
 * 关键词表：[top, sub, [关键词...]]
 * 关键词同时匹配英文与中文，按长度降序匹配。
 */
const RULES = [
  // ---- components 构件 ----
  ["components", "roof", ["wudian", "xieshan", "xuanshan", "yingshan", "cuanjian", "juanpeng", "roof", "庑殿", "歇山", "悬山", "硬山", "攒尖", "卷棚", "屋顶", "瓦"]],
  ["components", "wall", ["wall", "qiang", "墙"]],
  ["components", "pillar", ["pillar", "column", "zhu", "柱"]],
  ["components", "base", ["taiji", "step", "base", "platform", "台基", "台阶", "基座"]],
  ["components", "door-window", ["door", "window", "men", "chuang", "门窗", "门", "窗"]],
  ["components", "railing", ["railing", "balustrade", "langan", "栏杆", "围栏"]],
  ["components", "bracket", ["bracket", "dougong", "斗拱", "斗栱"]],
  // ---- buildings 建筑 ----
  ["buildings", "residential", ["residential", "house", "minju", "民居", "住宅", "民宅", "小院"]],
  ["buildings", "commercial", ["commercial", "shop", "store", "market", "shangpu", "客栈", "酒肆", "茶楼", "商铺", "店铺", "商行", "当铺", "药铺"]],
  ["buildings", "palace", ["palace", "gongdian", "城主府", "府邸", "宫殿", "大殿", "正殿"]],
  ["buildings", "garden", ["pavilion", "garden", "yuanlin", "ting", "lang", "凉亭", "亭", "回廊", "园林", "水榭"]],
  ["buildings", "religious", ["pagoda", "temple", "tower", "zongmen", "si", "ta", "宗门", "藏经阁", "寺", "塔", "庙", "道观", "祠堂"]],
  ["buildings", "infrastructure", ["bridge", "gate", "paifang", "qiao", "牌坊", "城门", "城墙", "桥", "码头", "水井"]],
  // ---- props 道具 ----
  ["props", "lighting", ["lantern", "lamp", "light", "denglong", "灯笼", "灯", "烛台"]],
  ["props", "street", ["stone-lion", "stall", "sign", "banner", "tanwei", "shizi", "石狮", "摊位", "招牌", "幌子", "旗"]],
  ["props", "ritual", ["altar", "ritual", "jitan", "xianglu", "祭坛", "香炉", "供桌", "钟", "鼓"]],
  ["props", "furniture", ["furniture", "table", "chair", "screen", "jiaju", "桌椅", "桌", "椅", "屏风", "床", "柜"]],
  ["props", "cultivation", ["furnace", "cauldron", "danlu", "ding", "jianjia", "丹炉", "丹鼎", "鼎", "剑架", "剑冢", "蒲团", "聚灵"]],
  // ---- nature 自然 ----
  ["nature", "tree", ["tree", "pine", "cypress", "shu", "song", "bai", "树", "松", "柏", "竹", "梅", "柳"]],
  ["nature", "rock", ["rock", "stone", "jiashan", "石头", "岩石", "假山", "石"]],
  ["nature", "plant", ["plant", "flower", "grass", "hua", "cao", "花草", "花", "草", "莲", "荷"]],
  // ---- terrain 地形 ----
  ["terrain", "ground-tile", ["tile", "ground", "floor", "dizhuan", "地砖", "地板", "石板路", "铺装"]],
  ["terrain", "cliff", ["cliff", "mountain", "shanya", "山崖", "崖壁", "崖", "山石"]],
  ["terrain", "water", ["water", "river", "pond", "shui", "水面", "河流", "池塘", "水"]],
];

/** top → 默认 tier */
const TIER_BY_TOP = {
  components: "component",
  buildings: "mass",
  props: "component",
  nature: "component",
  terrain: "component",
};

/** tier → 默认积分 */
const CREDITS_BY_TIER = { primitive: 0, component: 30, mass: 40, hero: 60 };

/** 英雄件关键词（命中则 tier 提升为 hero） */
const HERO_KEYWORDS = ["hero", "landmark", "zhudian", "主殿", "城主府", "地标", "主塔"];

/**
 * @param {string} fileName glb 文件名（可含路径）
 * @returns 识别结果；未命中分类时 top/sub 为 null
 */
function classifyFileName(fileName) {
  const base = String(fileName).replace(/\\/g, "/").split("/").pop().replace(/\.glb$/i, "");
  const lower = base.toLowerCase();
  // 去掉连字符/下划线/空格的紧凑形式，兼容 "pai-fang"、"dou_gong" 这类写法
  const compact = lower.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
  // 按分隔符切词，供短拼音关键词精确匹配（避免 "men" 命中 "ornament"）
  const tokens = lower.split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(Boolean);

  const hit = (kw) => {
    const k = kw.toLowerCase();
    const isShortAscii = /^[a-z0-9]+$/.test(k) && k.length <= 4;
    if (isShortAscii) return tokens.includes(k);
    return lower.includes(k) || compact.includes(k.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ""));
  };

  let best = null; // { top, sub, kw }
  for (const [top, sub, kws] of RULES) {
    for (const kw of kws) {
      if (hit(kw)) {
        if (!best || kw.length > best.kw.length) best = { top, sub, kw };
      }
    }
  }

  const isHero = HERO_KEYWORDS.some(hit);

  if (!best) {
    return {
      kit: "cn-ancient", top: null, sub: null,
      tier: isHero ? "hero" : "component",
      credits: isHero ? CREDITS_BY_TIER.hero : CREDITS_BY_TIER.component,
      matched: null, confidence: "none",
    };
  }

  let tier = isHero ? "hero" : TIER_BY_TOP[best.top];
  // 长文件名命中具体子分类关键词（如 xieshan）→ 信心高；单字关键词（如"门"）→ 信心中
  const confidence = best.kw.length >= 3 ? "high" : "medium";

  return {
    kit: "cn-ancient",
    top: best.top,
    sub: best.sub,
    tier,
    credits: CREDITS_BY_TIER[tier],
    nameHint: LABELS.sub[best.sub] || best.sub,
    matched: best.kw,
    confidence,
  };
}

module.exports = { classifyFileName, LABELS, CREDITS_BY_TIER };
