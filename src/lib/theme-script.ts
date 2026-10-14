/* Shared by the root layout (server) and lib/theme.ts (client). */

/** localStorage key for the saved theme. */
export const THEME_STORAGE_KEY = "privyus.theme";

/**
 * Runs inline in <head> before the first paint (no flash):
 * ?theme=light|dark forces a theme for this page load; else the saved theme; else dark.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,t=null;var q=new URLSearchParams(location.search).get("theme");if(q==="light"||q==="dark"){t=q}else{try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");if(s==="light"||s==="dark")t=s}catch(e){}}d.setAttribute("data-theme",t||"dark")}catch(e){}})();`;


/**
 * Tracks the last input type on <html data-input>: "pointer" after a mouse or
 * touch press, "keyboard" after a key press. CSS hides focus rings for pointer input.
 */
export const INPUT_MODALITY_SCRIPT = `(function(){var d=document.documentElement;function set(v){if(d.getAttribute("data-input")!==v)d.setAttribute("data-input",v)}document.addEventListener("pointerdown",function(){set("pointer")},true);document.addEventListener("keydown",function(e){if(e.metaKey||e.ctrlKey||e.altKey)return;set("keyboard")},true)})();`;
