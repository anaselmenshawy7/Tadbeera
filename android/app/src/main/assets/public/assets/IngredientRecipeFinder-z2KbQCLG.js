import { H as Check, J as require_react_dom, M as RECIPES, N as X, U as createLucideIcon, V as ExternalLink, X as __toESM, Y as require_react, n as RecipeIllustration, r as require_jsx_runtime } from "./index-CAWuhwTm.js";
import { CUISINE_BADGE_META, detectMealDbCuisineTier } from "./OnlineRecipeSearch-hi8A-7eT.js";
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var CircleAlert = createLucideIcon("circle-alert", [
	["circle", {
		cx: "12",
		cy: "12",
		r: "10",
		key: "1mglay"
	}],
	["line", {
		x1: "12",
		x2: "12",
		y1: "8",
		y2: "12",
		key: "1pkeuh"
	}],
	["line", {
		x1: "12",
		x2: "12.01",
		y1: "16",
		y2: "16",
		key: "4dfq90"
	}]
]);
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Eye = createLucideIcon("eye", [["path", {
	d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
	key: "1nclc0"
}], ["circle", {
	cx: "12",
	cy: "12",
	r: "3",
	key: "1v7zrd"
}]]);
/**
* @license lucide-react v0.546.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var SlidersHorizontal = createLucideIcon("sliders-horizontal", [
	["path", {
		d: "M10 5H3",
		key: "1qgfaw"
	}],
	["path", {
		d: "M12 19H3",
		key: "yhmn1j"
	}],
	["path", {
		d: "M14 3v4",
		key: "1sua03"
	}],
	["path", {
		d: "M16 17v4",
		key: "1q0r14"
	}],
	["path", {
		d: "M21 12h-9",
		key: "1o4lsq"
	}],
	["path", {
		d: "M21 19h-5",
		key: "1rlt1p"
	}],
	["path", {
		d: "M21 5h-7",
		key: "1oszz2"
	}],
	["path", {
		d: "M8 10v4",
		key: "tgpxqk"
	}],
	["path", {
		d: "M8 12H3",
		key: "a7s4jb"
	}]
]);
// src/features/recipes/IngredientRecipeFinder.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_react_dom = require_react_dom();
var import_jsx_runtime = require_jsx_runtime();
var API = "https://www.themealdb.com/api/json/v1/1";
var ONLINE_FETCH_TIMEOUT_MS = 3e3;
var CUISINE_PRIORITY = {
	egyptian: 0,
	arab: 1,
	international: 2
};
var INGREDIENTS = {
	"رز": "rice",
	"ارز": "rice",
	"أرز": "rice",
	"مكرونة": "pasta",
	"بتنجان": "aubergine",
	"باذنجان": "aubergine",
	"بطاطس": "potatoes",
	"بصل": "onion",
	"طماطم": "tomato",
	"ثوم": "garlic",
	"بيض": "eggs",
	"فراخ": "chicken",
	"دجاج": "chicken",
	"بواقي فراخ": "chicken",
	"لحمة": "beef",
	"لحم": "beef",
	"بواقي لحمة": "beef",
	"سمك": "fish",
	"جمبري": "shrimp",
	"سبيط": "squid",
	"كاليماري": "squid",
	"تونة": "tuna",
	"فلفل": "pepper",
	"فلفل رومي": "pepper",
	"جزر": "carrots",
	"كوسة": "courgette",
	"عدس": "lentils",
	"عدس اصفر": "lentils",
	"عدس بجبة": "lentils",
	"عدس بجبه": "lentils",
	"حمص": "chickpeas",
	"فول": "broad beans",
	"سبانخ": "spinach",
	"جبنة": "cheese",
	"جبنه": "cheese",
	"لبن": "milk"
};
var normalize = (s) => s.toLocaleLowerCase("ar").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/[\u064B-\u065F]/g, "").trim();
var normalizeText = (s) => normalize(s).toLowerCase().replace(/\s+/g, " ");
/**
* Strips leftover Latin/foreign script prefixes from translated recipe titles
* (e.g., "Kaspressknödel - كاسبريسنودل" -> "كاسبريسنودل") so only clean Arabic dish names appear.
*/
function cleanTranslatedArabicTitle(rawTitle) {
	const trimmed = (rawTitle || "").trim();
	if (!trimmed) return "";
	if (!/[\u0600-\u06FF]/.test(trimmed)) return trimmed;
	return trimmed.replace(/^[A-Za-z0-9\u00C0-\u024F\s'’"().,!?&]+[-–—:|/]+\s*/u, "").replace(/\s*\([A-Za-z0-9\u00C0-\u024F\s'’".,!?-]+\)\s*$/u, "").replace(/^(?:[A-Za-z\u00C0-\u024F'’.-]+\s+)+(?=[\u0600-\u06FF])/u, "").replace(/^[-–—:|/\s]+|[-–—:|/\s]+$/g, "").replace(/\s+/g, " ").trim() || trimmed;
}
var CURATED_LOCAL_BASICS = [
	{
		id: "local-moussaka",
		name: "مسقعة مصرية",
		cuisine: "egyptian",
		ingredients: [
			{
				label: "باذنجان",
				aliases: ["بتنجان", "باذنجان"]
			},
			{
				label: "طماطم",
				aliases: ["طماطم"]
			},
			{
				label: "بصل",
				aliases: ["بصل"]
			},
			{
				label: "ثوم",
				aliases: ["ثوم"]
			}
		],
		instructions: "قطّع البتنجان وحمّره أو اشوه. حضّر صلصة من البصل والثوم والطماطم، ثم رصّ البتنجان معها واتركه يتسبك."
	},
	{
		id: "local-potato-sauce",
		name: "بطاطس بالصلصة",
		cuisine: "egyptian",
		ingredients: [
			{
				label: "بطاطس",
				aliases: ["بطاطس"]
			},
			{
				label: "طماطم",
				aliases: ["طماطم"]
			},
			{
				label: "بصل",
				aliases: ["بصل"]
			},
			{
				label: "ثوم",
				aliases: ["ثوم"]
			}
		],
		instructions: "شوّح البصل والثوم، أضف الطماطم والتوابل ثم البطاطس والماء واتركها حتى تنضج."
	},
	{
		id: "local-koshari",
		name: "كشري مصري",
		cuisine: "egyptian",
		ingredients: [
			{
				label: "أرز",
				aliases: [
					"رز",
					"ارز",
					"أرز"
				]
			},
			{
				label: "مكرونة",
				aliases: ["مكرونة"]
			},
			{
				label: "بصل",
				aliases: ["بصل"]
			},
			{
				label: "طماطم",
				aliases: ["طماطم"]
			},
			{
				label: "عدس",
				aliases: ["عدس", "عدس بجبة"]
			},
			{
				label: "حمص",
				aliases: ["حمص"]
			}
		],
		instructions: "اسلق العدس والأرز والمكرونة كلًّا على حدة. حضّر صلصة الطماطم وحمّر البصل وقدّم المكونات معًا."
	},
	{
		id: "local-shakshouka",
		name: "شكشوكة",
		cuisine: "egyptian",
		ingredients: [
			{
				label: "بيض",
				aliases: ["بيض"]
			},
			{
				label: "طماطم",
				aliases: ["طماطم"]
			},
			{
				label: "بصل",
				aliases: ["بصل"]
			},
			{
				label: "فلفل",
				aliases: ["فلفل", "فلفل رومي"]
			}
		],
		instructions: "شوّح البصل والفلفل، أضف الطماطم حتى تتسبك، ثم أضف البيض واتركه حتى ينضج."
	},
	{
		id: "local-potato-eggplant",
		name: "صينية بطاطس بالباذنجان",
		cuisine: "egyptian",
		ingredients: [
			{
				label: "بطاطس",
				aliases: ["بطاطس"]
			},
			{
				label: "باذنجان",
				aliases: ["بتنجان", "باذنجان"]
			},
			{
				label: "طماطم",
				aliases: ["طماطم"]
			},
			{
				label: "بصل",
				aliases: ["بصل"]
			}
		],
		instructions: "قطّع الخضروات ورصّها في صينية مع عصير الطماطم والبصل والتوابل، ثم اخبزها حتى تنضج."
	}
];
function buildExpandedLocalLibrary() {
	const seenNames = new Set(CURATED_LOCAL_BASICS.map((item) => normalizeText(item.name)));
	const fromSeed = [];
	for (const recipe of RECIPES) {
		const normName = normalizeText(recipe.name);
		if (!normName || seenNames.has(normName)) continue;
		seenNames.add(normName);
		const detectedCuisine = recipe.cuisine || detectMealDbCuisineTier(void 0, `${recipe.name} ${recipe.tags.join(" ")}`);
		const finalCuisine = detectedCuisine === "international" ? "egyptian" : detectedCuisine;
		fromSeed.push({
			id: `local-${recipe.id}`,
			name: recipe.name,
			cuisine: finalCuisine,
			imageUrl: recipe.imageUrl || void 0,
			ingredients: recipe.ingredients.map((ing) => {
				const words = normalizeText(ing.name).split(" ").filter((w) => w.length > 2);
				return {
					label: `${ing.name}${ing.quantity ? ` (${ing.quantity})` : ""}`,
					aliases: Array.from(/* @__PURE__ */ new Set([ing.name, ...words]))
				};
			}),
			instructions: recipe.steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n")
		});
	}
	return [...CURATED_LOCAL_BASICS, ...fromSeed];
}
var EXPANDED_LOCAL_RECIPES = buildExpandedLocalLibrary();
var onlineIngredientCache = /* @__PURE__ */ new Map();
async function fetchWithTimeout(url, timeoutMs = ONLINE_FETCH_TIMEOUT_MS) {
	const controller = new AbortController();
	const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { signal: controller.signal });
	} finally {
		globalThis.clearTimeout(timer);
	}
}
async function translate(value) {
	try {
		const url = new URL("https://translate.googleapis.com/translate_a/single");
		url.search = new URLSearchParams({
			client: "gtx",
			sl: "ar",
			tl: "en",
			dt: "t",
			q: value
		}).toString();
		const response = await fetchWithTimeout(url.toString(), ONLINE_FETCH_TIMEOUT_MS);
		if (!response.ok) throw new Error("translation-failed");
		const data = await response.json();
		return Array.isArray(data?.[0]) ? data[0].map((part) => typeof part?.[0] === "string" ? part[0] : "").join("") : value;
	} catch {
		return value;
	}
}
function scaleMeasure(value, familySize, baseServings = 4) {
	const match = value.match(/^\s*(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)(.*)$/);
	if (!match) return value;
	const amount = match[1].trim().split(/\s+/).reduce((total, part) => {
		if (!part.includes("/")) return total + Number(part);
		const [numerator, denominator] = part.split("/").map(Number);
		return total + (denominator ? numerator / denominator : 0);
	}, 0);
	if (!Number.isFinite(amount) || amount <= 0) return value;
	return (Math.round(amount * Math.max(1, Math.min(30, Math.round(familySize))) / baseServings * 100) / 100).toString() + " " + match[2].trim();
}
async function translateToArabic(value) {
	if (!value.trim()) return "";
	try {
		const url = new URL("https://translate.googleapis.com/translate_a/single");
		url.search = new URLSearchParams({
			client: "gtx",
			sl: "en",
			tl: "ar",
			dt: "t",
			q: value.slice(0, 4500)
		}).toString();
		const response = await fetchWithTimeout(url.toString(), ONLINE_FETCH_TIMEOUT_MS);
		if (!response.ok) throw new Error("translation-failed");
		const data = await response.json();
		const translated = Array.isArray(data?.[0]) ? data[0].map((part) => typeof part?.[0] === "string" ? part[0] : "").join("") : "";
		if (!translated.trim() || !/[\u0600-\u06FF]/.test(translated)) throw new Error("arabic-translation-unavailable");
		return translated;
	} catch {
		throw new Error("تعذر ترجمة الوصفة إلى العربية");
	}
}
function getMatchPercent(item) {
	if (item.total <= 0) return 0;
	return Math.min(100, Math.round(item.matched / item.total * 100));
}
function buildLocalResults(availableIngredients) {
	const normalizedSelected = availableIngredients.map(normalizeText).filter(Boolean);
	return EXPANDED_LOCAL_RECIPES.map((recipe) => {
		const breakdown = recipe.ingredients.map((ing) => {
			const available = ing.aliases.some((alias) => {
				const normAlias = normalizeText(alias);
				if (!normAlias) return false;
				return normalizedSelected.some((sel) => sel === normAlias || sel.includes(normAlias) || normAlias.includes(sel));
			});
			return {
				text: ing.label,
				available
			};
		});
		const matched = breakdown.filter((b) => b.available).length;
		const missing = breakdown.filter((b) => !b.available).map((b) => b.text);
		return {
			id: recipe.id,
			title: recipe.name,
			image: recipe.imageUrl,
			cuisine: recipe.cuisine,
			ingredients: breakdown.map((b) => b.text),
			ingredientBreakdown: breakdown,
			isLocal: true,
			matched,
			total: breakdown.length,
			missing,
			instructions: recipe.instructions,
			url: "https://www.themealdb.com/"
		};
	});
}
/**
* Enforces strict 3-tier priority (Egyptian -> Arab -> International) BEFORE
* sorting by match percentage descending, matched count, and fewer missing items.
*/
function sortIngredientFinderResults(list) {
	return [...list].sort((a, b) => {
		const tierDiff = CUISINE_PRIORITY[a.cuisine || "international"] - CUISINE_PRIORITY[b.cuisine || "international"];
		if (tierDiff !== 0) return tierDiff;
		const percentDiff = getMatchPercent(b) - getMatchPercent(a);
		if (percentDiff !== 0) return percentDiff;
		const matchedDiff = b.matched - a.matched;
		if (matchedDiff !== 0) return matchedDiff;
		return a.missing.length - b.missing.length;
	});
}
function dedupeAndSortResults(list) {
	const sorted = sortIngredientFinderResults(list);
	const seen = /* @__PURE__ */ new Set();
	const unique = [];
	for (const item of sorted) {
		const key = normalizeText(item.title);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		unique.push(item);
	}
	return unique;
}
function IngredientRecipeFinder({ availableIngredients, familySize = 4 }) {
	const [results, setResults] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [cuisine, setCuisine] = (0, import_react.useState)("all");
	const [showAllRecipes, setShowAllRecipes] = (0, import_react.useState)(false);
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [modalImageBroken, setModalImageBroken] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setModalImageBroken(false);
	}, [selected?.id]);
	(0, import_react.useEffect)(() => {
		if (!selected) return;
		const onKeyDown = (event) => {
			if (event.key === "Escape") setSelected(null);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [selected]);
	const search = async () => {
		if (!availableIngredients.length || loading) return;
		setError("");
		setSelected(null);
		setShowAllRecipes(false);
		const normalizedArabicSelected = availableIngredients.map(normalizeText).filter(Boolean);
		const cacheKey = [...normalizedArabicSelected].sort().join("|");
		const localResults = buildLocalResults(availableIngredients);
		const cachedOnline = onlineIngredientCache.get(cacheKey);
		if (cachedOnline) {
			const instantCombined = dedupeAndSortResults([...localResults, ...cachedOnline]);
			setResults(instantCombined);
			if (!instantCombined.some((item) => item.matched > 0)) setError("ملقيناش وصفات مطابقة لمكوناتك الحالية. جرّب إضافة مكونات تانية أو اعرض كل الوصفات.");
			return;
		}
		const immediateLocal = dedupeAndSortResults(localResults);
		setResults(immediateLocal);
		setLoading(true);
		try {
			const coreIngredients = availableIngredients.slice(0, 4);
			const normalizedEnglishSelected = (await Promise.all(coreIngredients.map(async (name) => {
				return INGREDIENTS[normalize(name)] || INGREDIENTS[name] || await translate(name);
			}))).map((item) => item.trim().toLowerCase()).filter(Boolean);
			const ingredientLists = (await Promise.allSettled(normalizedEnglishSelected.map(async (ingredient) => {
				const response = await fetchWithTimeout(`${API}/filter.php?i=${encodeURIComponent(ingredient)}`, ONLINE_FETCH_TIMEOUT_MS);
				if (!response.ok) return [];
				const data = await response.json();
				return Array.isArray(data.meals) ? data.meals : [];
			}))).map((outcome) => outcome.status === "fulfilled" ? outcome.value : []);
			const matchCounts = /* @__PURE__ */ new Map();
			ingredientLists.forEach((list) => list.forEach((meal) => {
				matchCounts.set(meal.idMeal, (matchCounts.get(meal.idMeal) || 0) + 1);
			}));
			const ids = [...matchCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
			const valid = (await Promise.allSettled(ids.map(async (id) => {
				const response = await fetchWithTimeout(`${API}/lookup.php?i=${id}`, ONLINE_FETCH_TIMEOUT_MS);
				if (!response.ok) return null;
				return (await response.json()).meals?.[0] || null;
			}))).flatMap((item) => item.status === "fulfilled" && item.value ? [item.value] : []);
			const mapped = (await Promise.allSettled(valid.map(async (meal) => {
				const mealEntries = Array.from({ length: 20 }, (_, i) => {
					const name = meal[`strIngredient${i + 1}`]?.trim() || "";
					const measure = meal[`strMeasure${i + 1}`]?.trim() || "";
					return {
						name,
						line: name ? `${measure} ${name}`.trim() : ""
					};
				}).filter((entry) => entry.name);
				const raw = meal.strInstructions || "لا تتوفر طريقة التحضير في المصدر.";
				const rawIngredients = mealEntries.map((entry) => entry.line).join("\n");
				const [translatedTitle, ingredientsText, instructions] = await Promise.all([
					translateToArabic(meal.strMeal),
					translateToArabic(rawIngredients),
					translateToArabic(raw)
				]);
				const cleanTitle = cleanTranslatedArabicTitle(translatedTitle);
				const translatedLines = ingredientsText.split("\n").map((line) => line.trim()).filter(Boolean);
				const breakdown = translatedLines.map((line, index) => {
					const engName = (mealEntries[index]?.name || "").toLowerCase();
					const normLine = normalizeText(line);
					const matchesEnglish = !!engName && normalizedEnglishSelected.some((sel) => engName.includes(sel) || sel.includes(engName));
					const matchesArabic = normalizedArabicSelected.some((sel) => normLine.includes(sel) || sel.includes(normLine));
					return {
						text: line,
						available: matchesEnglish || matchesArabic
					};
				});
				const apiMatched = ingredientLists.filter((list) => list.some((entry) => entry.idMeal === meal.idMeal)).length;
				const breakdownMatched = breakdown.filter((b) => b.available).length;
				const total = breakdown.length || availableIngredients.length;
				const matched = Math.min(total, Math.max(breakdownMatched, apiMatched));
				const missing = breakdown.filter((b) => !b.available).map((b) => b.text);
				return {
					id: meal.idMeal,
					title: cleanTitle,
					image: meal.strMealThumb,
					cuisine: detectMealDbCuisineTier(meal.strArea, `${meal.strMeal} ${cleanTitle}`),
					ingredients: translatedLines,
					ingredientBreakdown: breakdown,
					matched,
					total,
					missing,
					instructions,
					url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`
				};
			}))).flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
			onlineIngredientCache.set(cacheKey, mapped);
			const unique = dedupeAndSortResults([...localResults, ...mapped]);
			setResults(unique);
			if (!unique.some((item) => item.matched > 0)) setError("ملقيناش وصفات مطابقة لمكوناتك الحالية. جرّب إضافة مكونات تانية أو اعرض كل الوصفات.");
		} catch {
			setResults(immediateLocal);
			if (!immediateLocal.some((item) => item.matched > 0)) setError("تعذر الاتصال بمكتبة الوصفات. يمكنك عرض الوصفات المحلية أو التحقق من الإنترنت.");
		} finally {
			setLoading(false);
		}
	};
	const cuisineFilteredResults = (0, import_react.useMemo)(() => {
		return sortIngredientFinderResults(cuisine === "egyptian" ? results.filter((item) => item.cuisine === "egyptian") : results);
	}, [results, cuisine]);
	const matchedCount = (0, import_react.useMemo)(() => cuisineFilteredResults.filter((item) => item.matched > 0).length, [cuisineFilteredResults]);
	const zeroMatchCount = (0, import_react.useMemo)(() => cuisineFilteredResults.filter((item) => item.matched === 0).length, [cuisineFilteredResults]);
	const visibleResults = (0, import_react.useMemo)(() => showAllRecipes ? cuisineFilteredResults : cuisineFilteredResults.filter((item) => item.matched > 0), [cuisineFilteredResults, showAllRecipes]);
	const selectedAvailableIngredients = (0, import_react.useMemo)(() => selected ? selected.ingredientBreakdown.filter((item) => item.available) : [], [selected]);
	const selectedMissingIngredients = (0, import_react.useMemo)(() => selected ? selected.ingredientBreakdown.filter((item) => !item.available) : [], [selected]);
	const modalContent = selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		dir: "rtl",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "recipe-detail-modal-title",
		onClick: (event) => {
			if (event.target === event.currentTarget) setSelected(null);
		},
		className: "fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#F3DCE2] bg-[#FFF8FA] shadow-2xl sm:rounded-3xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-[#E8A8B7] sm:hidden",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 items-start justify-between gap-3 border-b border-[#F3DCE2] bg-[#FFFFFF] px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mb-1 flex items-center gap-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${CUISINE_BADGE_META[selected.cuisine].className}`,
									children: CUISINE_BADGE_META[selected.cuisine].label
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								id: "recipe-detail-modal-title",
								className: "text-base font-black leading-snug text-[#4A353B]",
								children: selected.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#8E757C] tabular-nums",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
										"متوفر ",
										selected.matched,
										" من ",
										selected.total,
										" مكوّن"
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										children: "·"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-bold text-[#C96D84]",
										children: [getMatchPercent(selected), "% تطابق"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										children: "·"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
										"لـ ",
										familySize,
										" أفراد"
									] })
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setSelected(null),
						"aria-label": "إغلاق",
						className: "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#F3DCE2] bg-[#FFF8FA] text-[#4A353B] transition hover:bg-[#FADDE4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D47E93]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-5 w-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4",
					children: [
						selected.image && !modalImageBroken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "overflow-hidden rounded-2xl border border-[#F3DCE2] bg-[#FADDE4]/35",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: selected.image,
								alt: selected.title,
								referrerPolicy: "no-referrer",
								onError: () => setModalImageBroken(true),
								className: "max-h-56 w-full object-cover"
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex h-44 w-full items-center justify-center rounded-2xl border border-[#F3DCE2] bg-[#FADDE4]/35 p-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeIllustration, {
								recipeId: selected.id,
								recipeName: selected.title,
								className: "h-36 w-36"
							})
						}),
						selected.ingredientBreakdown.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h5", {
										className: "text-xs font-black text-[#4A353B]",
										children: selected.isLocal ? `المكونات الأساسية (تناسب ${familySize} أفراد)` : `المكونات المضبوطة لـ ${familySize} أفراد`
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[11px] font-semibold text-[#8E757C] tabular-nums",
										children: [
											selectedAvailableIngredients.length,
											" متوفر · ",
											selectedMissingIngredients.length,
											" ناقص"
										]
									})]
								}),
								selectedAvailableIngredients.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-2xl border border-[#F3DCE2] bg-[#FADDE4]/55 p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[#C96D84]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-4 w-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"مكونات متوفرة عندك (",
											selectedAvailableIngredients.length,
											")"
										] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
										className: "space-y-1.5 text-xs text-[#4A353B]",
										children: selectedAvailableIngredients.map((ing, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex items-start gap-2 leading-5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "mt-0.5 font-bold text-[#C96D84]",
												"aria-hidden": "true",
												children: "✓"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold",
												children: scaleMeasure(ing.text, familySize)
											})]
										}, index))
									})]
								}),
								selectedMissingIngredients.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-2xl border border-[#F3DCE2] bg-[#FFFFFF] p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[#8E757C]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-4 w-4 shrink-0 text-[#C96D84]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"مكونات ناقصة (تحتاجها الوصفة) (",
											selectedMissingIngredients.length,
											")"
										] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
										className: "space-y-1.5 text-xs text-[#4A353B]",
										children: selectedMissingIngredients.map((ing, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
											className: "flex items-start gap-2 leading-5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "mt-0.5 font-bold text-[#D47E93]",
												"aria-hidden": "true",
												children: "•"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-medium",
												children: scaleMeasure(ing.text, familySize)
											})]
										}, index))
									})]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 rounded-2xl border border-[#F3DCE2] bg-[#FADDE4]/55 p-3 text-xs font-bold text-[#C96D84]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-4 w-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "كل مكونات الوصفة متوفرة عندك — جاهزة للتحضير فوراً" })]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2 rounded-2xl border border-[#F3DCE2] bg-[#FFFFFF] p-3.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h5", {
								className: "text-xs font-black text-[#4A353B]",
								children: "طريقة التحضير"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "whitespace-pre-wrap text-sm leading-7 text-[#4A353B]",
								children: selected.instructions
							})]
						}),
						!selected.isLocal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pt-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: selected.url,
								target: "_blank",
								rel: "noreferrer",
								className: "inline-flex min-h-[40px] items-center gap-1.5 text-xs font-bold text-[#C96D84] underline underline-offset-4 hover:text-[#4A353B]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "المصدر الأصلي للوصفة" })]
							})
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "shrink-0 border-t border-[#F3DCE2] bg-[#FFFFFF] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setSelected(null),
						className: "flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#D47E93] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#C96D84] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D47E93]",
						children: "إغلاق"
					})
				})
			]
		})
	}) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		dir: "rtl",
		className: "mt-3 space-y-3 rounded-2xl border border-[#F3DCE2] bg-[#FFF8FA] p-3.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-sm font-black text-[#4A353B]",
				children: "🍲 اطبخ بالموجود عندك"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-[11px] leading-5 text-[#8E757C]",
				children: [
					"ابحث بالمكونات المتوفرة، والوصفات المصرية والعربية بتظهر فوراً مع مقادير مضبوطة لـ ",
					familySize,
					" أفراد."
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setCuisine("all"),
						className: `min-h-[40px] whitespace-nowrap shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D47E93] ${cuisine === "all" ? "bg-[#D47E93] text-white shadow-xs" : "border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] hover:bg-[#FADDE4]/50"}`,
						children: "كل المطابخ"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setCuisine("egyptian"),
						className: `min-h-[40px] whitespace-nowrap shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D47E93] ${cuisine === "egyptian" ? "bg-[#D47E93] text-white shadow-xs" : "border border-[#F3DCE2] bg-[#FFFFFF] text-[#4A353B] hover:bg-[#FADDE4]/50"}`,
						children: "أكلات مصرية"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: !availableIngredients.length || loading,
						onClick: search,
						className: "min-h-[40px] whitespace-nowrap shrink-0 rounded-xl bg-[#D47E93] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#C96D84] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D47E93]",
						children: loading ? "بنكمّل البحث أونلاين…" : "دور بالمكونات دي"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[11px] text-[#8E757C]",
				children: ["المكونات المختارة: ", availableIngredients.join("، ") || "اختار مكونات البيت أولاً"]
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				role: "status",
				className: "rounded-xl border border-[#F3DCE2] bg-[#FADDE4]/50 p-2.5 text-xs font-medium text-[#4A353B]",
				children: error
			}),
			cuisineFilteredResults.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2.5 pt-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-2 border-b border-[#F3DCE2] pb-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs font-bold text-[#4A353B] tabular-nums",
						children: [showAllRecipes ? `كل الوصفات (${cuisineFilteredResults.length})` : `الوصفات المناسبة لمكوناتك (${matchedCount})`, loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mr-2 text-[10px] font-medium text-[#C96D84]",
							children: "· جاري إضافة نتائج أونلاين…"
						})]
					}), zeroMatchCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-pressed": showAllRecipes,
						onClick: () => setShowAllRecipes((prev) => !prev),
						className: `inline-flex min-h-[36px] whitespace-nowrap shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D47E93] ${showAllRecipes ? "border-[#D47E93] bg-[#D47E93] text-white" : "border-[#F3DCE2] bg-[#FFFFFF] text-[#C96D84] hover:bg-[#FADDE4]/50"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "h-3.5 w-3.5 shrink-0" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "إظهار كل الوصفات" }),
							showAllRecipes && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-3.5 w-3.5 shrink-0" })
						]
					})]
				}), visibleResults.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2",
					children: visibleResults.map((item) => {
						const percent = getMatchPercent(item);
						const isSelected = selected?.id === item.id;
						const badge = CUISINE_BADGE_META[item.cuisine];
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setSelected(item),
							className: `flex w-full items-center justify-between gap-3 rounded-xl border bg-[#FFFFFF] p-2.5 text-right transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D47E93] ${isSelected ? "border-[#D47E93] ring-1 ring-[#D47E93]/30" : "border-[#F3DCE2] hover:border-[#D47E93]"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#FADDE4]/40",
									children: item.image ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: item.image,
										alt: item.title,
										loading: "lazy",
										referrerPolicy: "no-referrer",
										className: "h-full w-full object-cover"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RecipeIllustration, {
										recipeId: item.id,
										recipeName: item.title,
										className: "h-full w-full"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "min-w-0 flex-1 truncate text-xs font-extrabold text-[#4A353B]",
											children: item.title
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: `shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap ${badge.className}`,
											children: badge.label
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: item.matched > 0 ? "font-bold text-[#C96D84]" : "font-medium text-[#8E757C]",
												children: [
													"متوفر ",
													item.matched,
													" من ",
													item.total,
													" مكوّن"
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[#F3DCE2]",
												"aria-hidden": "true",
												children: "·"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: item.matched > 0 ? "font-bold text-[#C96D84]" : "text-[#8E757C]",
												children: [percent, "% تطابق"]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#C96D84]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "التفاصيل" })]
								})
							]
						}, item.id);
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2.5 rounded-xl border border-dashed border-[#F3DCE2] bg-[#FFFFFF] p-4 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold text-[#4A353B]",
						children: "مفيش وصفات مطابقة للمكونات المختارة حالياً."
					}), zeroMatchCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setShowAllRecipes(true),
						className: "inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[#D47E93] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#C96D84]",
						children: [
							"إظهار كل الوصفات (",
							cuisineFilteredResults.length,
							")"
						]
					})]
				})]
			}),
			typeof document !== "undefined" && modalContent ? (0, import_react_dom.createPortal)(modalContent, document.body) : modalContent
		]
	});
}
export { IngredientRecipeFinder };
