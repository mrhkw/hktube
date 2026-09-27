export type AgeBand = "under_13" | "13_15" | "16_17" | "18_plus";
export function normalizeCountryCode(value:string|null|undefined){const code=value?.trim().toUpperCase()??"";return /^[A-Z]{2}$/.test(code)?code:null;}
export function isMinor(ageBand:AgeBand|null|undefined){return ageBand !== "18_plus";}
export function jurisdictionBlocksAccount(countryCode:string|null|undefined,ageBand:AgeBand|null|undefined){
 const country=normalizeCountryCode(countryCode);
 if(!ageBand) return true;
 if(country==="AU" && ageBand!=="18_plus") return true;
 return false;
}
export const GLOBAL_SAFETY_BASELINE={
 humanRights:true,privacyByDesign:true,freedomOfExpression:true,nonDiscrimination:true,
 childBestInterests:true,safetyByDesign:true,reportAndRedress:true,dataMinimization:true,transparentModeration:true
} as const;