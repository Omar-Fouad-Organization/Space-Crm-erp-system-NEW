export type Profile = {
 catalogue_evidence?:string;origin_evidence?:string;requirement_states?:Record<string,string>; name_en:string; name_ar:string; description_en:string; description_ar:string; industry:string; classification:string;
 categories:number[]; products:{name_en:string;name_ar:string;description_en?:string;description_ar?:string}[];
 required_products:string[]; preferred_origins:string[]; origin:string; quantity:number|null; capacity:number|null; unit:string;
 capacity_verified:boolean; capacity_evidence:string; required_certifications:string[];
 certifications:{name:string;verified:boolean;evidence:string}[]; meeting_interests:string[]; procurement_criteria:string;
};
export const blankProfile=():Profile=>({name_en:'',name_ar:'',description_en:'',description_ar:'',industry:'',classification:'',categories:[],products:[],required_products:[],preferred_origins:[],origin:'',quantity:null,capacity:null,unit:'',capacity_verified:false,capacity_evidence:'',required_certifications:[],certifications:[],meeting_interests:[],procurement_criteria:''});
export const criteria=['Verified buyer demand','Supply and fulfillment','Quality and documentation','Profile completeness','Authorized decision-maker','Sector and market relevance'];
export const splitTerms=(value:string)=>value.split(',').map(x=>x.trim()).filter(Boolean);
export const eventTime=(value:string,timezone:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value.includes('T')?value:value.replace(' ','T')+'Z'));

export function requirementAnswer(profile:Profile,key:string):string {
 if(profile.requirement_states?.[key])return profile.requirement_states[key];
 const provided=key==='products'?profile.required_products.length>0:key==='origin'?profile.preferred_origins.length>0:key==='capacity'?(profile.quantity??0)>0:profile.required_certifications.length>0;
 return provided?'applicable':'unknown';
}
