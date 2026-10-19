/** Pre-paint masks; failed hydration releases content instead of leaving it hidden. */
export const SILA_MOTION_BOOT = `try{const r=document.documentElement;if(!matchMedia('(prefers-reduced-motion: reduce)').matches){r.classList.add('js-motion');setTimeout(()=>{if(r.dataset.silaMotion!=='ready')r.classList.remove('js-motion')},3500)}}catch(e){}`;
